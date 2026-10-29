import { Inject, Injectable, Optional } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { EstadoCita, type Modalidad } from '../generated/prisma/enums';
import { transicionar } from './estado-cita';
import {
  BANDEJA_SALIDA,
  BandejaSinPublicador,
  type BandejaSalida,
  type EventoDeCita,
} from './puertos';

export class CitaInexistenteError extends Error {
  constructor(readonly idCita: string) {
    super(`La cita ${idCita} no existe`);
    this.name = 'CitaInexistenteError';
  }
}

interface CitaParaEvento {
  idCita: string;
  idPaciente: string;
  modalidad: Modalidad;
}

/**
 * Every change of a cita's state that other modules or the booking trigger, each with its event in
 * the outbox. All of them take the caller's transaction, so the change, the event and whatever the
 * caller stores (PAG-3's transaction row) commit together or not at all.
 */
@Injectable()
export class EstadoCitasService {
  private readonly bandeja: BandejaSalida;

  constructor(@Optional() @Inject(BANDEJA_SALIDA) bandeja?: BandejaSalida) {
    this.bandeja = bandeja ?? new BandejaSinPublicador();
  }

  /** A presencial cita is born CONFIRMADA: only its event is missing. */
  async anunciarConfirmada(tx: Prisma.TransactionClient, cita: CitaParaEvento): Promise<void> {
    await this.bandeja.encolar(tx, { clave: 'cita.confirmada', datos: cita });
  }

  /**
   * Approved payment (PAG-3): PENDIENTE_PAGO -> CONFIRMADA with CitaConfirmada. Answers false and
   * changes nothing when the cita already left PENDIENTE_PAGO, such as a repeated webhook or a hold
   * that expired. A late payment for a cancelled cita is PAG-3's to refund (S2).
   */
  confirmarPorPago(tx: Prisma.TransactionClient, idCita: string): Promise<boolean> {
    return this.salirDePendiente(tx, idCita, EstadoCita.CONFIRMADA, (cita) => ({
      clave: 'cita.confirmada',
      datos: cita,
    }));
  }

  /** Rejected payment (PAG-3): the cita is cancelled and its franja freed. Same answer as above. */
  cancelarPorPagoRechazado(tx: Prisma.TransactionClient, idCita: string): Promise<boolean> {
    return this.cancelar(tx, idCita, 'PAGO_RECHAZADO');
  }

  /** The payment could not even start (step 3 of the flow): the booking's compensation. */
  cancelarPorFallaDeInicio(tx: Prisma.TransactionClient, idCita: string): Promise<boolean> {
    return this.cancelar(tx, idCita, 'FALLA_INICIO_PAGO');
  }

  private cancelar(
    tx: Prisma.TransactionClient,
    idCita: string,
    motivo: 'FALLA_INICIO_PAGO' | 'PAGO_RECHAZADO',
  ): Promise<boolean> {
    return this.salirDePendiente(tx, idCita, EstadoCita.CANCELADA, (cita) => ({
      clave: 'cita.cancelada',
      datos: { idCita: cita.idCita, idPaciente: cita.idPaciente, motivo },
    }));
  }

  /**
   * The update only applies while the cita is still PENDIENTE_PAGO, so two concurrent outcomes
   * (a webhook and the compensation, or a webhook sent twice) never both win.
   */
  private async salirDePendiente(
    tx: Prisma.TransactionClient,
    idCita: string,
    hacia: EstadoCita,
    evento: (cita: CitaParaEvento) => EventoDeCita,
  ): Promise<boolean> {
    const cita = await tx.cita.findUnique({
      where: { id: idCita },
      select: { estado: true, pacienteId: true, franja: { select: { modalidad: true } } },
    });
    if (!cita) {
      throw new CitaInexistenteError(idCita);
    }
    if (cita.estado !== EstadoCita.PENDIENTE_PAGO) {
      return false;
    }
    const { count } = await tx.cita.updateMany({
      where: { id: idCita, estado: EstadoCita.PENDIENTE_PAGO },
      data: { estado: transicionar(cita.estado, hacia), bloqueoVenceEn: null },
    });
    if (count === 0) {
      return false;
    }
    await this.bandeja.encolar(
      tx,
      evento({ idCita, idPaciente: cita.pacienteId, modalidad: cita.franja.modalidad }),
    );
    return true;
  }
}
