import { dirname, relative, resolve, sep } from 'node:path';

/**
 * Static checks behind the module-boundary rule. They read text, not types, so they are cheap
 * and run without a database; analisis.spec.ts shows each one catching what it should.
 */

export interface ModeloPrisma {
  nombre: string;
  /** The table name: @@map when present, the model name otherwise. */
  tabla: string;
  /** The schema file (and so the module) that declares it, without the extension. */
  modulo: string;
  campos: { nombre: string; tipo: string }[];
}

export function parseModelos(contenido: string, modulo: string): ModeloPrisma[] {
  const modelos: ModeloPrisma[] = [];
  for (const [, nombre, cuerpo] of contenido.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const lineas = cuerpo
      .split('\n')
      .map((linea) => linea.trim())
      .filter((linea) => linea !== '' && !linea.startsWith('//') && !linea.startsWith('@@'));
    modelos.push({
      nombre,
      tabla: /@@map\("([^"]+)"\)/.exec(cuerpo)?.[1] ?? nombre,
      modulo,
      campos: lineas.map((linea) => {
        const [campo, tipo] = linea.split(/\s+/);
        return { nombre: campo, tipo: tipo.replace(/[?[\]]/g, '') };
      }),
    });
  }
  return modelos;
}

/** A field typed as a model that another module declares is a relation across modules. */
export function relacionesEntreModulos(modelos: readonly ModeloPrisma[]): string[] {
  const duenos = new Map(modelos.map((modelo) => [modelo.nombre, modelo.modulo]));
  return modelos.flatMap((modelo) =>
    modelo.campos
      .filter((campo) => duenos.has(campo.tipo) && duenos.get(campo.tipo) !== modelo.modulo)
      .map(
        (campo) =>
          `${modelo.modulo}.prisma: ${modelo.nombre}.${campo.nombre} apunta a ${campo.tipo}, ` +
          `que es del módulo ${duenos.get(campo.tipo)}. Guarde solo su id.`,
      ),
  );
}

/** Drops comments so a mention in prose is not taken for a use. */
export function sinComentarios(fuente: string): string {
  return fuente.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
}

const METODOS_DE_DELEGADO = [
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy',
].join('|');

const USA_SQL_PROPIO = /\$(?:queryRaw|executeRaw)(?:Unsafe)?\b|Prisma\.(?:sql|raw)\b/;

/** Uses of tables that belong to other modules: through a Prisma delegate or through raw SQL. */
export function usosDeTablasAjenas(fuente: string, ajenos: readonly ModeloPrisma[]): string[] {
  const codigo = sinComentarios(fuente);
  const hallazgos: string[] = [];

  for (const modelo of ajenos) {
    const delegado = modelo.nombre.charAt(0).toLowerCase() + modelo.nombre.slice(1);
    // A method name after the delegate separates a real query from a plain property of that name.
    if (new RegExp(`\\.${delegado}\\s*\\.\\s*(?:${METODOS_DE_DELEGADO})\\b`).test(codigo)) {
      hallazgos.push(`consulta ${modelo.nombre}, del módulo ${modelo.modulo} (prisma.${delegado})`);
    }
  }

  if (USA_SQL_PROPIO.test(codigo)) {
    for (const modelo of ajenos) {
      if (new RegExp(`\\b${modelo.tabla}\\b`, 'i').test(codigo)) {
        hallazgos.push(`su SQL nombra la tabla ${modelo.tabla}, del módulo ${modelo.modulo}`);
      }
    }
  }
  return hallazgos;
}

/**
 * Relative imports that reach into another module's folder past its index.ts. A file in the
 * module itself, or in no module (app.module.ts, health, config), is judged the same way.
 */
export function importacionesProfundas(
  fuente: string,
  archivo: string,
  carpetaSrc: string,
  modulos: readonly string[],
): string[] {
  const propio = relative(carpetaSrc, archivo).split(sep)[0];
  const hallazgos: string[] = [];

  const patron = /(?:from|import\(|require\()\s*['"](\.{1,2}\/[^'"]*)['"]/g;
  for (const [, especificador] of sinComentarios(fuente).matchAll(patron)) {
    const [carpeta, ...resto] = relative(
      carpetaSrc,
      resolve(dirname(archivo), especificador),
    ).split(sep);
    const entraPorElIndice = resto.length === 0 || (resto.length === 1 && resto[0] === 'index');
    if (modulos.includes(carpeta) && carpeta !== propio && !entraPorElIndice) {
      hallazgos.push(`${especificador} entra al módulo ${carpeta} sin pasar por su index.ts`);
    }
  }
  return hallazgos;
}
