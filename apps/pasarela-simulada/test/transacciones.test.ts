import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { BASE_URL_SIMULADA, SECRETO, crearContexto, esperarHasta, type Contexto } from './ayuda';

let ctx: Contexto;

beforeEach(async () => {
  ctx = await crearContexto();
});

afterEach(async () => {
  await ctx.cerrar();
});

interface RespuestaTransaccion {
  idTransaccion: string;
  urlPago: string;
}

async function crearTransaccion(
  cuerpo: Record<string, unknown> = { referencia: 'cita-1', monto: 45000 },
): Promise<{ status: number; datos: RespuestaTransaccion }> {
  const respuesta = await fetch(`${ctx.base}/transacciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });

  return { status: respuesta.status, datos: (await respuesta.json()) as RespuestaTransaccion };
}

async function accion(idTransaccion: string, verbo: 'aprobar' | 'rechazar') {
  return fetch(`${ctx.base}/pagar/${idTransaccion}/${verbo}`, {
    method: 'POST',
    redirect: 'manual',
  });
}

function firmaEsperada(cuerpo: string): string {
  return createHmac('sha256', SECRETO).update(cuerpo, 'utf8').digest('hex');
}

describe('POST /transacciones', () => {
  it('crea la transacción y devuelve idTransaccion y urlPago', async () => {
    const { status, datos } = await crearTransaccion();

    expect(status).toBe(201);
    expect(datos.idTransaccion).toMatch(/^[0-9a-f-]{36}$/);
    expect(datos.urlPago).toBe(`${BASE_URL_SIMULADA}/pagar/${datos.idTransaccion}`);
  });

  it('es idempotente por referencia', async () => {
    const primera = await crearTransaccion({ referencia: 'cita-9', monto: 30000 });
    const segunda = await crearTransaccion({ referencia: 'cita-9', monto: 30000 });

    expect(primera.status).toBe(201);
    expect(segunda.status).toBe(200);
    expect(segunda.datos.idTransaccion).toBe(primera.datos.idTransaccion);

    const salud = (await (await fetch(`${ctx.base}/salud`)).json()) as { transacciones: number };
    expect(salud.transacciones).toBe(1);
  });

  const invalidos: Array<[string, Record<string, unknown>]> = [
    ['sin campos', {}],
    ['referencia vacía', { referencia: '   ', monto: 1000 }],
    ['referencia no textual', { referencia: 42, monto: 1000 }],
    ['monto cero', { referencia: 'cita-1', monto: 0 }],
    ['monto negativo', { referencia: 'cita-1', monto: -1000 }],
    ['monto decimal', { referencia: 'cita-1', monto: 1000.5 }],
    ['monto textual', { referencia: 'cita-1', monto: '1000' }],
  ];

  it.each(invalidos)('rechaza con 400 el caso %s', async (_caso, cuerpo) => {
    const { status } = await crearTransaccion(cuerpo);
    expect(status).toBe(400);
  });

  it('responde 400 ante un JSON malformado', async () => {
    const respuesta = await fetch(`${ctx.base}/transacciones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"referencia":',
    });

    expect(respuesta.status).toBe(400);
  });
});

