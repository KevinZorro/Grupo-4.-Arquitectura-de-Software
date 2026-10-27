import { describe, expect, it, vi } from 'vitest';
import { PasarelaClient } from './pasarela.client';

const URL_BASE = 'http://pasarela.test';
const RESPUESTA = {
  idTransaccion: 'tx-1',
  urlPago: 'http://pasarela.test/pagar/tx-1',
};

function respuesta(cuerpo: unknown, ok = true, status = 200): Response {
  return { ok, status, json: async () => cuerpo } as Response;
}

function crearCliente(fetch: typeof globalThis.fetch, timeoutMs?: number): PasarelaClient {
  return new PasarelaClient({ baseUrl: URL_BASE, timeoutMs, fetch });
}

describe('PasarelaClient', () => {
  it('envía la referencia opaca y el monto al contrato de PAG-1', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(respuesta(RESPUESTA));

    await expect(
      crearCliente(fetch).crearTransaccion({ referencia: 'cita-1', monto: 50_000 }),
    ).resolves.toEqual(RESPUESTA);

    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe(`${URL_BASE}/transacciones`);
    expect(init).toMatchObject({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ referencia: 'cita-1', monto: 50_000 }),
    });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('quita las barras finales de la URL base', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(respuesta(RESPUESTA));

    await new PasarelaClient({ baseUrl: `${URL_BASE}/`, fetch }).crearTransaccion({
      referencia: 'cita-1',
      monto: 50_000,
    });

    expect(fetch.mock.calls[0][0]).toBe(`${URL_BASE}/transacciones`);
  });

  it('falla con un error de HTTP si la pasarela responde 5xx', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(respuesta({ error: 'boom' }, false, 500));

    await expect(
      crearCliente(fetch).crearTransaccion({ referencia: 'cita-1', monto: 50_000 }),
    ).rejects.toMatchObject({ name: 'PasarelaError', causa: 'http' });
  });

  it('corta la llamada al vencer el plazo y lo reporta como timeout', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
        }),
    );

    await expect(
      crearCliente(fetch, 10).crearTransaccion({ referencia: 'cita-1', monto: 50_000 }),
    ).rejects.toMatchObject({ name: 'PasarelaError', causa: 'timeout' });
  });

  it('distingue una falla de conexión de un timeout', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      crearCliente(fetch).crearTransaccion({ referencia: 'cita-1', monto: 50_000 }),
    ).rejects.toMatchObject({ name: 'PasarelaError', causa: 'conexion' });
  });

  it.each([
    ['sin idTransaccion', { urlPago: RESPUESTA.urlPago }],
    ['sin urlPago', { idTransaccion: RESPUESTA.idTransaccion }],
    ['con una urlPago inválida', { idTransaccion: 'tx-1', urlPago: 'no-es-url' }],
  ])('rechaza una respuesta %s', async (_caso, cuerpo) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(respuesta(cuerpo));

    await expect(
      crearCliente(fetch).crearTransaccion({ referencia: 'cita-1', monto: 50_000 }),
    ).rejects.toMatchObject({ name: 'PasarelaError', causa: 'respuesta' });
  });
});
