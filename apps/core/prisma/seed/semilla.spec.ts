import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ESPECIALIDADES, PROFESIONALES, SEDES } from './agenda';
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
