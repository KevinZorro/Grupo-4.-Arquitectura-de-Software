import { Module } from '@nestjs/common';

/**
 * Scheduling: sedes, especialidades, profesionales, franjas and citas (tasks AGE-*).
 * Its tables live in prisma/schema/agenda.prisma and no other module may query them;
 * share data by exporting a service from this module's index.ts.
 */
@Module({})
export class AgendaModule {}
