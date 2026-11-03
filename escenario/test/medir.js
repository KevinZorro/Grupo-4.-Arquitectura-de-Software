// @ts-check

/**
 * Script de medición de EC-01 (PRV-2).
 *
 * Corre la batería de 200 casos varias rondas, cada una con un escenario nuevo y los 200 intentos a la vez, y
 * reporta las tres medidas de EC-01 con la misma definición de la prueba `escenario-ec01.test.js`. Sirve para
 * fijar el "antes" (sin táctica) y repetir el "después" (con PRV-3 y PRV-4) con las mismas condiciones.
 *
 * Uso:
 *   npm run medir                       -> etiqueta "antes", 30 rondas
 *   npm run medir -- --etiqueta despues -> etiqueta "despues"
 *   npm run medir -- --rondas 50
 *
 * Escribe `salida/medicion-<etiqueta>.json` y `salida/medicion-<etiqueta>.txt`. Siempre sale con código 0:
 * medir no es aprobar, la aprobación es de `npm run escenario`.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { crearEscenario } from '../src/escenario.js';
import { DEMORA_AUDITORIA_MS, DEMORA_VINCULOS_MS, PLAZO_AUDITORIA_MS } from '../src/puertos.js';
import { armarBateria } from './bateria.js';

/** Techo de decisión de la medida 2 de EC-01, en milisegundos. */
const UMBRAL_DECISION_P95_MS = 300;

const { values } = parseArgs({
  options: {
    etiqueta: { type: 'string', default: 'antes' },
    rondas: { type: 'string', default: '30' },
  },
});

const etiqueta = values.etiqueta ?? 'antes';
const rondas = Number(values.rondas);

if (!/^[a-z0-9-]+$/.test(etiqueta)) {
  throw new Error('La etiqueta solo admite minúsculas, números y guiones');
}
if (!Number.isInteger(rondas) || rondas < 1) {
  throw new Error('--rondas debe ser un entero positivo');
}

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

/** @param {number} n */
const ms = (n) => Number(n.toFixed(2));

const sinVinculoTotal = { intentos: 0, denegados: 0, falsosPermisos: 0, historiasEntregadas: 0 };
const conVinculoTotal = { intentos: 0, abiertos: 0, falsosRechazos: 0 };
/** @type {number[]} */
const decisionesMs = [];
/** @type {number[]} */
const totalesMs = [];
let accesos = 0;
let registrados = 0;
let registradosATiempo = 0;

for (let ronda = 0; ronda < rondas; ronda += 1) {
  const bateria = armarBateria();
  const escenario = crearEscenario({
    historias: bateria.historias,
    vinculos: bateria.vinculos,
    demoraVinculosMs: DEMORA_VINCULOS_MS,
    demoraAuditoriaMs: DEMORA_AUDITORIA_MS,
  });

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

  for (const { caso, respuesta } of resultados) {
    decisionesMs.push(respuesta.medicion.decisionMs);
    totalesMs.push(respuesta.medicion.totalMs);

    if (caso.conVinculo) {
      conVinculoTotal.intentos += 1;
      if (respuesta.status === 200) {
        conVinculoTotal.abiertos += 1;
      } else {
        conVinculoTotal.falsosRechazos += 1;
      }
    } else {
      sinVinculoTotal.intentos += 1;
      if (respuesta.status === 404) {
        sinVinculoTotal.denegados += 1;
      } else {
        sinVinculoTotal.falsosPermisos += 1;
      }
      if (respuesta.cuerpo !== null) {
        sinVinculoTotal.historiasEntregadas += 1;
      }
    }
  }

  const registros = escenario.puertos.auditoria.listar();
  accesos += bateria.casos.length;
  registrados += registros.length;
  registradosATiempo += registros.filter(
    ({ duracionMs }) => duracionMs <= PLAZO_AUDITORIA_MS,
  ).length;
}

const decisionP95Ms = percentil(decisionesMs, 95);

const medicion = {
  etiqueta,
  fecha: new Date().toISOString(),
  node: process.version,
  rondas,
  casosPorRonda: 200,
  supuestos: {
    demoraVinculosMs: DEMORA_VINCULOS_MS,
    demoraAuditoriaMs: DEMORA_AUDITORIA_MS,
    plazoAuditoriaMs: PLAZO_AUDITORIA_MS,
  },
  medida1: {
    sinVinculo: sinVinculoTotal,
    conVinculo: conVinculoTotal,
    cumple: sinVinculoTotal.falsosPermisos === 0 && conVinculoTotal.falsosRechazos === 0,
  },
  medida2: {
    decisionP50Ms: ms(percentil(decisionesMs, 50)),
    decisionP95Ms: ms(decisionP95Ms),
    decisionMaxMs: ms(Math.max(...decisionesMs)),
    umbralP95Ms: UMBRAL_DECISION_P95_MS,
    cumple: decisionP95Ms <= UMBRAL_DECISION_P95_MS,
  },
  medida3: {
    accesos,
    registrados,
    registradosATiempo,
    cumple: registrados === accesos && registradosATiempo === accesos,
  },
  costo: {
    totalP50Ms: ms(percentil(totalesMs, 50)),
    totalP95Ms: ms(percentil(totalesMs, 95)),
    totalMaxMs: ms(Math.max(...totalesMs)),
  },
};

const marca = (/** @type {boolean} */ ok) => (ok ? '✔' : '✘');
const m1 = medicion.medida1;
const m2 = medicion.medida2;
const m3 = medicion.medida3;

const lineas = [
  `EC-01 · medición "${etiqueta}" · ${rondas} rondas × 200 casos · ${medicion.fecha} · Node ${process.version}`,
  `Supuestos: vínculos ${DEMORA_VINCULOS_MS} ms · auditoría ${DEMORA_AUDITORIA_MS} ms · plazo de registro ${PLAZO_AUDITORIA_MS} ms`,
  '',
  `${marca(m1.sinVinculo.falsosPermisos === 0)} Medida 1 · sin vínculo denegados: ${m1.sinVinculo.denegados}/${m1.sinVinculo.intentos} ` +
    `(${m1.sinVinculo.falsosPermisos} falsos permisos, ${m1.sinVinculo.historiasEntregadas} historias entregadas)`,
  `${marca(m1.conVinculo.falsosRechazos === 0)} Medida 1 · con vínculo abiertos: ${m1.conVinculo.abiertos}/${m1.conVinculo.intentos} ` +
    `(${m1.conVinculo.falsosRechazos} falsos rechazos)`,
  `${marca(m2.cumple)} Medida 2 · decisión: p50 ${m2.decisionP50Ms} ms · p95 ${m2.decisionP95Ms} ms · máx ${m2.decisionMaxMs} ms (umbral p95 ≤ ${UMBRAL_DECISION_P95_MS} ms)`,
  `${marca(m3.cumple)} Medida 3 · accesos registrados: ${m3.registradosATiempo}/${m3.accesos} en ≤ ${PLAZO_AUDITORIA_MS} ms`,
  '',
  `Costo · respuesta completa: p50 ${medicion.costo.totalP50Ms} ms · p95 ${medicion.costo.totalP95Ms} ms · máx ${medicion.costo.totalMaxMs} ms`,
  '',
];

const texto = lineas.join('\n');
console.log(texto);

const carpeta = join(dirname(fileURLToPath(import.meta.url)), '..', 'salida');
mkdirSync(carpeta, { recursive: true });
writeFileSync(join(carpeta, `medicion-${etiqueta}.json`), `${JSON.stringify(medicion, null, 2)}\n`);
writeFileSync(join(carpeta, `medicion-${etiqueta}.txt`), texto);
