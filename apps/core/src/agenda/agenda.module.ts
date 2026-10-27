import { Module } from '@nestjs/common';
import { CitasController } from './citas.controller';
import { CitasService } from './citas.service';
import { FranjasController } from './franjas.controller';
import { FranjasService } from './franjas.service';

/**
 * Scheduling: sedes, especialidades, profesionales, franjas and citas (tasks AGE-*).
 * Its tables live in prisma/schema/agenda.prisma and no other module may query them;
 * share data by exporting a service from this module's index.ts.
 */
@Module({
  controllers: [FranjasController, CitasController],
  providers: [FranjasService, CitasService],
})
export class AgendaModule {}
