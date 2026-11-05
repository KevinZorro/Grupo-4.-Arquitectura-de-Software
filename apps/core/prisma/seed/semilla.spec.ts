import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ESPECIALIDADES, franjasDeLaSemilla, PROFESIONALES, SEDES } from './agenda';
import { assertSeedAllowed } from './entorno';
import { forUpdate, seedId } from './ids';
import { DOMINIO_FICTICIO, PACIENTES, USUARIOS } from './identidad';

const ids = (rows: readonly { id: string }[]) => rows.map((row) => row.id);
const isUnique = (values: readonly string[]) => new Set(values).size === values.length;

describe('seedId', () => {
  it('builds a valid, readable UUID from the kind and the number', () => {
    expect(seedId('sede', 3)).toBe('00000000-0000-4000-8001-000000000003');
    expect(z.uuid().safeParse(seedId('usuario', 13)).success).toBe(true);
  });

  it('does not repeat across kinds or numbers', () => {
    expect(seedId('sede', 1)).not.toBe(seedId('especialidad', 1));
    expect(seedId('sede', 1)).not.toBe(seedId('sede', 2));
  });
});

describe('forUpdate', () => {
  it('keeps the data but never carries the primary key', () => {
    expect(forUpdate({ id: 'a', nombre: 'x' })).toEqual({ id: undefined, nombre: 'x' });
  });
});

describe('assertSeedAllowed', () => {
  it('refuses to run in production', () => {
    expect(() => assertSeedAllowed('production')).toThrow(/NODE_ENV=production/);
  });

  it.each(['development', 'test', undefined])('allows NODE_ENV=%s', (nodeEnv) => {
    expect(() => assertSeedAllowed(nodeEnv)).not.toThrow();
  });
});

describe('seed data', () => {
  it('has the 12 sedes of the network', () => {
    expect(SEDES).toHaveLength(12);
    expect(isUnique(SEDES.map((sede) => sede.nombre))).toBe(true);
  });

  it('uses unique, valid ids in every table', () => {
    for (const table of [SEDES, ESPECIALIDADES, PROFESIONALES, PACIENTES, USUARIOS]) {
      expect(isUnique(ids(table))).toBe(true);
      expect(ids(table).every((id) => z.uuid().safeParse(id).success)).toBe(true);
    }
  });

  it('gives every profesional a real especialidad and a unique registry number', () => {
    const especialidadIds = new Set(ids(ESPECIALIDADES));
    expect(PROFESIONALES.every((p) => especialidadIds.has(p.especialidadId))).toBe(true);
    expect(isUnique(PROFESIONALES.map((p) => p.registroProfesional))).toBe(true);
  });

  it('has at least one profesional for every especialidad', () => {
    const covered = new Set(PROFESIONALES.map((p) => p.especialidadId));
    expect(ESPECIALIDADES.every((e) => covered.has(e.id))).toBe(true);
  });

  describe('is made up, never real', () => {
    it('keeps every mailbox in the reserved .test domain, in lowercase', () => {
      for (const { correo } of USUARIOS) {
        expect(correo).toBe(correo.toLowerCase());
        expect(correo.endsWith(`@${DOMINIO_FICTICIO}`)).toBe(true);
      }
      expect(DOMINIO_FICTICIO.endsWith('.test')).toBe(true);
    });

    it('keeps every document number in the 9xxxxxxxxx range reserved for fakes', () => {
      expect(PACIENTES.every((p) => /^9\d{9}$/.test(p.numeroDocumento))).toBe(true);
    });
  });

  describe('users', () => {
    it('has a unique correo each', () => {
      expect(isUnique(USUARIOS.map((u) => u.correo))).toBe(true);
    });

    it('covers the four roles', () => {
      expect(new Set(USUARIOS.map((u) => u.rol))).toEqual(
        new Set(['PACIENTE', 'PROFESIONAL', 'ADMINISTRATIVO', 'AUDITOR']),
      );
    });

    it('links each role to the right person and nobody else', () => {
      const pacienteIds = new Set(ids(PACIENTES));
      const profesionalIds = new Set(ids(PROFESIONALES));
      for (const usuario of USUARIOS) {
        const paciente = usuario.pacienteId ?? null;
        const profesional = usuario.profesionalId ?? null;
        expect(paciente !== null && pacienteIds.has(paciente)).toBe(usuario.rol === 'PACIENTE');
        expect(profesional !== null && profesionalIds.has(profesional)).toBe(
          usuario.rol === 'PROFESIONAL',
        );
      }
    });

    it('gives each patient and each profesional at most one user', () => {
      const linked = USUARIOS.flatMap((u) => [u.pacienteId, u.profesionalId]).filter(
        (id): id is string => typeof id === 'string',
      );
      expect(isUnique(linked)).toBe(true);
    });
  });
});

describe('franjasDeLaSemilla', () => {
  // A Friday evening in Colombia, already Saturday in UTC: the agenda must still start on Saturday's
  // Colombian date and skip that weekend.
  const HOY = new Date('2026-10-31T02:00:00.000Z');
  const franjas = franjasDeLaSemilla(HOY);

  it('covers the weekdays of the next two weeks, starting tomorrow', () => {
    const dias = new Set(franjas.map((f) => new Date(f.iniciaEn).toISOString().slice(0, 10)));

    expect([...dias].sort()).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
      '2026-11-05',
      '2026-11-06',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
    ]);
  });

  it('stores the Colombian 8:00 a.m. as 13:00 UTC and lasts 30 minutes', () => {
    const primera = franjas[0];

    expect(new Date(primera.iniciaEn).toISOString()).toBe('2026-11-02T13:00:00.000Z');
    expect(new Date(primera.terminaEn).getTime() - new Date(primera.iniciaEn).getTime()).toBe(
      30 * 60_000,
    );
  });

  it('never repeats a profesional at the same start, so the seed can run again', () => {
    expect(isUnique(franjas.map((f) => `${f.profesionalId}@${String(f.iniciaEn)}`))).toBe(true);
  });

  it('offers both modalidades for every especialidad, at real sedes', () => {
    const sedeIds = new Set(ids(SEDES));
    const especialidadDe = new Map(PROFESIONALES.map((p) => [p.id, p.especialidadId]));

    expect(franjas.every((f) => sedeIds.has(f.sedeId))).toBe(true);
    for (const modalidad of ['PRESENCIAL', 'VIRTUAL']) {
      const cubiertas = new Set(
        franjas
          .filter((f) => f.modalidad === modalidad)
          .map((f) => especialidadDe.get(f.profesionalId)),
      );
      expect(cubiertas.size).toBe(ESPECIALIDADES.length);
    }
  });
});
