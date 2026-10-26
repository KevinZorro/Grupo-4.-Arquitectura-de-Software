import { config } from 'dotenv';
import { resolve } from 'node:path';

/**
 * Carga el `.env` de la app y el de la raíz del monorepo, en ese orden.
 * Las variables que ya están en el entorno mandan: `dotenv` no las pisa.
 *
 * Es el mismo criterio que `apps/core` (`ConfigModule` con `['.env', '../../.env']`),
 * para que el secreto del webhook sea de verdad el mismo en los dos procesos.
 */
export function cargarEntorno(cwd: string = process.cwd()): void {
  config({ path: resolve(cwd, '.env') });
  config({ path: resolve(cwd, '..', '..', '.env') });
}
