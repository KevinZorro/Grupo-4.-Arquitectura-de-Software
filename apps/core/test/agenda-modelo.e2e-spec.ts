import { randomUUID } from 'node:crypto';
import { PrismaPg } from '@prisma/adapter-pg';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PACIENTES } from '../prisma/seed/identidad';
import { sembrarTodo } from '../prisma/seed/index';
import { PrismaClient } from '../src/generated/prisma/client';

/** The rules AGE-1 leaves to the database, checked against the real schema. */
describe('modelo de franja y cita (e2e)', () => {
  let prisma: PrismaClient;
  let franjaId: string;

  const cita = (pacienteId: string, estado: 'PENDIENTE_PAGO' | 'CANCELADA') =>
    prisma.cita.create({
      data: { franjaId, pacienteId, estado, claveIdempotencia: randomUUID() },
    });

  beforeAll(async () => {
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: process.env.CORE_DATABASE_URL }),
    });
    await sembrarTodo(prisma);
  });

  beforeEach(async () => {
    // A franja of its own, a year ahead, so no other test or seeded cita gets in the way.
    const plantilla = await prisma.franja.findFirstOrThrow();
    const iniciaEn = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 + Math.random() * 1e9);
    ({ id: franjaId } = await prisma.franja.create({
      data: {
        profesionalId: plantilla.profesionalId,
        sedeId: plantilla.sedeId,
        modalidad: 'VIRTUAL',
        iniciaEn,
        terminaEn: new Date(iniciaEn.getTime() + 30 * 60_000),
      },
    }));
  });

  afterEach(async () => {
    await prisma.cita.deleteMany({ where: { franjaId } });
    await prisma.franja.delete({ where: { id: franjaId } });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('lets a franja hold only one cita that is not cancelled', async () => {
    await cita(PACIENTES[0].id, 'PENDIENTE_PAGO');

    await expect(cita(PACIENTES[1].id, 'PENDIENTE_PAGO')).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('frees the franja once its cita is cancelled', async () => {
    await cita(PACIENTES[0].id, 'CANCELADA');

    await expect(cita(PACIENTES[1].id, 'PENDIENTE_PAGO')).resolves.toMatchObject({
      estado: 'PENDIENTE_PAGO',
    });
  });

  it('refuses a franja that ends before it starts', async () => {
    const franja = await prisma.franja.findUniqueOrThrow({ where: { id: franjaId } });

    await expect(
      prisma.franja.update({ where: { id: franjaId }, data: { terminaEn: franja.iniciaEn } }),
    ).rejects.toThrow();
  });

  it('stores instants in UTC, whatever the session time zone', async () => {
    const [{ zona }] = await prisma.$queryRaw<{ zona: string }[]>`
      SELECT data_type AS zona FROM information_schema.columns
      WHERE table_name = 'franja' AND column_name = 'inicia_en'`;

    expect(zona).toBe('timestamp with time zone');
  });
});
