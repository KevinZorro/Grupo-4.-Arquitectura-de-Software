import { escapar, formatearMonto } from './html';
import type { Transaccion } from './transacciones';

export const TEXTO_ESTADO: Record<Transaccion['estado'], string> = {
  PENDIENTE: 'Pendiente de pago',
  APROBADA: 'Pago aprobado',
  RECHAZADA: 'Pago rechazado',
};

export const CLASE_ESTADO: Record<Transaccion['estado'], string> = {
  PENDIENTE: 'pendiente',
  APROBADA: 'aprobada',
  RECHAZADA: 'rechazada',
};

/**
 * Página del simulador. HTML plano con formularios nativos: sin build, sin
 * JavaScript y sin React. La pantalla del núcleo es otra (PAG-6).
 */
export function renderPagina(transaccion: Transaccion): string {
  const id = escapar(transaccion.idTransaccion);
  const pendiente = transaccion.estado === 'PENDIENTE';

  const acciones = pendiente
    ? `<div class="acciones">
        <form method="post" action="/pagar/${id}/aprobar">
          <button class="aprobar" type="submit">Aprobar</button>
        </form>
        <form method="post" action="/pagar/${id}/rechazar">
          <button class="rechazar" type="submit">Rechazar</button>
        </form>
      </div>`
    : '';

  const webhookFallido =
    !pendiente && transaccion.intentosWebhook > 0 && !transaccion.ultimoWebhookEn;

  const aviso = webhookFallido
    ? `<div class="aviso">
        No se pudo notificar al núcleo después de ${transaccion.intentosWebhook} intento(s).
        <form method="post" action="/transacciones/${id}/reintentar-webhook">
          <button type="submit">Reintentar webhook</button>
        </form>
      </div>`
    : '';

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pasarela de pagos simulada</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
        font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
        background: #f1f5f9; color: #0f172a;
      }
      main {
        width: 100%; max-width: 420px; background: #fff; border-radius: 16px; padding: 28px;
        box-shadow: 0 10px 30px rgb(15 23 42 / 12%);
      }
      h1 {
        font-size: 0.8rem; margin: 0; letter-spacing: 0.08em; text-transform: uppercase;
        color: #64748b;
      }
      .monto { font-size: 2.2rem; font-weight: 700; margin: 12px 0 4px; }
      .referencia {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.78rem;
        color: #64748b; word-break: break-all;
      }
      .estado {
        display: inline-block; margin-top: 16px; padding: 4px 12px; border-radius: 999px;
        font-size: 0.78rem; font-weight: 600;
      }
      .pendiente { background: #fef3c7; color: #92400e; }
      .aprobada { background: #dcfce7; color: #166534; }
      .rechazada { background: #fee2e2; color: #991b1b; }
      .acciones { display: flex; gap: 12px; margin-top: 24px; }
      .acciones form { flex: 1; margin: 0; }
      button {
        width: 100%; padding: 12px; border: 0; border-radius: 10px; font-size: 1rem;
        font-weight: 600; cursor: pointer;
      }
      .aprobar { background: #16a34a; color: #fff; }
      .rechazar { background: #e2e8f0; color: #0f172a; }
      .aviso {
        margin-top: 20px; padding: 12px; border-radius: 10px; background: #fef3c7;
        color: #92400e; font-size: 0.82rem;
      }
      .aviso form { margin-top: 8px; }
      .aviso button { background: #92400e; color: #fff; padding: 8px; font-size: 0.85rem; }
      footer { margin-top: 24px; font-size: 0.72rem; color: #94a3b8; text-align: center; }
    </style>
  </head>
  <body>
    <main>
      <h1>Pasarela de pagos simulada</h1>
      <div class="monto">${escapar(formatearMonto(transaccion.monto))}</div>
      <div class="referencia">Ref. ${escapar(transaccion.referencia)}</div>
      <span class="estado ${CLASE_ESTADO[transaccion.estado]}">${TEXTO_ESTADO[transaccion.estado]}</span>
      ${acciones}
      ${aviso}
      <footer>Simulador de desarrollo · no procesa pagos reales</footer>
    </main>
  </body>
</html>
`;
}
