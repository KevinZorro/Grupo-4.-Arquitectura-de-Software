import { afterEach, describe, expect, it } from 'vitest';

import { crearContexto, type Contexto } from './ayuda';

let contexto: Contexto | undefined;

afterEach(async () => {
  await contexto?.cerrar();
  contexto = undefined;
});

async function crearTransaccion(base: string, referencia: string, monto: number): Promise<void> {
  const respuesta = await fetch(`${base}/transacciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ referencia, monto }),
  });

  expect(respuesta.status).toBe(201);
}

function enviarFormulario(base: string, ruta: string, datos: Record<string, string>) {
  return fetch(`${base}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(datos),
    redirect: 'manual',
  });
}

describe('panel de desarrollo', () => {
  it('muestra el formulario y el estado vacío', async () => {
    contexto = await crearContexto();

    const respuesta = await fetch(`${contexto.base}/`);
    const html = await respuesta.text();

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('Pasarela de pagos simulada');
    expect(html).toContain('Nueva transacción');
    expect(html).toContain('Todavía no hay transacciones');
  });

  it('crea una transacción desde el formulario y redirige a la página de pago', async () => {
    contexto = await crearContexto();

    const respuesta = await enviarFormulario(contexto.base, '/panel/transacciones', {
      referencia: 'cita-panel',
      monto: '75000',
    });

    expect(respuesta.status).toBe(303);
    const destino = respuesta.headers.get('location') ?? '';
    expect(destino).toMatch(/^\/pagar\/[0-9a-f-]+$/);

    const panel = await (await fetch(`${contexto.base}/`)).text();
    expect(panel).toContain('cita-panel');
    expect(panel).toContain('75.000');
    expect(panel).not.toContain('Todavía no hay transacciones');
  });

  it('vuelve al panel con un mensaje si el formulario viene mal', async () => {
    contexto = await crearContexto();

    const respuesta = await enviarFormulario(contexto.base, '/panel/transacciones', {
      referencia: '',
      monto: '0',
    });

    expect(respuesta.status).toBe(303);
    expect(respuesta.headers.get('location')).toMatch(/^\/\?error=/);

    const panel = await (
      await fetch(`${contexto.base}${respuesta.headers.get('location')}`)
    ).text();
    expect(panel).toContain('class="error"');
    expect(panel).toContain('referencia debe ser un texto no vacío');
  });

  it('escapa el HTML de la referencia en la tabla', async () => {
    contexto = await crearContexto();
    await crearTransaccion(contexto.base, '<script>alert(1)</script>', 1000);

    const html = await (await fetch(`${contexto.base}/`)).text();

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('no duplica filas si se repite la referencia', async () => {
    contexto = await crearContexto();

    await enviarFormulario(contexto.base, '/panel/transacciones', {
      referencia: 'cita-repetida',
      monto: '50000',
    });
    await enviarFormulario(contexto.base, '/panel/transacciones', {
      referencia: 'cita-repetida',
      monto: '50000',
    });

    const html = await (await fetch(`${contexto.base}/`)).text();
    expect(html.split('cita-repetida').length - 1).toBe(1);
  });

  it('cuenta las transacciones por estado', async () => {
    contexto = await crearContexto();
    await crearTransaccion(contexto.base, 'cita-aprobada', 50000);
    await crearTransaccion(contexto.base, 'cita-pendiente', 60000);

    const panel = await (await fetch(`${contexto.base}/`)).text();
    expect(panel).toContain('2 pendientes');
    expect(panel).toContain('0 aprobadas');
  });
});
