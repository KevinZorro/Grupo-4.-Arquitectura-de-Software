import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AutenticacionDevGuard } from './autenticacion-dev.guard';
import { IdentidadService } from './identidad.service';

/**
 * Users, roles and authentication (tasks IDN-*). Its tables live in prisma/schema/identidad.prisma
 * and no other module may query them; share data by exporting a service from this module's index.ts.
 */
@Module({
  providers: [IdentidadService, { provide: APP_GUARD, useClass: AutenticacionDevGuard }],
  exports: [IdentidadService],
})
export class IdentidadModule {}
