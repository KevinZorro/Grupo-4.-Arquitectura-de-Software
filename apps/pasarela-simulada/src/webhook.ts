import { firmar } from './firma';
import type { EstadoWebhook, Transaccion } from './transacciones';

/** Esperas entre intentos: 5 intentos, 15 s en total. Como una pasarela real. */
export const ESPERAS_POR_DEFECTO: readonly number[] = [0, 1000, 2000, 4000, 8000];

export type PeticionHttp = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number }>;

export interface OpcionesEnvio {
  url: string;
  secreto: string;
  esperas?: readonly number[];
  peticion?: PeticionHttp;
  dormir?: (ms: number) => Promise<void>;
}

export interface ResultadoEnvio {
  entregado: boolean;
  intentos: number;
}

/**
 * Cuerpo del webhook: solo identificadores, jamás datos clínicos (RNF-09).
 * El orden de las claves es fijo porque la firma se calcula sobre el texto.
 */
export function cuerpoWebhook(transaccion: Transaccion): string {
  if (transaccion.estado === 'PENDIENTE') {
    throw new Error('no se puede notificar una transacción pendiente');
  }

  const estado: EstadoWebhook = transaccion.estado === 'APROBADA' ? 'APROBADO' : 'RECHAZADO';

  return JSON.stringify({
    idTransaccion: transaccion.idTransaccion,
    referencia: transaccion.referencia,
    estado,
  });
}

const dormirDeVerdad = (ms: number): Promise<void> => new Promise((listo) => setTimeout(listo, ms));

/**
 * Notifica al núcleo con reintentos acotados. Nunca lanza: el navegador del
 * paciente ya recibió su respuesta y el problema es del núcleo, no suyo.
 */
export async function enviarWebhook(
  transaccion: Transaccion,
  {
    url,
    secreto,
    esperas = ESPERAS_POR_DEFECTO,
    peticion = globalThis.fetch,
    dormir = dormirDeVerdad,
  }: OpcionesEnvio,
): Promise<ResultadoEnvio> {
  const cuerpo = cuerpoWebhook(transaccion);
  const firma = firmar(cuerpo, secreto);

  for (let intento = 0; intento < esperas.length; intento += 1) {
    if (esperas[intento] > 0) {
      await dormir(esperas[intento]);
    }

    transaccion.intentosWebhook += 1;

    try {
      const respuesta = await peticion(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Firma': firma },
        body: cuerpo,
      });

      if (respuesta.ok) {
        transaccion.ultimoWebhookEn = new Date().toISOString();
        return { entregado: true, intentos: intento + 1 };
      }
    } catch {
      // El núcleo puede estar caído o reiniciándose: se reintenta.
    }
  }

  return { entregado: false, intentos: esperas.length };
}
