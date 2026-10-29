import { describe, expect, it } from 'vitest';

import { firmar } from '../src/firma';
import { RepositorioTransacciones, type Transaccion } from '../src/transacciones';
import { cuerpoWebhook, enviarWebhook, type PeticionHttp } from '../src/webhook';

function transaccionAprobada(): Transaccion {
  const repositorio = new RepositorioTransacciones();
  const { transaccion } = repositorio.crear({ referencia: 'cita-1', monto: 45000 });
  repositorio.resolver(transaccion.idTransaccion, 'APROBADA');
  return transaccion;
}

describe('firmar', () => {
  it('calcula el HMAC-SHA256 esperado', () => {
    expect(firmar('{"a":1}', 'secreto')).toBe(
      '87c6bf752c360faf8b89e2d9ed15dcc45e947f9ecdf9c4b637c8fa62d691c598',
    );
  });
});

describe('cuerpoWebhook', () => {
  it('lleva solo identificadores y el estado', () => {
    const transaccion = transaccionAprobada();
    const cuerpo = JSON.parse(cuerpoWebhook(transaccion)) as Record<string, unknown>;

    expect(Object.keys(cuerpo)).toEqual(['idTransaccion', 'referencia', 'estado']);
    expect(cuerpo.estado).toBe('APROBADO');
  });

  it('traduce el estado interno al del contrato', () => {
    const repositorio = new RepositorioTransacciones();
    const { transaccion } = repositorio.crear({ referencia: 'cita-2', monto: 1000 });
    repositorio.resolver(transaccion.idTransaccion, 'RECHAZADA');

    const cuerpo = JSON.parse(cuerpoWebhook(transaccion)) as { estado: string };
    expect(cuerpo.estado).toBe('RECHAZADO');
  });

  it('no permite notificar una transacción pendiente', () => {
    const { transaccion } = new RepositorioTransacciones().crear({
      referencia: 'cita-3',
      monto: 1000,
    });

    expect(() => cuerpoWebhook(transaccion)).toThrow();
  });
});

describe('enviarWebhook', () => {
  it('reintenta y se rinde sin lanzar', async () => {
    const transaccion = transaccionAprobada();
    let llamadas = 0;

    const peticion: PeticionHttp = async () => {
      llamadas += 1;
      throw new Error('núcleo caído');
    };

    const resultado = await enviarWebhook(transaccion, {
      url: 'http://127.0.0.1:1/webhook',
      secreto: 'secreto',
      esperas: [0, 0, 0],
      peticion,
      dormir: async () => undefined,
    });

    expect(resultado).toEqual({ entregado: false, intentos: 3 });
    expect(llamadas).toBe(3);
    expect(transaccion.intentosWebhook).toBe(3);
  });

  it('deja de reintentar al primer 2xx', async () => {
    const transaccion = transaccionAprobada();
    let llamadas = 0;

    const peticion: PeticionHttp = async () => {
      llamadas += 1;
      return llamadas === 1 ? { ok: false, status: 500 } : { ok: true, status: 200 };
    };

    const resultado = await enviarWebhook(transaccion, {
      url: 'http://127.0.0.1:1/webhook',
      secreto: 'secreto',
      esperas: [0, 0, 0],
      peticion,
      dormir: async () => undefined,
    });

    expect(resultado).toEqual({ entregado: true, intentos: 2 });
    expect(transaccion.ultimoWebhookEn).toBeDefined();
  });

  it('firma siempre el mismo cuerpo, sin re-serializar entre intentos', async () => {
    const transaccion = transaccionAprobada();
    const cuerpos: string[] = [];
    const firmas: string[] = [];

    const peticion: PeticionHttp = async (_url, init) => {
      cuerpos.push(init.body);
      firmas.push(init.headers['X-Firma']);
      return { ok: false, status: 503 };
    };

    await enviarWebhook(transaccion, {
      url: 'http://127.0.0.1:1/webhook',
      secreto: 'secreto',
      esperas: [0, 0],
      peticion,
      dormir: async () => undefined,
    });

    expect(new Set(cuerpos).size).toBe(1);
    expect(new Set(firmas).size).toBe(1);
    expect(firmas[0]).toBe(firmar(cuerpos[0], 'secreto'));
  });
});
