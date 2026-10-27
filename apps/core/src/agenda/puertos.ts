import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import type { Modalidad } from '../generated/prisma/enums';

/*
 * What the agenda needs from the rest of the core while a patient books (docs/flujo-agendar-cita-
 * virtual.md, steps 2 and 3). The agenda states the need; the payment module (PAG-2) and the outbox
 * (EVT-3) plug their adapters in by overriding these tokens, so the booking never imports them and
 * the payment webhook (PAG-3) can depend on the agenda without a cycle.
 */

export const INICIADOR_PAGO = Symbol('INICIADOR_PAGO');

export interface IniciadorPago {
  /**
   * Creates the gateway transaction with the cita's id as its opaque reference and answers where
   * the patient pays. Idempotent by idCita: asking twice returns the same link. Throws when the
   * gateway does not answer in time or answers an error.
   */
  iniciarPago(idCita: string): Promise<{ urlPago: string }>;
}

export const BANDEJA_SALIDA = Symbol('BANDEJA_SALIDA');

/** The payloads of packages/eventos (plan §7.5): identifiers only, never clinical data. */
export type EventoDeCita =
  | {
      clave: 'cita.confirmada';
      datos: { idCita: string; idPaciente: string; modalidad: Modalidad };
    }
  | {
      clave: 'cita.cancelada';
      datos: { idCita: string; idPaciente: string; motivo: 'FALLA_INICIO_PAGO' };
    };

export interface BandejaSalida {
  /** Stores the event inside the caller's transaction, so it exists only if the change commits. */
  encolar(tx: Prisma.TransactionClient, evento: EventoDeCita): Promise<void>;
}

/** Stand-in until PAG-2: with no gateway, a virtual booking fails and is compensated. */
@Injectable()
export class PagoSinPasarela implements IniciadorPago {
  iniciarPago(): Promise<{ urlPago: string }> {
    return Promise.reject(new Error('La pasarela de pagos aún no está conectada (PAG-2)'));
  }
}

/** Stand-in until EVT-3: logs the event that the outbox will store. */
@Injectable()
export class BandejaSinPublicador implements BandejaSalida {
  private readonly logger = new Logger(BandejaSinPublicador.name);

  // ponytail: the event is only logged, so it is lost; EVT-3 replaces this with the outbox table.
  encolar(_tx: Prisma.TransactionClient, { clave, datos }: EventoDeCita): Promise<void> {
    this.logger.warn(`Bandeja de salida pendiente (EVT-3): ${clave} de la cita ${datos.idCita}`);
    return Promise.resolve();
  }
}
