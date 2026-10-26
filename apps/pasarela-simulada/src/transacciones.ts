import { randomUUID } from 'node:crypto';

export type EstadoTransaccion = 'PENDIENTE' | 'APROBADA' | 'RECHAZADA';

/** Estado tal como viaja en el webhook, según el contrato del núcleo. */
export type EstadoWebhook = 'APROBADO' | 'RECHAZADO';

export type EstadoResuelto = Exclude<EstadoTransaccion, 'PENDIENTE'>;

export interface Transaccion {
  readonly idTransaccion: string;
  readonly referencia: string;
  readonly monto: number;
  readonly creadaEn: string;
  estado: EstadoTransaccion;
  resueltaEn?: string;
  intentosWebhook: number;
  ultimoWebhookEn?: string;
}

export interface NuevaTransaccion {
  /** Referencia opaca de la cita. Es el único dato del núcleo que cruza la frontera. */
  referencia: string;
  /** Entero en pesos colombianos. */
  monto: number;
}

export interface ResultadoCreacion {
  transaccion: Transaccion;
  /** `false` cuando ya existía una transacción con esa referencia (idempotencia). */
  creada: boolean;
}

export interface ResultadoResolucion {
  transaccion: Transaccion;
  /** `false` cuando la transacción ya estaba aprobada o rechazada. */
  cambio: boolean;
}

/**
 * Repositorio en memoria. Es un simulador: al reiniciar el proceso se pierden
 * las transacciones, y eso es deliberado.
 */
export class RepositorioTransacciones {
  private readonly porId = new Map<string, Transaccion>();
  private readonly porReferencia = new Map<string, string>();

  crear({ referencia, monto }: NuevaTransaccion): ResultadoCreacion {
    const existente = this.buscarPorReferencia(referencia);
    if (existente) {
      return { transaccion: existente, creada: false };
    }

    const transaccion: Transaccion = {
      idTransaccion: randomUUID(),
      referencia,
      monto,
      estado: 'PENDIENTE',
      creadaEn: new Date().toISOString(),
      intentosWebhook: 0,
    };

    this.porId.set(transaccion.idTransaccion, transaccion);
    this.porReferencia.set(referencia, transaccion.idTransaccion);

    return { transaccion, creada: true };
  }

  buscar(idTransaccion: string): Transaccion | undefined {
    return this.porId.get(idTransaccion);
  }

  buscarPorReferencia(referencia: string): Transaccion | undefined {
    const idTransaccion = this.porReferencia.get(referencia);
    return idTransaccion ? this.porId.get(idTransaccion) : undefined;
  }

  resolver(idTransaccion: string, estado: EstadoResuelto): ResultadoResolucion | undefined {
    const transaccion = this.porId.get(idTransaccion);
    if (!transaccion) {
      return undefined;
    }
    if (transaccion.estado !== 'PENDIENTE') {
      return { transaccion, cambio: false };
    }

    transaccion.estado = estado;
    transaccion.resueltaEn = new Date().toISOString();
    return { transaccion, cambio: true };
  }

  get total(): number {
    return this.porId.size;
  }
}
