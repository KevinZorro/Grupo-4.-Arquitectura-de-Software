import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  importacionesProfundas,
  parseModelos,
  relacionesEntreModulos,
  sinComentarios,
  usosDeTablasAjenas,
} from './analisis';

const AGENDA = `
model Sede {
  id     String @id
  nombre String
  @@map("sede")
}

model Profesional {
  id             String       @id
  especialidadId String
  especialidad   Especialidad @relation(fields: [especialidadId], references: [id])
  @@map("profesional")
}

model Especialidad {
  id            String        @id
  profesionales Profesional[]
}
`;

const IDENTIDAD = `
model Usuario {
  id            String   @id
  // Plain id on purpose.
  profesionalId String?
  paciente      Paciente? @relation(fields: [pacienteId], references: [id])
  pacienteId    String?
  @@map("usuario")
}

model Paciente {
  id      String   @id
  usuario Usuario?
  @@map("paciente")
}
`;

const modelos = [...parseModelos(AGENDA, 'agenda'), ...parseModelos(IDENTIDAD, 'identidad')];
const deIdentidad = modelos.filter((m) => m.modulo === 'identidad');
const deAgenda = modelos.filter((m) => m.modulo === 'agenda');

describe('parseModelos', () => {
  it('reads models, their table names and the types of their fields', () => {
    const profesional = deAgenda.find((m) => m.nombre === 'Profesional');

    expect(profesional?.tabla).toBe('profesional');
    expect(profesional?.campos).toContainEqual({ nombre: 'especialidad', tipo: 'Especialidad' });
  });

  it('uses the model name as table when there is no @@map', () => {
    expect(deAgenda.find((m) => m.nombre === 'Especialidad')?.tabla).toBe('Especialidad');
  });

  it('strips ? and [] from types and skips comments and attributes', () => {
    const tipos = deIdentidad.find((m) => m.nombre === 'Usuario')?.campos.map((c) => c.tipo);

    expect(tipos).toEqual(['String', 'String', 'Paciente', 'String']);
  });
});

describe('relacionesEntreModulos', () => {
  it('accepts relations that stay inside one module', () => {
    expect(relacionesEntreModulos(modelos)).toEqual([]);
  });

  it('flags a field typed as a model of another module', () => {
    const roto = parseModelos(
      'model Cita {\n  id String @id\n  profesional Profesional\n}\n',
      'pagos',
    );

    const hallazgos = relacionesEntreModulos([...modelos, ...roto]);

    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0]).toContain('Cita.profesional');
    expect(hallazgos[0]).toContain('agenda');
  });
});

describe('usosDeTablasAjenas', () => {
  it('flags a Prisma delegate of a table that belongs to another module', () => {
    const fuente = 'return this.prisma.paciente.findMany({ where: { id } });';

    const hallazgos = usosDeTablasAjenas(fuente, deIdentidad);

    expect(hallazgos).toHaveLength(1);
    expect(hallazgos[0]).toContain('Paciente');
    expect(hallazgos[0]).toContain('identidad');
  });

  it('also catches it inside a transaction callback', () => {
    expect(usosDeTablasAjenas('await tx.usuario.update({ data })', deIdentidad)).toHaveLength(1);
  });

  it('leaves alone a table the module owns', () => {
    expect(usosDeTablasAjenas('this.prisma.sede.findMany()', deIdentidad)).toEqual([]);
  });

  it('does not confuse a plain property with a query', () => {
    expect(usosDeTablasAjenas('return cita.paciente.nombres;', deIdentidad)).toEqual([]);
  });

  it('ignores a mention in a comment', () => {
    const fuente = '// never call prisma.paciente.findMany() from here\nconst x = 1;';

    expect(usosDeTablasAjenas(fuente, deIdentidad)).toEqual([]);
  });

  it('flags raw SQL that names a table of another module', () => {
    const fuente = 'await this.prisma.$queryRaw`SELECT * FROM usuario WHERE id = ${id}`;';

    expect(usosDeTablasAjenas(fuente, deIdentidad)).toHaveLength(1);
  });

  it('lets raw SQL on the own tables through', () => {
    const fuente = 'await this.prisma.$queryRaw`SELECT count(*) FROM sede`;';

    expect(usosDeTablasAjenas(fuente, deIdentidad)).toEqual([]);
  });
});

describe('importacionesProfundas', () => {
  const src = join('/repo', 'src');
  const modulos = ['agenda', 'identidad'];
  const desdeAgenda = join(src, 'agenda', 'agenda.service.ts');

  it('flags an import that reaches past the index.ts of another module', () => {
    const fuente = "import { IdentidadService } from '../identidad/identidad.service';";

    expect(importacionesProfundas(fuente, desdeAgenda, src, modulos)).toHaveLength(1);
  });

  it('accepts the module folder and its index', () => {
    const fuente = "import { A } from '../identidad';\nimport { B } from '../identidad/index';";

    expect(importacionesProfundas(fuente, desdeAgenda, src, modulos)).toEqual([]);
  });

  it('accepts imports inside the same module', () => {
    const fuente = "import { X } from './franja.repository';\nimport { Y } from '../agenda/y';";

    expect(importacionesProfundas(fuente, desdeAgenda, src, modulos)).toEqual([]);
  });

  it('judges files that belong to no module the same way', () => {
    const desdeLaRaiz = join(src, 'app.setup.ts');

    expect(
      importacionesProfundas("import { G } from './identidad/guard';", desdeLaRaiz, src, modulos),
    ).toHaveLength(1);
    expect(
      importacionesProfundas("import { I } from './identidad';", desdeLaRaiz, src, modulos),
    ).toEqual([]);
  });

  it('ignores packages and infrastructure folders', () => {
    const fuente =
      "import { Module } from '@nestjs/common';\nimport { P } from '../prisma/prisma.service';";

    expect(importacionesProfundas(fuente, desdeAgenda, src, modulos)).toEqual([]);
  });
});

describe('sinComentarios', () => {
  it('keeps URLs inside strings', () => {
    expect(sinComentarios("const u = 'postgresql://core@db'; // nota")).toContain(
      'postgresql://core@db',
    );
  });
});
