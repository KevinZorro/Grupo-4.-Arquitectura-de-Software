import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  importacionesProfundas,
  parseModelos,
  relacionesEntreModulos,
  usosDeTablasAjenas,
} from './analisis';

/**
 * The core is a modular monolith in which no module queries another module's tables
 * (docs/vision.md §6, RNF-12). These tests turn that sentence into something CI can fail on.
 */

const RAIZ = join(__dirname, '..', '..');
const SRC = join(RAIZ, 'src');
const ESQUEMAS = join(RAIZ, 'prisma', 'schema');

/**
 * The domain modules. A new one is added here, with its folder under src/ and, once it has
 * tables, a prisma/schema/<name>.prisma of the same name.
 */
const MODULOS = ['agenda', 'autorizacion', 'historia', 'identidad', 'pagos'] as const;

/**
 * Folders under src/ that belong to no domain: they serve every module. One with tables keeps
 * them in a prisma/schema/<name>.prisma of its own, which the domain modules may not query.
 */
const INFRAESTRUCTURA = ['bandeja-salida', 'config', 'generated', 'health', 'prisma'];

function listar(carpeta: string, extension: string): string[] {
  return readdirSync(carpeta).flatMap((nombre) => {
    const ruta = join(carpeta, nombre);
    if (statSync(ruta).isDirectory()) {
      return nombre === 'generated' || nombre === 'node_modules' ? [] : listar(ruta, extension);
    }
    return ruta.endsWith(extension) ? [ruta] : [];
  });
}

const archivosDeEsquema = listar(ESQUEMAS, '.prisma').filter(
  (ruta) => basename(ruta) !== 'base.prisma',
);
const modelos = archivosDeEsquema.flatMap((ruta) =>
  parseModelos(readFileSync(ruta, 'utf8'), basename(ruta, '.prisma')),
);
const archivosDeCodigo = listar(SRC, '.ts');

const moduloDe = (ruta: string) => ruta.slice(SRC.length + 1).split('/')[0];

describe('límites entre módulos', () => {
  it('declares every folder under src/ as a domain module or as infrastructure', () => {
    const carpetas = readdirSync(SRC).filter((nombre) => statSync(join(SRC, nombre)).isDirectory());

    expect(
      carpetas.filter((c) => !MODULOS.some((m) => m === c) && !INFRAESTRUCTURA.includes(c)),
    ).toEqual([]);
  });

  it.each(MODULOS)('gives %s its own module class and an index.ts to enter through', (modulo) => {
    expect(existsSync(join(SRC, modulo, `${modulo}.module.ts`))).toBe(true);
    expect(existsSync(join(SRC, modulo, 'index.ts'))).toBe(true);
  });

  it('registers every domain module in AppModule', () => {
    const appModule = readFileSync(join(SRC, 'app.module.ts'), 'utf8');

    for (const modulo of MODULOS) {
      const clase = `${modulo.charAt(0).toUpperCase()}${modulo.slice(1)}Module`;
      expect(appModule, `${clase} falta en AppModule`).toContain(clase);
    }
  });

  describe('schema', () => {
    it('keeps one .prisma file per module, named after it', () => {
      const nombres = archivosDeEsquema.map((ruta) => basename(ruta, '.prisma'));

      expect(
        nombres.filter(
          (nombre) => !MODULOS.some((m) => m === nombre) && !INFRAESTRUCTURA.includes(nombre),
        ),
      ).toEqual([]);
    });

    it('has no relation from a model to a model of another module', () => {
      expect(relacionesEntreModulos(modelos)).toEqual([]);
    });
  });

  describe.each(MODULOS)('%s', (modulo) => {
    const ajenos = modelos.filter((modelo) => modelo.modulo !== modulo);
    const suyos = archivosDeCodigo.filter((ruta) => moduloDe(ruta) === modulo);

    it('queries only its own tables', () => {
      const infracciones = suyos.flatMap((ruta) =>
        usosDeTablasAjenas(readFileSync(ruta, 'utf8'), ajenos).map(
          (hallazgo) => `${ruta.slice(RAIZ.length + 1)}: ${hallazgo}`,
        ),
      );

      expect(infracciones).toEqual([]);
    });
  });

  it('enters every module only through its index.ts', () => {
    const infracciones = archivosDeCodigo.flatMap((ruta) =>
      importacionesProfundas(readFileSync(ruta, 'utf8'), ruta, SRC, MODULOS).map(
        (hallazgo) => `${ruta.slice(RAIZ.length + 1)}: ${hallazgo}`,
      ),
    );

    expect(infracciones).toEqual([]);
  });
});