describe('GET /pagar/:idTransaccion', () => {
  it('muestra el monto y los dos botones mientras está pendiente', async () => {
    const { datos } = await crearTransaccion({ referencia: 'cita-1', monto: 45000 });

    const respuesta = await fetch(`${ctx.base}/pagar/${datos.idTransaccion}`);
    const html = await respuesta.text();

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('45.000');
    expect(html).toContain('Aprobar');
    expect(html).toContain('Rechazar');
    expect(html).toContain('Pendiente de pago');
  });

  it('escapa la referencia para no inyectar HTML', async () => {
    const { datos } = await crearTransaccion({
      referencia: '<script>alert(1)</script>',
      monto: 1000,
    });

    const html = await (await fetch(`${ctx.base}/pagar/${datos.idTransaccion}`)).text();

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('responde 404 con un id inexistente', async () => {
    const respuesta = await fetch(`${ctx.base}/pagar/no-existe`);
    expect(respuesta.status).toBe(404);
  });
});

describe('resolución del pago', () => {
  it('aprobar responde 303 y envía el webhook firmado', async () => {
    const { datos } = await crearTransaccion({ referencia: 'cita-7', monto: 45000 });

    const respuesta = await accion(datos.idTransaccion, 'aprobar');

    expect(respuesta.status).toBe(303);
    expect(respuesta.headers.get('location')).toBe(`/pagar/${datos.idTransaccion}`);

    await esperarHasta(() => ctx.recibidos.length === 1);
    const recibido = ctx.recibidos[0];

    expect(recibido.firma).toBe(firmaEsperada(recibido.cuerpo));
    expect(JSON.parse(recibido.cuerpo)).toEqual({
      idTransaccion: datos.idTransaccion,
      referencia: 'cita-7',
      estado: 'APROBADO',
    });
  });

  it('no reenvía el webhook si se aprueba dos veces', async () => {
    const { datos } = await crearTransaccion();

    await accion(datos.idTransaccion, 'aprobar');
    await esperarHasta(() => ctx.recibidos.length === 1);

    const segunda = await accion(datos.idTransaccion, 'aprobar');
    expect(segunda.status).toBe(303);

    await new Promise((listo) => setTimeout(listo, 150));
    expect(ctx.recibidos).toHaveLength(1);
  });

  it('rechazar envía el webhook con estado RECHAZADO', async () => {
    const { datos } = await crearTransaccion({ referencia: 'cita-8', monto: 20000 });

    await accion(datos.idTransaccion, 'rechazar');
    await esperarHasta(() => ctx.recibidos.length === 1);

    const cuerpo = JSON.parse(ctx.recibidos[0].cuerpo) as { estado: string };
    expect(cuerpo.estado).toBe('RECHAZADO');
  });

  it('solo lleva identificadores al webhook, aunque lleguen campos de más', async () => {
    const { datos } = await crearTransaccion({
      referencia: 'cita-5',
      monto: 15000,
      especialidad: 'Cardiología',
      motivoConsulta: 'dolor torácico',
    });

    await accion(datos.idTransaccion, 'aprobar');
    await esperarHasta(() => ctx.recibidos.length === 1);

    expect(Object.keys(JSON.parse(ctx.recibidos[0].cuerpo) as object)).toEqual([
      'idTransaccion',
      'referencia',
      'estado',
    ]);
  });

  it('deja consultar el estado por la ruta de respaldo', async () => {
    const { datos } = await crearTransaccion();

    const antes = (await (
      await fetch(`${ctx.base}/transacciones/${datos.idTransaccion}`)
    ).json()) as {
      estado: string;
    };
    expect(antes.estado).toBe('PENDIENTE');

    await accion(datos.idTransaccion, 'aprobar');
    await esperarHasta(() => ctx.recibidos.length === 1);

    const despues = (await (
      await fetch(`${ctx.base}/transacciones/${datos.idTransaccion}`)
    ).json()) as { estado: string };
    expect(despues.estado).toBe('APROBADA');
  });

  it('responde 303 aunque el núcleo esté caído', async () => {
    const caido = await crearContexto({
      urlWebhook: 'http://127.0.0.1:1/webhook',
      esperasWebhook: [0, 10],
    });

    try {
      const creacion = await fetch(`${caido.base}/transacciones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ referencia: 'cita-caida', monto: 5000 }),
      });
      const { idTransaccion } = (await creacion.json()) as RespuestaTransaccion;

      const respuesta = await fetch(`${caido.base}/pagar/${idTransaccion}/aprobar`, {
        method: 'POST',
        redirect: 'manual',
      });

      expect(respuesta.status).toBe(303);
    } finally {
      await caido.cerrar();
    }
  });
});

describe('GET /salud', () => {
  it('responde ok', async () => {
    const respuesta = await fetch(`${ctx.base}/salud`);
    expect(respuesta.status).toBe(200);
    expect(await respuesta.json()).toEqual({ estado: 'ok', transacciones: 0 });
  });
});
