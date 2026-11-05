import { escapar, formatearMonto } from './html';
import { CLASE_ESTADO, TEXTO_ESTADO } from './pagina';
import type { Transaccion } from './transacciones';

export interface OpcionesPanel {
  error?: string;
}

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleString('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Bogota',
  });
}

function renderFila(transaccion: Transaccion): string {
  const id = escapar(transaccion.idTransaccion);

  return `<tr>
        <td class="ref">${escapar(transaccion.referencia)}</td>
        <td class="num">${escapar(formatearMonto(transaccion.monto))}</td>
        <td><span class="estado ${CLASE_ESTADO[transaccion.estado]}">${TEXTO_ESTADO[transaccion.estado]}</span></td>
        <td class="fecha">${escapar(formatearFecha(transaccion.creadaEn))}</td>
        <td class="accion"><a href="/pagar/${id}">Abrir</a></td>
      </tr>`;
}

/**
 * Panel de desarrollo: crear transacciones sin `curl` y ver las que ya existen.
 * No forma parte del contrato con el núcleo; es una ayuda para la demo.
 */
export function renderPanel(
  transacciones: readonly Transaccion[],
  opciones: OpcionesPanel = {},
): string {
  const error = opciones.error ? `<div class="error">${escapar(opciones.error)}</div>` : '';

  const contar = (estado: Transaccion['estado']) =>
    transacciones.filter((transaccion) => transaccion.estado === estado).length;

  const filas = transacciones.map(renderFila).join('\n');

  const tabla =
    transacciones.length === 0
      ? '<p class="vacia">Todavía no hay transacciones. Creá la primera arriba.</p>'
      : `<table>
      <thead>
        <tr>
          <th>Referencia</th>
          <th>Monto</th>
          <th>Estado</th>
          <th>Creada</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
      ${filas}
      </tbody>
    </table>`;

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Panel · Pasarela de pagos simulada</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0; padding: 32px 24px;
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        background: #f1f5f9; color: #0f172a;
      }
      main { max-width: 900px; margin: 0 auto; }
      h1 { font-size: 1.25rem; margin: 0; }
      h2 { font-size: 1rem; margin: 0 0 12px; }
      .sub { margin: 4px 0 0; color: #64748b; font-size: 0.82rem; }
      .error {
        margin-top: 16px; padding: 12px 16px; border-radius: 10px;
        background: #fee2e2; color: #991b1b; font-size: 0.85rem;
      }
      .tarjeta {
        margin-top: 20px; padding: 20px; border-radius: 14px; background: #fff;
        box-shadow: 0 4px 16px rgb(15 23 42 / 8%);
      }
      .stats { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 16px; }
      .stats span {
        padding: 4px 12px; border-radius: 999px; background: #e2e8f0;
        font-size: 0.78rem; font-weight: 600;
      }
      .stats .pendiente { background: #fef3c7; color: #92400e; }
      .stats .aprobada { background: #dcfce7; color: #166534; }
      .stats .rechazada { background: #fee2e2; color: #991b1b; }
      form.crear { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-end; }
      form.crear label {
        display: flex; flex-direction: column; gap: 4px; flex: 1 1 180px;
        font-size: 0.78rem; font-weight: 600; color: #334155;
      }
      input {
        padding: 10px 12px; border: 1px solid #cbd5e1; border-radius: 10px;
        font-size: 0.95rem; font-family: inherit;
      }
      input:focus { outline: 2px solid #93c5fd; border-color: #3b82f6; }
      button {
        padding: 11px 20px; border: 0; border-radius: 10px; background: #2563eb;
        color: #fff; font-size: 0.95rem; font-weight: 600; cursor: pointer;
      }
      button:hover { background: #1d4ed8; }
      table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
      th {
        text-align: left; padding: 8px 10px; border-bottom: 2px solid #e2e8f0;
        color: #64748b; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em;
      }
      td { padding: 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
      .ref { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.8rem; }
      .num { font-variant-numeric: tabular-nums; white-space: nowrap; }
      .fecha { color: #64748b; white-space: nowrap; }
      .estado {
        display: inline-block; padding: 3px 10px; border-radius: 999px;
        font-size: 0.72rem; font-weight: 600; white-space: nowrap;
      }
      .pendiente { background: #fef3c7; color: #92400e; }
      .aprobada { background: #dcfce7; color: #166534; }
      .rechazada { background: #fee2e2; color: #991b1b; }
      .accion a { color: #2563eb; font-weight: 600; text-decoration: none; }
      .accion a:hover { text-decoration: underline; }
      .vacia { margin: 0; color: #64748b; font-size: 0.85rem; }
      footer { margin-top: 24px; font-size: 0.72rem; color: #94a3b8; text-align: center; }
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>Pasarela de pagos simulada</h1>
        <p class="sub">Panel de desarrollo · el estado vive en memoria y se pierde al reiniciar</p>
      </header>
      ${error}
      <div class="stats">
        <span>${transacciones.length} transacciones</span>
        <span class="pendiente">${contar('PENDIENTE')} pendientes</span>
        <span class="aprobada">${contar('APROBADA')} aprobadas</span>
        <span class="rechazada">${contar('RECHAZADA')} rechazadas</span>
      </div>
      <section class="tarjeta">
        <h2>Nueva transacción</h2>
        <form class="crear" method="post" action="/panel/transacciones">
          <label>
            Referencia
            <input name="referencia" required maxlength="200" placeholder="cita-123" />
          </label>
          <label>
            Monto (COP)
            <input name="monto" type="number" min="1" step="1" required placeholder="50000" />
          </label>
          <button type="submit">Crear y pagar</button>
        </form>
      </section>
      <section class="tarjeta">
        <h2>Transacciones</h2>
        ${tabla}
      </section>
      <footer>Simulador de desarrollo · no procesa pagos reales</footer>
    </main>
  </body>
</html>
`;
}
