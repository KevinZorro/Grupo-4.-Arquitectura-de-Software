import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client';
import { EstadoCita, type Modalidad } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { transicionar } from './estado-cita';
import { BANDEJA_SALIDA, INICIADOR_PAGO, type BandejaSalida, type IniciadorPago } from './puertos';
import { aVistaFranja, SELECCION_FRANJA, vistaFranjaSchema } from './vista-franja';

/** How long a virtual cita holds its franja while the patient pays (docs/flujo, step 2). */
export const BLOQUEO_PAGO_MS = 15 * 60_000;

export const vistaCitaSchema = z.object({
  id: z.uuid(),
  estado: z.enum(EstadoCita),
  /** Until when the franja is held for the payment; null once the cita leaves PENDIENTE_PAGO. */
  bloqueoVenceEn: z.iso.datetime().nullable(),
  franja: vistaFranjaSchema,
});

export type VistaCita = z.infer<typeof vistaCitaSchema>;

/** Plan §7.5: a virtual cita answers with its hold and payment link, a presencial one without. */
export const reservaSchema = z.object({
  id: z.uuid(),
  estado: z.enum(EstadoCita),
  bloqueoVenceEn: z.iso.datetime().optional(),
  urlPago: z.url().optional(),
});

export type Reserva = z.infer<typeof reservaSchema>;

export interface SolicitudReserva {
  franjaId: string;
  modalidad: Modalidad;
}

const SELECCION_RESERVA = {
  id: true,
  franjaId: true,
  pacienteId: true,
  estado: true,
  bloqueoVenceEn: true,
  franja: { select: { modalidad: true } },
} satisfies Prisma.CitaSelect;

type CitaReservada = Prisma.CitaGetPayload<{ select: typeof SELECCION_RESERVA }>;

