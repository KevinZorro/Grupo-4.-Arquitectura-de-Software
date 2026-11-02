import { Global, Module } from '@nestjs/common';
import { BandejaSalidaService } from './bandeja-salida.service';
import { PublicadorPendientes } from './publicador-pendientes';

/**
 * Outbox of the core (ADR-001, EVT-3). Global, like Prisma, because every module that changes the
 * state of a cita stores its event here; only this folder queries the evento_saliente table.
 */
@Global()
@Module({
  providers: [BandejaSalidaService, PublicadorPendientes],
  exports: [BandejaSalidaService],
})
export class BandejaSalidaModule {}
