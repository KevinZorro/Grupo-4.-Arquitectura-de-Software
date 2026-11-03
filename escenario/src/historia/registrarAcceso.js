// @ts-check

import { setTimeout as esperar } from 'node:timers/promises';

import { PLAZO_AUDITORIA_MS } from '../puertos.js';

/**
 * @typedef {import('../puertos.js').Puertos} Puertos
 * @typedef {import('../puertos.js').Sesion} Sesion
 */

/**
 * Falla del registro de auditoría: la dependencia cayó o no respondió dentro del plazo.
 */
export class ErrorAuditoria extends Error {
  /**
   * @param {string} mensaje
   * @param {unknown} [causa]
   */
  constructor(mensaje, causa) {
    super(mensaje, { cause: causa });
    this.name = 'ErrorAuditoria';
  }
}

/**
 * Registra el acceso en la auditoría y espera la confirmación (registro síncrono).
 *
 * Es la mitad de la táctica de PRV-4: quien llama no entrega la historia hasta que esta función termina bien.
 * Si la auditoría falla o no responde dentro de `plazoMs`, lanza `ErrorAuditoria` y quien llama debe negar el
 * acceso (falla cerrada), aunque la persona tenga vínculo.
 *
 * @param {Object} datos
 * @param {Puertos} datos.puertos
 * @param {string} datos.documento
 * @param {Sesion} datos.sesion
 * @param {string} [datos.justificacion]
 * @param {'permitido' | 'denegado'} datos.resultado
 * @param {number} [datos.plazoMs] Plazo máximo del registro; por omisión el de EC-01 (2 s).
 * @returns {Promise<void>}
 */
export async function registrarAcceso({
  puertos,
  documento,
  sesion,
  justificacion = '',
  resultado,
  plazoMs = PLAZO_AUDITORIA_MS,
}) {
  const cancelarPlazo = new AbortController();

  const vencido = esperar(plazoMs, undefined, { signal: cancelarPlazo.signal }).then(() => {
    throw new ErrorAuditoria(`La auditoría no confirmó el registro en ${plazoMs} ms`);
  });

  const registro = puertos.auditoria
    .registrar({
      documento,
      usuarioId: sesion.usuarioId,
      origen: sesion.origen,
      justificacion,
      resultado,
    })
    .catch((error) => {
      throw new ErrorAuditoria('La auditoría no pudo registrar el acceso', error);
    });

  try {
    await Promise.race([registro, vencido]);
  } finally {
    // Libera el temporizador; su rechazo por cancelación ya está atendido por la carrera.
    cancelarPlazo.abort();
  }
}
