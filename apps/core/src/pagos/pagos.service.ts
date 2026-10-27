import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PasarelaClient } from './pasarela.client';

export interface ResultadoInicioPago {
  idTransaccion: string;
  urlPago: string;
}

/**
 * Starts the gateway transaction for a virtual cita. It is idempotent by idCita: a second click
 * returns the transaction already stored instead of opening another one (PAG-2).
 */
@Injectable()
export class PagosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pasarela: PasarelaClient,
  ) {}

  async iniciarPago(idCita: string, monto: number): Promise<ResultadoInicioPago> {
    const existente = await this.prisma.transaccionPago.findUnique({
      where: { idCita },
      select: { idTransaccion: true, urlPago: true },
    });
    if (existente) {
      return existente;
    }

    const creada = await this.pasarela.crearTransaccion({ referencia: idCita, monto });

    return this.prisma.transaccionPago.upsert({
      where: { idCita },
      create: {
        idTransaccion: creada.idTransaccion,
        idCita,
        monto,
        urlPago: creada.urlPago,
      },
      // Two clicks can race; the gateway is idempotent by referencia and the unique idCita keeps
      // a single row. The row that already exists is the one that wins.
      update: {},
      select: { idTransaccion: true, urlPago: true },
    });
  }
}
