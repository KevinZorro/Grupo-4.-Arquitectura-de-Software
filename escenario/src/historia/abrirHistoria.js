// @ts-check

import { performance } from 'node:perf_hooks';

import { ErrorAuditoria, registrarAcceso } from './registrarAcceso.js';

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
 * @property {200 | 404 | 503} status 503: la auditoría no pudo registrar el acceso y se niega por seguridad.
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
 * @property {number} [plazoAuditoriaMs] Plazo del registro de auditoría; por omisión el de EC-01 (2 s).
 * @property {Puertos} puertos
 */

/**
 * Abre la historia clínica de un paciente.
 *
 * **Con auditoría síncrona (PRV-4), todavía sin autorización por vínculo (PRV-3).** Busca la historia **solo
 * por el documento**, así que un funcionario sin vínculo aún obtiene la historia: esa parte la cierra PRV-3.
 * Cada acceso, permitido o denegado, se registra en la auditoría antes de responder, y si el registro falla o
 * no confirma a tiempo la respuesta es 503 sin contenido (falla cerrada).
 *
 * @param {Peticion} peticion
 * @returns {Promise<Respuesta>}
 */
export async function abrirHistoria(peticion) {
  const inicio = performance.now();

  // Pendiente de PRV-3: hoy la única condición es que la historia exista.
  const historia = await peticion.puertos.historias.buscarPorDocumento(peticion.documento);
  const decisionMs = performance.now() - inicio;

  const resultado = historia === null ? 'denegado' : 'permitido';

  // PRV-4: se audita antes de responder y, si la auditoría falla, no se entrega nada (falla cerrada).
  try {
    await registrarAcceso({
      puertos: peticion.puertos,
      documento: peticion.documento,
      sesion: peticion.sesion,
      justificacion: peticion.justificacion,
      resultado,
      plazoMs: peticion.plazoAuditoriaMs,
    });
  } catch (error) {
    if (!(error instanceof ErrorAuditoria)) {
      throw error;
    }
    return {
      status: 503,
      cuerpo: null,
      medicion: { decisionMs, totalMs: performance.now() - inicio },
    };
  }

  if (historia === null) {
    return {
      status: 404,
      cuerpo: null,
      medicion: { decisionMs, totalMs: performance.now() - inicio },
    };
  }

  return {
    status: 200,
    cuerpo: historia,
    medicion: { decisionMs, totalMs: performance.now() - inicio },
  };
}
