import { crearEvento, type ClaveEnrutamiento, type DatosEvento } from '@citas/eventos';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';

export interface EventoPorEncolar<C extends ClaveEnrutamiento> {
  clave: C;
  datos: DatosEvento<C>;
}

/**
 * The door to the outbox for every module (ADR-001). It fulfils the agenda's BANDEJA_SALIDA port
 * and is what PAG-3 calls when the webhook confirms a payment.
 */
@Injectable()
export class BandejaSalidaService {
  /** Stores the event inside the caller's transaction, so it exists only if the change commits. */
  async encolar<C extends ClaveEnrutamiento>(
    tx: Prisma.TransactionClient,
    { clave, datos }: EventoPorEncolar<C>,
  ): Promise<void> {
    // crearEvento validates the contract and fixes idEvento now, so a resend keeps the same id.
    const evento = crearEvento(clave, datos);
    await tx.eventoSaliente.create({
      data: { idEvento: evento.idEvento, clave, contenido: evento },
    });
  }
}
