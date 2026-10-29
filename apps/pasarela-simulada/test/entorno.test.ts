import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { cargarEntorno } from '../src/entorno';

const temporales: string[] = [];
const variables: string[] = [];

/** Crea un repo de mentira: `<raiz>/.env` y `<raiz>/apps/pasarela-simulada/.env`. */
async function crearArbol(contenidoRaiz: string, contenidoApp: string): Promise<string> {
  const raiz = await mkdtemp(join(tmpdir(), 'pasarela-entorno-'));
  temporales.push(raiz);

  const app = join(raiz, 'apps', 'pasarela-simulada');
  await mkdir(app, { recursive: true });
  await writeFile(join(raiz, '.env'), contenidoRaiz, 'utf8');
  await writeFile(join(app, '.env'), contenidoApp, 'utf8');

  return app;
}

function usar(nombre: string): string {
  delete process.env[nombre];
  variables.push(nombre);
  return nombre;
}

afterEach(async () => {
  for (const nombre of variables.splice(0)) {
    delete process.env[nombre];
  }
  await Promise.all(temporales.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('carga del .env', () => {
  it('lee el .env de la app y el de la raíz del monorepo', async () => {
    const deLaApp = usar('PASARELA_PRUEBA_APP');
    const deLaRaiz = usar('PASARELA_PRUEBA_RAIZ');

    const app = await crearArbol(`${deLaRaiz}=desde-la-raiz\n`, `${deLaApp}=desde-la-app\n`);

    cargarEntorno(app);

    expect(process.env[deLaApp]).toBe('desde-la-app');
    expect(process.env[deLaRaiz]).toBe('desde-la-raiz');
  });

  it('no pisa una variable que ya existe en el entorno', async () => {
    const nombre = usar('PASARELA_PRUEBA_REAL');
    process.env[nombre] = 'valor-real';

    const app = await crearArbol('', `${nombre}=desde-el-archivo\n`);

    cargarEntorno(app);

    expect(process.env[nombre]).toBe('valor-real');
  });

  it('no falla si no hay ningún .env', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'pasarela-sin-env-'));
    temporales.push(raiz);

    expect(() => cargarEntorno(raiz)).not.toThrow();
  });
});
