import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '../src/generated/prisma/client';
import { ESPECIALIDADES, PROFESIONALES, SEDES } from '../prisma/seed/agenda';
import { PACIENTES, USUARIOS } from '../prisma/seed/identidad';
import { sembrarTodo } from '../prisma/seed/index';

async function contar(prisma: PrismaClient) {
  const [sedes, especialidades, profesionales, pacientes, usuarios] = await Promise.all([
    prisma.sede.count(),
    prisma.especialidad.count(),
    prisma.profesional.count(),
    prisma.paciente.count(),
    prisma.usuario.count(),
  ]);
  return { sedes, especialidades, profesionales, pacientes, usuarios };
}

describe('semilla de catálogos (e2e)', () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const connectionString = process.env.CORE_DATABASE_URL;
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
    await sembrarTodo(prisma);
  });

  afterAll(async () => {
    await sembrarTodo(prisma);
    await prisma.$disconnect();
  });

  it('loads the 12 sedes and the made-up catalog', async () => {
    expect(await contar(prisma)).toEqual({
      sedes: 12,
      especialidades: ESPECIALIDADES.length,
      profesionales: PROFESIONALES.length,
      pacientes: PACIENTES.length,
      usuarios: USUARIOS.length,
    });
  });

  it('is idempotent: running it again changes no count', async () => {
    const before = await contar(prisma);

    await sembrarTodo(prisma);

    expect(await contar(prisma)).toEqual(before);
  });

  it('restores a seeded row that someone edited', async () => {
    const sede = SEDES[0];
    await prisma.sede.update({ where: { id: sede.id }, data: { nombre: 'Editada a mano' } });

    await sembrarTodo(prisma);

    expect((await prisma.sede.findUniqueOrThrow({ where: { id: sede.id } })).nombre).toBe(
      sede.nombre,
    );
  });

  it('links each patient user to its patient inside the identity tables', async () => {
    const usuario = await prisma.usuario.findUniqueOrThrow({
      where: { correo: 'ana.perez@ejemplo.test' },
      include: { paciente: true },
    });

    expect(usuario.rol).toBe('PACIENTE');
    expect(usuario.paciente?.nombres).toBe('Ana Lucía');
  });

  it('refuses to delete a patient who has a user', async () => {
    await expect(prisma.paciente.delete({ where: { id: PACIENTES[0].id } })).rejects.toThrow();
  });
});
