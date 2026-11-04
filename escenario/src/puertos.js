// @ts-check

import {
  crearAuditoriaEnMemoria,
  crearHistoriasEnMemoria,
  crearVinculosEnMemoria,
} from './adaptadores/enMemoria.js';

/** Latencia simulada de la consulta de vínculos, en milisegundos. Es un supuesto declarado. */
export const DEMORA_VINCULOS_MS = 20;

/** Latencia simulada del registro de auditoría, en milisegundos. Es un supuesto declarado. */
export const DEMORA_AUDITORIA_MS = 30;

/** Plazo máximo para registrar un acceso (medida 3 de EC-01), en milisegundos. */
export const PLAZO_AUDITORIA_MS = 2000;

/** @typedef {'cita' | 'episodio' | 'interconsulta'} TipoVinculo */

/**
 * Vínculo asistencial entre un usuario del sistema y un paciente.
 *
 * @typedef {Object} Vinculo
 * @property {string} documento
 * @property {string} usuarioId
 * @property {TipoVinculo} tipo
 * @property {boolean} vigente
 */

/**
 * Historia clínica simulada. Los datos son ficticios.
 *
 * @typedef {Object} Historia
 * @property {string} documento
 * @property {string} nombreCompleto
 * @property {string} resumen
 */

/**
 * Sesión autenticada de quien pide la historia. El usuario sale de aquí, nunca del cuerpo de la petición.
 *
 * @typedef {Object} Sesion
 * @property {string} usuarioId
 * @property {string} sedeId
 * @property {'intranet' | 'internet'} origen
 */

/**
 * Anotación de la auditoría. Solo se anexa: no se modifica ni se borra.
 *
 * @typedef {Object} RegistroAuditoria
 * @property {string} documento
 * @property {string} usuarioId
 * @property {'intranet' | 'internet'} origen
 * @property {string} justificacion
 * @property {'permitido' | 'denegado'} resultado
 * @property {number} en
 * @property {number} duracionMs
 */

/**
 * Puerto de vínculos asistenciales.
 *
 * @typedef {Object} PuertoVinculos
 * @property {(consulta: { documento: string, usuarioId: string }) => Promise<Vinculo[]>} buscarVigentes
 */

/**
 * Puerto de historias clínicas.
 *
 * @typedef {Object} PuertoHistorias
 * @property {(documento: string) => Promise<Historia | null>} buscarPorDocumento
 */

/**
 * Puerto de auditoría, de solo anexado.
 *
 * @typedef {Object} PuertoAuditoria
 * @property {(registro: Omit<RegistroAuditoria, 'en' | 'duracionMs'>) => Promise<void>} registrar
 * @property {() => RegistroAuditoria[]} listar
 */

/**
 * Los tres puertos que consume el punto de decisión de EC-01.
 *
 * @typedef {Object} Puertos
 * @property {PuertoVinculos} vinculos
 * @property {PuertoHistorias} historias
 * @property {PuertoAuditoria} auditoria
 */

/**
 * Arma los tres adaptadores en memoria. La demora y la caída de cada uno se configuran por opción, y la caída
 * también por entorno (`FALLA_VINCULOS`, `FALLA_HISTORIAS` y `FALLA_AUDITORIA` con el valor `caida`).
 *
 * @param {Object} [opciones]
 * @param {Historia[]} [opciones.historias]
 * @param {Vinculo[]} [opciones.vinculos]
 * @param {number} [opciones.demoraVinculosMs]
 * @param {number} [opciones.demoraHistoriasMs]
 * @param {number} [opciones.demoraAuditoriaMs]
 * @param {boolean} [opciones.caidaVinculos]
 * @param {boolean} [opciones.caidaHistorias]
 * @param {boolean} [opciones.caidaAuditoria]
 * @returns {Puertos}
 */
export function crearPuertosEnMemoria({
  historias = [],
  vinculos = [],
  demoraVinculosMs = DEMORA_VINCULOS_MS,
  demoraHistoriasMs = 0,
  demoraAuditoriaMs = DEMORA_AUDITORIA_MS,
  caidaVinculos = false,
  caidaHistorias = false,
  caidaAuditoria = false,
} = {}) {
  return {
    vinculos: crearVinculosEnMemoria({
      vinculos,
      demoraMs: demoraVinculosMs,
      caida: caidaVinculos,
    }),
    historias: crearHistoriasEnMemoria({
      historias,
      demoraMs: demoraHistoriasMs,
      caida: caidaHistorias,
    }),
    auditoria: crearAuditoriaEnMemoria({ demoraMs: demoraAuditoriaMs, caida: caidaAuditoria }),
  };
}
