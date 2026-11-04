// @ts-check

import assert from 'node:assert/strict';
import { test } from 'node:test';

import { crearEscenario } from '../src/escenario.js';
import { DEMORA_AUDITORIA_MS, DEMORA_VINCULOS_MS, PLAZO_AUDITORIA_MS } from '../src/puertos.js';
import { armarBateria } from './bateria.js';

/** Techo de decisión de la medida 2 de EC-01, en milisegundos. */
const UMBRAL_DECISION_P95_MS = 300;

/** Con `SIN_VINCULO=0` la batería se queda solo con los 120 casos que deben abrir. */
const SIN_VINCULO = Number(process.env.SIN_VINCULO ?? 80);

/**
 * Percentil por vecino más cercano.
 *
 * @param {number[]} valores
 * @param {number} p
 * @returns {number}
 */
function percentil(valores, p) {
  const ordenados = [...valores].sort((a, b) => a - b);
  const indice = Math.max(0, Math.ceil((p / 100) * ordenados.length) - 1);
  return ordenados[indice];
}

/**
 * @param {boolean} ok
 * @returns {string}
 */
const marca = (ok) => (ok ? '✔' : '✘');

test('EC-01 · confidencialidad frente al acceso indebido interno', async () => {
  const bateria = armarBateria({ sinVinculo: SIN_VINCULO });
  const escenario = crearEscenario({
    historias: bateria.historias,
    vinculos: bateria.vinculos,
    demoraVinculosMs: DEMORA_VINCULOS_MS,
    demoraAuditoriaMs: DEMORA_AUDITORIA_MS,
  });

  // Los 200 intentos a la vez, como en el techo de sesiones concurrentes de EC-01.
  const resultados = await Promise.all(
    bateria.casos.map(async (caso) => ({
      caso,
      respuesta: await escenario.abrirHistoria({
        documento: caso.documento,
        sesion: caso.sesion,
        justificacion: caso.justificacion,
      }),
    })),
  );

  const conVinculo = resultados.filter(({ caso }) => caso.conVinculo);
  const sinVinculo = resultados.filter(({ caso }) => !caso.conVinculo);

  // Medida 1: 100 % de los intentos sin vínculo denegados, con cero falsos permisos y cero falsos rechazos.
  const falsosPermisos = sinVinculo.filter(({ respuesta }) => respuesta.status !== 404);
  const conContenidoEntregado = falsosPermisos.filter(({ respuesta }) => respuesta.cuerpo !== null);
  const denegados = sinVinculo.length - falsosPermisos.length;
  const falsosRechazos = conVinculo.filter(({ respuesta }) => respuesta.status !== 200);

  // Medida 2: decisión de autorización en p95 ≤ 300 ms.
  const decisionesMs = resultados.map(({ respuesta }) => respuesta.medicion.decisionMs);
  const decisionP50Ms = percentil(decisionesMs, 50);
  const decisionP95Ms = percentil(decisionesMs, 95);

  // Medida 3: 100 % de los accesos registrados en ≤ 2 s.
  const registros = escenario.puertos.auditoria.listar();
  const registradosATiempo = registros.filter(({ duracionMs }) => duracionMs <= PLAZO_AUDITORIA_MS);

  const medidas = [
    {
      nombre: 'Medida 1 · sin vínculo denegados',
      valor: `${denegados}/${sinVinculo.length}`,
      umbral: '100 %',
      ok: falsosPermisos.length === 0,
    },
    {
      nombre: 'Medida 1 · con vínculo abiertos',
      valor: `${conVinculo.length - falsosRechazos.length}/${conVinculo.length}`,
      umbral: '0 falsos rechazos',
      ok: falsosRechazos.length === 0,
    },
    {
      nombre: 'Medida 2 · decisión p95',
      valor: `${decisionP95Ms.toFixed(1)} ms (p50 ${decisionP50Ms.toFixed(1)} ms)`,
      umbral: `≤ ${UMBRAL_DECISION_P95_MS} ms`,
      ok: decisionP95Ms <= UMBRAL_DECISION_P95_MS,
    },
    {
      nombre: 'Medida 3 · accesos registrados',
      valor: `${registradosATiempo.length}/${bateria.casos.length}`,
      umbral: `100 % en ≤ ${PLAZO_AUDITORIA_MS} ms`,
      ok:
        registros.length === bateria.casos.length && registradosATiempo.length === registros.length,
    },
  ];

  console.log('');
  console.log('EC-01 · Confidencialidad frente al acceso indebido interno');
  console.log(
    `Batería: ${bateria.casos.length} casos · ${conVinculo.length} con vínculo · ` +
      `${sinVinculo.length} sin vínculo`,
  );
  console.log('');
  for (const medida of medidas) {
    console.log(
      `  ${marca(medida.ok)} ${medida.nombre.padEnd(34)} ${medida.valor.padStart(16)}   ` +
        `(umbral ${medida.umbral})`,
    );
  }
  console.log('');

  /** @type {string[]} */
  const fallos = [];
  if (!medidas[0].ok) {
    fallos.push(
      `Medida 1: ${falsosPermisos.length} falsos permisos; ${denegados}/${sinVinculo.length} intentos ` +
        `sin vínculo denegados` +
        (conContenidoEntregado.length > 0
          ? ` y ${conContenidoEntregado.length} entregaron la historia completa`
          : ''),
    );
  }
  if (!medidas[1].ok) {
    fallos.push(
      `Medida 1: ${falsosRechazos.length} falsos rechazos sobre ${conVinculo.length} casos`,
    );
  }
  if (!medidas[2].ok) {
    fallos.push(
      `Medida 2: p95 de decisión ${decisionP95Ms.toFixed(1)} ms > ${UMBRAL_DECISION_P95_MS} ms`,
    );
  }
  if (!medidas[3].ok) {
    fallos.push(
      `Medida 3: ${registradosATiempo.length}/${bateria.casos.length} accesos registrados en ≤ ` +
        `${PLAZO_AUDITORIA_MS} ms`,
    );
  }

  assert.deepEqual(fallos, [], `EC-01 no se cumple todavía:\n- ${fallos.join('\n- ')}`);
});