function esViolacionDeUnicidad(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class CitasService {
  private readonly logger = new Logger(CitasService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(INICIADOR_PAGO) private readonly pago: IniciadorPago,
    @Inject(BANDEJA_SALIDA) private readonly bandeja: BandejaSalida,
  ) {}

  /** Every cita of the patient, cancelled ones included, the latest franja first. */
  async listarDelPaciente(pacienteId: string): Promise<VistaCita[]> {
    const citas = await this.prisma.cita.findMany({
      where: { pacienteId },
      select: {
        id: true,
        estado: true,
        bloqueoVenceEn: true,
        franja: { select: SELECCION_FRANJA },
      },
      orderBy: [{ franja: { iniciaEn: 'desc' } }, { creadoEn: 'desc' }],
    });
    return citas.map(({ franja, bloqueoVenceEn, ...cita }) => ({
      ...cita,
      bloqueoVenceEn: bloqueoVenceEn?.toISOString() ?? null,
      franja: aVistaFranja(franja),
    }));
  }

  /**
   * Books the franja for the patient (docs/flujo-agendar-cita-virtual.md, steps 1 to 3). The same
   * Idempotency-Key always answers the same cita. The database, not this code, keeps a franja to
   * one live cita, so two patients racing for it get one 201 and one 409.
   */
  async reservar(
    pacienteId: string,
    claveIdempotencia: string,
    solicitud: SolicitudReserva,
    ahora = new Date(),
  ): Promise<Reserva> {
    const previa = await this.buscarPorClave(pacienteId, claveIdempotencia);
    const cita = previa
      ? this.comoRepeticion(previa, solicitud)
      : await this.crear(pacienteId, claveIdempotencia, solicitud, ahora);
    return this.responder(cita);
  }

  private buscarPorClave(pacienteId: string, claveIdempotencia: string) {
    return this.prisma.cita.findUnique({
      where: { pacienteId_claveIdempotencia: { pacienteId, claveIdempotencia } },
      select: SELECCION_RESERVA,
    });
  }

  private comoRepeticion(previa: CitaReservada, solicitud: SolicitudReserva): CitaReservada {
    if (previa.franjaId !== solicitud.franjaId || previa.franja.modalidad !== solicitud.modalidad) {
      throw new UnprocessableEntityException(
        'La Idempotency-Key ya se usó para otra solicitud; genere una nueva',
      );
    }
    return previa;
  }

  private async crear(
    pacienteId: string,
    claveIdempotencia: string,
    solicitud: SolicitudReserva,
    ahora: Date,
  ): Promise<CitaReservada> {
    await this.validarFranja(solicitud, ahora);
    const esVirtual = solicitud.modalidad === 'VIRTUAL';
    try {
      return await this.prisma.$transaction(async (tx) => {
        const cita = await tx.cita.create({
          data: {
            franjaId: solicitud.franjaId,
            pacienteId,
            claveIdempotencia,
            estado: esVirtual ? EstadoCita.PENDIENTE_PAGO : EstadoCita.CONFIRMADA,
            bloqueoVenceEn: esVirtual ? new Date(ahora.getTime() + BLOQUEO_PAGO_MS) : null,
          },
          select: SELECCION_RESERVA,
        });
        // A presencial cita needs no payment, so it is confirmed and announced right away.
        if (!esVirtual) {
          await this.bandeja.encolar(tx, {
            clave: 'cita.confirmada',
            datos: { idCita: cita.id, idPaciente: pacienteId, modalidad: solicitud.modalidad },
          });
        }
        return cita;
      });
    } catch (error) {
      if (!esViolacionDeUnicidad(error)) {
        throw error;
      }
      // Either this very request arrived twice at once, or another patient took the franja.
      const ganadora = await this.buscarPorClave(pacienteId, claveIdempotencia);
      if (ganadora) {
        return this.comoRepeticion(ganadora, solicitud);
      }
      throw new ConflictException('La franja ya está tomada; elija otra');
    }
  }

  private async validarFranja({ franjaId, modalidad }: SolicitudReserva, ahora: Date) {
    const franja = await this.prisma.franja.findFirst({
      where: { id: franjaId, sede: { activa: true }, profesional: { activo: true } },
      select: { modalidad: true, iniciaEn: true },
    });
    if (!franja) {
      throw new NotFoundException('La franja no existe');
    }
    if (franja.iniciaEn <= ahora) {
      throw new UnprocessableEntityException('La franja ya empezó; elija otra');
    }
    if (franja.modalidad !== modalidad) {
      throw new UnprocessableEntityException(`La franja es ${franja.modalidad}, no ${modalidad}`);
    }
  }

  /** A pending cita needs its payment link; asking the gateway again is safe (idempotent by id). */
  private async responder(cita: CitaReservada): Promise<Reserva> {
    if (cita.estado !== EstadoCita.PENDIENTE_PAGO) {
      return { id: cita.id, estado: cita.estado };
    }
    try {
      const { urlPago } = await this.pago.iniciarPago(cita.id);
      return {
        id: cita.id,
        estado: cita.estado,
        bloqueoVenceEn: cita.bloqueoVenceEn?.toISOString(),
        urlPago,
      };
    } catch (error) {
      this.logger.warn(
        `No se pudo iniciar el pago de la cita ${cita.id}: ${error instanceof Error ? error.message : String(error)}`,
      );
      await this.cancelarPorFallaDePago(cita);
      throw new ServiceUnavailableException(
        'La pasarela de pagos no respondió; la cita quedó cancelada y la franja libre',
      );
    }
  }

  /**
   * Compensation of step 3: the cita is cancelled and the franja freed. The update only applies
   * while the cita is still in the state read, so a payment confirmed meanwhile is never undone.
   */
  private async cancelarPorFallaDePago(cita: CitaReservada): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.cita.updateMany({
        where: { id: cita.id, estado: cita.estado },
        data: { estado: transicionar(cita.estado, EstadoCita.CANCELADA), bloqueoVenceEn: null },
      });
      if (count === 1) {
        await this.bandeja.encolar(tx, {
          clave: 'cita.cancelada',
          datos: { idCita: cita.id, idPaciente: cita.pacienteId, motivo: 'FALLA_INICIO_PAGO' },
        });
      }
    });
  }
}
