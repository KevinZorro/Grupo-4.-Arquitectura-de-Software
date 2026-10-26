import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';
import { PrismaClient } from '../src/generated/prisma/client';
import { sembrarTodo } from './seed/index';
import { ESPECIALIDADES, PROFESIONALES, SEDES } from './seed/agenda';
import { PACIENTES, USUARIOS } from './seed/identidad';
import { assertSeedAllowed } from './seed/entorno';

// `prisma db seed` already passes the environment on; this also lets the file run on its own.
config({ path: ['.env', '../../.env'], quiet: true });

async function main(): Promise<void> {
  assertSeedAllowed(process.env.NODE_ENV);
  const connectionString = process.env.CORE_DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      'Falta CORE_DATABASE_URL: copie .env.example a .env en la raíz del repositorio.',
    );
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await sembrarTodo(prisma);
  } finally {
    await prisma.$disconnect();
  }
  console.log(
    `Semilla aplicada: ${SEDES.length} sedes, ${ESPECIALIDADES.length} especialidades, ` +
      `${PROFESIONALES.length} profesionales, ${PACIENTES.length} pacientes y ` +
      `${USUARIOS.length} usuarios.`,
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
