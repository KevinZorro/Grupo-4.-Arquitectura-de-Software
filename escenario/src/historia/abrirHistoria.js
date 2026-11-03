// @ts-check

import { performance } from 'node:perf_hooks';

/**
 * @typedef {import('../puertos.js').Historia} Historia
 * @typedef {import('../puertos.js').Puertos} Puertos
 * @typedef {import('../puertos.js').Sesion} Sesion
 */

/**
 * Respuesta del punto de decisión de EC-01.
 *
 * `medicion` existe solo para la simulación: sirve para medir la decisión y la respuesta completa, y en el
 * prototipo real no cruzaría el borde HTTP.
 *
 * @typedef {Object} Respuesta
 * @property {200 | 404} status
 * @property {Historia | null} cuerpo
 * @property {{ decisionMs: number, totalMs: number }} medicion
 */

/**
 * Petición de apertura de una historia.
 *
 * @typedef {Object} Peticion
 * @property {string} documento Documento del paciente buscado.
 * @property {Sesion} sesion Quien pide. La táctica lo usará; sin táctica se ignora.
 * @property {string} [justificacion] Motivo declarado del acceso. Sin táctica se ignora.
 * @property {Puertos} puertos
 */

/**
 * Abre la historia clínica de un paciente.
 *
 * **Sin táctica.** Este es el estado del sistema antes de la autorización por vínculo (PRV-3) y del registro
 * síncrono en auditoría (PRV-4): busca la historia **solo por el documento** y la entrega. No consulta los
 * vínculos asistenciales ni deja traza, así que un funcionario sin vínculo obtiene la historia: es la falla que
 * la prueba del commit 2 deja en rojo.
 *
 * @param {Peticion} peticion
 * @returns {Promise<Respuesta>}
 */
export async function abrirHistoria(peticion) {
  const inicio = performance.now();

  // Sin táctica: la única condición es que la historia exista.
  const historia = await peticion.puertos.historias.buscarPorDocumento(peticion.documento);
  const decisionMs = performance.now() - inicio;

  if (historia === null) {
    return { status: 404, cuerpo: null, medicion: { decisionMs, totalMs: decisionMs } };
  }

  return {
    status: 200,
    cuerpo: historia,
    medicion: { decisionMs, totalMs: performance.now() - inicio },
  };
}
