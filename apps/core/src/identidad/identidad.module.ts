import { Module } from '@nestjs/common';

/**
 * Users, roles and authentication (tasks IDN-*). Its tables live in prisma/schema/identidad.prisma
 * and no other module may query them; share data by exporting a service from this module's index.ts.
 */
@Module({})
export class IdentidadModule {}
