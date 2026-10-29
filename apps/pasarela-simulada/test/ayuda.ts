import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { crearApp } from '../src/app';

export const SECRETO = 'secreto-de-prueba';
export const BASE_URL_SIMULADA = 'http://localhost:4000';

export interface WebhookRecibido {
  cuerpo: string;
  firma: string;
}

export interface Contexto {
  /** Base real del servidor de pruebas (puerto efímero). */
  base: string;
  recibidos: WebhookRecibido[];
  cerrar: () => Promise<void>;
}

export interface OpcionesContexto {
  /** URL del webhook; por defecto apunta al receptor de pruebas. */
  urlWebhook?: string;
  esperasWebhook?: readonly number[];
}

/**
 * Levanta la pasarela y un receptor de webhooks en puertos efímeros.
 * El receptor guarda el cuerpo crudo, que es lo que hay que verificar.
 */
export async function crearContexto({
  urlWebhook,
  esperasWebhook = [0, 20],
}: OpcionesContexto = {}): Promise<Contexto> {
  const recibidos: WebhookRecibido[] = [];

  const receptor: Server = createServer((req, res) => {
    let cuerpo = '';
    req.setEncoding('utf8');
    req.on('data', (trozo: string) => {
      cuerpo += trozo;
    });
    req.on('end', () => {
      recibidos.push({ cuerpo, firma: String(req.headers['x-firma'] ?? '') });
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('ok');
    });
  });

  await new Promise<void>((listo) => receptor.listen(0, '127.0.0.1', listo));
  const puertoReceptor = (receptor.address() as AddressInfo).port;

  const servidor = crearApp({
    secreto: SECRETO,
    baseUrl: BASE_URL_SIMULADA,
    urlWebhook: urlWebhook ?? `http://127.0.0.1:${puertoReceptor}/webhook`,
    esperasWebhook,
  }).listen(0, '127.0.0.1');

  await new Promise<void>((listo) => servidor.once('listening', listo));
  const puerto = (servidor.address() as AddressInfo).port;

  return {
    base: `http://127.0.0.1:${puerto}`,
    recibidos,
    cerrar: async () => {
      await new Promise<void>((listo) => servidor.close(() => listo()));
      await new Promise<void>((listo) => receptor.close(() => listo()));
    },
  };
}

/** Espera activa corta: el webhook se envía en segundo plano. */
export async function esperarHasta(condicion: () => boolean, limiteMs = 2000): Promise<void> {
  const inicio = Date.now();

  while (!condicion()) {
    if (Date.now() - inicio > limiteMs) {
      throw new Error('tiempo de espera agotado esperando la condición');
    }
    await new Promise((listo) => setTimeout(listo, 10));
  }
}
