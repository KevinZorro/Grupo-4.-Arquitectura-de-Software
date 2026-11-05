import { Module } from '@nestjs/common';
import { CitasController } from './citas.controller';
import { CitasService } from './citas.service';
import { EstadoCitasService } from './estado-citas.service';
import { FranjasController } from './franjas.controller';
import { FranjasService } from './franjas.service';

/**
 * Scheduling: sedes, especialidades, profesionales, franjas and citas (tasks AGE-*).
 * Its tables live in prisma/schema/agenda.prisma and no other module may query them;
 * share data by exporting a service from this module's index.ts.
 *
 * It does not provide INICIADOR_PAGO nor BANDEJA_SALIDA: their owners export them from a global
 * module (see puertos.ts).
 */
@Module({
  controllers: [FranjasController, CitasController],
  providers: [FranjasService, CitasService, EstadoCitasService],
  exports: [EstadoCitasService],
})
export class AgendaModule {}
