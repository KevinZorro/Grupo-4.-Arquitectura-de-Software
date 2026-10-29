import { Logger } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import type { Modalidad } from '../generated/prisma/enums';

/*
 * What the agenda needs from the rest of the core while a patient books (docs/flujo-agendar-cita-
 * virtual.md, steps 2 to 4). The agenda states the need and does not provide these tokens: the
 * module that owns the adapter exports them from a @Global() module, so the agenda never imports
 * it and the payment webhook (PAG-3) can depend on the agenda without a cycle. For example:
 *
 *   { provide: INICIADOR_PAGO, useExisting: PagosService }          (PAG-2)
 *   { provide: BANDEJA_SALIDA, useExisting: BandejaSalidaService }  (EVT-3)
 *
 * While a token has no adapter the agenda falls back to a stand-in and says so in the log.
 */

export const INICIADOR_PAGO = Symbol('INICIADOR_PAGO');

export interface InicioDePago {
  idTransaccion: string;
  urlPago: string;
}

export interface IniciadorPago {
  /**
   * Creates the gateway transaction for the copago, with the cita's id as its opaque reference,
   * and answers where the patient pays. Idempotent by idCita: asking twice returns the same
   * transaction. Throws when the gateway does not answer in time or answers an error.
   */
  iniciarPago(idCita: string, monto: number): Promise<InicioDePago>;
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
      datos: {
        idCita: string;
        idPaciente: string;
        motivo: 'FALLA_INICIO_PAGO' | 'PAGO_RECHAZADO';
      };
    };

export interface BandejaSalida {
  /** Stores the event inside the caller's transaction, so it exists only if the change commits. */
  encolar(tx: Prisma.TransactionClient, evento: EventoDeCita): Promise<void>;
}

/** Stand-in while no module provides INICIADOR_PAGO: a virtual booking fails and is compensated. */
export class PagoSinPasarela implements IniciadorPago {
  constructor() {
    new Logger(PagoSinPasarela.name).warn(
      'Nadie provee INICIADOR_PAGO: toda reserva virtual se cancelará con 503 (PAG-2)',
    );
  }

  iniciarPago(): Promise<InicioDePago> {
    return Promise.reject(new Error('La pasarela de pagos no está conectada'));
  }
}

/** Stand-in while no module provides BANDEJA_SALIDA: the event only reaches the log. */
export class BandejaSinPublicador implements BandejaSalida {
  private readonly logger = new Logger(BandejaSinPublicador.name);

  constructor() {
    this.logger.warn('Nadie provee BANDEJA_SALIDA: los eventos de cita no saldrán (EVT-3)');
  }

  // ponytail: the event is lost; providing BANDEJA_SALIDA (EVT-3) stores it in the outbox.
  encolar(_tx: Prisma.TransactionClient, { clave, datos }: EventoDeCita): Promise<void> {
    this.logger.warn(`Evento sin bandeja de salida: ${clave} de la cita ${datos.idCita}`);
    return Promise.resolve();
  }
}
