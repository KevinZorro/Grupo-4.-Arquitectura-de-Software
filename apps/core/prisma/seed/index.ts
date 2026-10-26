import type { PrismaClient } from '../../src/generated/prisma/client';
import { sembrarAgenda } from './agenda';
import { sembrarIdentidad } from './identidad';

/**
 * Seeds every module in dependency order. A task that adds seed data adds its own file here
 * (prisma/seed/<module>.ts) and one line below, after the modules it points at.
 */
export async function sembrarTodo(prisma: PrismaClient): Promise<void> {
  await sembrarAgenda(prisma);
  await sembrarIdentidad(prisma);
}
