import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client';
import { EstadoCita, type Modalidad } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { EstadoCitasService } from './estado-citas.service';
import { INICIADOR_PAGO, PagoSinPasarela, type IniciadorPago } from './puertos';
import { aVistaFranja, SELECCION_FRANJA, vistaFranjaSchema } from './vista-franja';

/** How long a virtual cita holds its franja while the patient pays (docs/flujo, step 2). */
export const BLOQUEO_PAGO_MS = 15 * 60_000;

/**
 * Copago of a virtual cita in Colombian pesos, stored on the cita when it is booked so a retry
 * charges the same amount. A made-up figure for the prototype (supuesto A-02 sets no amount).
 */
// ponytail: one flat fee; a tariff per especialidad or affiliation replaces it when billing lands.
export const COPAGO_CITA_VIRTUAL_COP = 20_000;

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
  copagoCop: true,
  franja: { select: { modalidad: true } },
} satisfies Prisma.CitaSelect;

type CitaReservada = Prisma.CitaGetPayload<{ select: typeof SELECCION_RESERVA }>;

function esViolacionDeUnicidad(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

@Injectable()
export class CitasService {
  private readonly logger = new Logger(CitasService.name);
  private readonly pago: IniciadorPago;

  constructor(
    private readonly prisma: PrismaService,
    private readonly estados: EstadoCitasService,
    @Optional() @Inject(INICIADOR_PAGO) pago?: IniciadorPago,
  ) {
    this.pago = pago ?? new PagoSinPasarela();
  }

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
            copagoCop: esVirtual ? COPAGO_CITA_VIRTUAL_COP : null,
          },
          select: SELECCION_RESERVA,
        });
        // A presencial cita needs no payment, so it is confirmed and announced right away.
        if (!esVirtual) {
          await this.estados.anunciarConfirmada(tx, {
            idCita: cita.id,
            idPaciente: pacienteId,
            modalidad: solicitud.modalidad,
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
      // Citas booked before copagoCop existed carry no amount; they are charged the flat fee.
      const monto = cita.copagoCop ?? COPAGO_CITA_VIRTUAL_COP;
      const { urlPago } = await this.pago.iniciarPago(cita.id, monto);
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
      // Compensation of step 3. If a payment was confirmed meanwhile, nothing is undone.
      await this.prisma.$transaction((tx) => this.estados.cancelarPorFallaDeInicio(tx, cita.id));
      throw new ServiceUnavailableException(
        'La pasarela de pagos no respondió; la cita quedó cancelada y la franja libre',
      );
    }
  }
}
