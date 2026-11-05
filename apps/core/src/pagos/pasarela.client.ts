import { z } from 'zod';

/** The gateway's contract (plan §7.5): an opaque cita reference and an amount in Colombian pesos. */
export interface SolicitudTransaccion {
  referencia: string;
  monto: number;
}

export interface TransaccionCreada {
  idTransaccion: string;
  urlPago: string;
}

export type CausaFallaPasarela = 'timeout' | 'conexion' | 'http' | 'respuesta';

/**
 * Starting the payment failed. The caller compensates (cancels the cita and frees the franja);
 * the message is for the log, never for the patient (PAG-2).
 */
export class PasarelaError extends Error {
  constructor(
    message: string,
    readonly causa: CausaFallaPasarela,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = 'PasarelaError';
  }
}

export interface OpcionesPasarela {
  baseUrl: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

const TIMEOUT_POR_DEFECTO_MS = 5_000;

const respuestaSchema = z.object({
  idTransaccion: z.string().min(1),
  urlPago: z.url(),
});

function esTimeout(error: unknown): boolean {
  // AbortSignal.timeout rejects with a DOMException, which is not always an Error instance.
  const nombre = (error as { name?: unknown } | null)?.name;
  return nombre === 'TimeoutError' || nombre === 'AbortError';
}

/**
 * Adapter for the simulated gateway (PAG-1). It only sends the opaque cita id and the amount
 * (RNF-09) and cuts the call at 5 s by default (RNF-07).
 */
export class PasarelaClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetch: typeof globalThis.fetch;

  constructor({
    baseUrl,
    timeoutMs = TIMEOUT_POR_DEFECTO_MS,
    fetch = globalThis.fetch,
  }: OpcionesPasarela) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.timeoutMs = timeoutMs;
    this.fetch = fetch;
  }

  async crearTransaccion({ referencia, monto }: SolicitudTransaccion): Promise<TransaccionCreada> {
    let respuesta: Response;
    try {
      respuesta = await this.fetch(`${this.baseUrl}/transacciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referencia, monto }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      if (esTimeout(error)) {
        throw new PasarelaError(`La pasarela no respondió en ${this.timeoutMs} ms`, 'timeout', {
          cause: error,
        });
      }
      throw new PasarelaError('No se pudo conectar con la pasarela', 'conexion', { cause: error });
    }

    if (!respuesta.ok) {
      throw new PasarelaError(`La pasarela respondió con el estado ${respuesta.status}`, 'http');
    }

    const cuerpo: unknown = await respuesta.json().catch(() => null);
    const resultado = respuestaSchema.safeParse(cuerpo);
    if (!resultado.success) {
      throw new PasarelaError('La pasarela devolvió una respuesta inválida', 'respuesta');
    }
    return resultado.data;
  }
}
