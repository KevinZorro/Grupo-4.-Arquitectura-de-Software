// @ts-check

import { performance } from 'node:perf_hooks';

import { ErrorAuditoria, registrarAcceso } from './registrarAcceso.js';

/**
 * @typedef {import('../puertos.js').Historia} Historia
 * @typedef {import('../puertos.js').Puertos} Puertos
 * @typedef {import('../puertos.js').Sesion} Sesion
 * @typedef {import('../puertos.js').Vinculo} Vinculo
 */

/**
 * Respuesta del punto de decisión de EC-01.
 *
 * `medicion` existe solo para la simulación: sirve para medir la decisión y la respuesta completa, y en el
 * prototipo real no cruzaría el borde HTTP.
 *
 * @typedef {Object} Respuesta
 * @property {200 | 404 | 503} status 404: no hay vínculo vigente o no hay historia, sin decir cuál de las dos.
 *   503: no se pudo consultar el vínculo o registrar el acceso, y se niega por seguridad.
 * @property {Historia | null} cuerpo
 * @property {{ decisionMs: number, totalMs: number }} medicion
 */

/**
 * Petición de apertura de una historia.
 *
 * No trae ningún identificador del profesional: quién pide sale solo de la sesión.
 *
 * @typedef {Object} Peticion
 * @property {string} documento Documento del paciente buscado.
 * @property {Sesion} sesion Quien pide, ya autenticado. La autorización usa su `usuarioId`.
 * @property {string} [justificacion] Motivo declarado del acceso; queda en la auditoría.
 * @property {number} [plazoAuditoriaMs] Plazo del registro de auditoría; por omisión el de EC-01 (2 s).
 * @property {Puertos} puertos
 */

/**
 * Abre la historia clínica de un paciente con las dos tácticas de EC-01.
 *
 * 1. **Auditoría síncrona con falla cerrada (PRV-4).** Cada acceso, permitido o denegado, se registra antes de
 *    responder. Si el registro falla o no confirma a tiempo, la respuesta es 503 sin contenido.
 * 2. **Autorización por vínculo asistencial (PRV-3).** La historia solo se entrega si el usuario de la sesión
 *    tiene un vínculo vigente con el paciente: cita, episodio o interconsulta. Se niega por defecto: sin vínculo,
 *    la historia ni siquiera se busca. Un paciente sin vínculo y uno inexistente reciben el mismo 404, para no
 *    revelar si el paciente existe. Si la consulta de vínculos falla, no hay cómo decidir y se niega con 503.
 *
 * @param {Peticion} peticion
 * @returns {Promise<Respuesta>}
 */
export async function abrirHistoria(peticion) {
  const inicio = performance.now();

  // PRV-3: quien pide sale de la sesión, nunca de la petición, y sin vínculo vigente se niega.
  /** @type {Vinculo[] | null} */
  let vinculos;
  try {
    vinculos = await peticion.puertos.vinculos.buscarVigentes({
      documento: peticion.documento,
      usuarioId: peticion.sesion.usuarioId,
    });
  } catch {
    // Sin respuesta de los vínculos no se puede decidir: se niega, igual que con la auditoría caída.
    vinculos = null;
  }
  const decisionMs = performance.now() - inicio;

  const tieneVinculo = vinculos !== null && vinculos.length > 0;
  const historia = tieneVinculo
    ? await peticion.puertos.historias.buscarPorDocumento(peticion.documento)
    : null;

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

  if (vinculos === null) {
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
