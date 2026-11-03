// @ts-check

import { setTimeout as esperar } from 'node:timers/promises';

/**
 * @typedef {import('../puertos.js').Historia} Historia
 * @typedef {import('../puertos.js').Vinculo} Vinculo
 * @typedef {import('../puertos.js').RegistroAuditoria} RegistroAuditoria
 */

/**
 * Simula la latencia de una dependencia y su caída.
 *
 * @param {{ demoraMs: number, caida: boolean, nombre: string }} opciones
 * @returns {Promise<void>}
 */
async function simularDependencia({ demoraMs, caida, nombre }) {
  if (demoraMs > 0) {
    await esperar(demoraMs);
  }
  if (caida) {
    throw new Error(`La dependencia ${nombre} no responde`);
  }
}

/**
 * Adaptador en memoria del puerto de historias clínicas.
 *
 * @param {{ historias?: Historia[], demoraMs?: number, caida?: boolean }} [opciones]
 */
export function crearHistoriasEnMemoria({ historias = [], demoraMs = 0, caida = false } = {}) {
  return {
    /**
     * @param {string} documento
     * @returns {Promise<Historia | null>}
     */
    async buscarPorDocumento(documento) {
      await simularDependencia({ demoraMs, caida, nombre: 'historias' });
      return historias.find((historia) => historia.documento === documento) ?? null;
    },
  };
}

/**
 * Adaptador en memoria del puerto de vínculos asistenciales. Devuelve solo los vínculos vigentes del usuario
 * de la sesión, que es lo que la táctica necesita.
 *
 * @param {{ vinculos?: Vinculo[], demoraMs?: number, caida?: boolean }} [opciones]
 */
export function crearVinculosEnMemoria({ vinculos = [], demoraMs = 0, caida = false } = {}) {
  return {
    /**
     * @param {{ documento: string, usuarioId: string }} consulta
     * @returns {Promise<Vinculo[]>}
     */
    async buscarVigentes({ documento, usuarioId }) {
      await simularDependencia({ demoraMs, caida, nombre: 'vinculos' });
      return vinculos.filter(
        (vinculo) =>
          vinculo.documento === documento && vinculo.usuarioId === usuarioId && vinculo.vigente,
      );
    },
  };
}

/**
 * Adaptador en memoria del puerto de auditoría. Es de solo anexado: expone `registrar` y `listar`, y no
 * permite modificar ni borrar lo ya escrito.
 *
 * @param {{ demoraMs?: number, caida?: boolean }} [opciones]
 */
export function crearAuditoriaEnMemoria({ demoraMs = 0, caida = false } = {}) {
  /** @type {RegistroAuditoria[]} */
  const registros = [];

  return {
    /**
     * @param {Omit<RegistroAuditoria, 'en' | 'duracionMs'>} registro
     * @returns {Promise<void>}
     */
    async registrar(registro) {
      await simularDependencia({ demoraMs, caida, nombre: 'auditoria' });
      registros.push({ ...registro, en: Date.now(), duracionMs: demoraMs });
    },

    /**
     * @returns {RegistroAuditoria[]}
     */
    listar() {
      return [...registros];
    },
  };
}
