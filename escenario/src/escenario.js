// @ts-check

import { abrirHistoria } from './historia/abrirHistoria.js';
import { crearPuertosEnMemoria, DEMORA_AUDITORIA_MS, DEMORA_VINCULOS_MS } from './puertos.js';

/**
 * @typedef {import('./puertos.js').Historia} Historia
 * @typedef {import('./puertos.js').Puertos} Puertos
 * @typedef {import('./puertos.js').Sesion} Sesion
 * @typedef {import('./puertos.js').Vinculo} Vinculo
 * @typedef {import('./historia/abrirHistoria.js').Respuesta} Respuesta
 */

/**
 * Arma el escenario EC-01 completo: los puertos en memoria y el camino de abrir una historia.
 *
 * Las demoras y las caídas se pueden fijar por opción o por entorno, para que los entornos de
 * `entornos/*.env` reproduzcan la falla sin tocar el código.
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
 * @returns {{ puertos: Puertos, abrirHistoria: (peticion: Omit<import('./historia/abrirHistoria.js').Peticion, 'puertos'>) => Promise<Respuesta> }}
 */
export function crearEscenario({
  historias = [],
  vinculos = [],
  demoraVinculosMs = Number(process.env.DEMORA_VINCULOS_MS ?? DEMORA_VINCULOS_MS),
  demoraHistoriasMs = Number(process.env.DEMORA_HISTORIAS_MS ?? 0),
  demoraAuditoriaMs = Number(process.env.DEMORA_AUDITORIA_MS ?? DEMORA_AUDITORIA_MS),
  caidaVinculos = process.env.FALLA_VINCULOS === 'caida',
  caidaHistorias = process.env.FALLA_HISTORIAS === 'caida',
  caidaAuditoria = process.env.FALLA_AUDITORIA === 'caida',
} = {}) {
  const puertos = crearPuertosEnMemoria({
    historias,
    vinculos,
    demoraVinculosMs,
    demoraHistoriasMs,
    demoraAuditoriaMs,
    caidaVinculos,
    caidaHistorias,
    caidaAuditoria,
  });

  return {
    puertos,

    /**
     * @param {Omit<import('./historia/abrirHistoria.js').Peticion, 'puertos'>} peticion
     * @returns {Promise<Respuesta>}
     */
    abrirHistoria(peticion) {
      return abrirHistoria({ ...peticion, puertos });
    },
  };
}
