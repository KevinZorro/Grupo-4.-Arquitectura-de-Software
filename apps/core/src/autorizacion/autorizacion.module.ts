import { Module } from '@nestjs/common';

/**
 * Access decisions by care link, denying by default (tasks AUT-*, sprint 2). Its tables go in
 * prisma/schema/autorizacion.prisma and no other module may query them; share data by exporting
 * a service from this module's index.ts.
 */
@Module({})
export class AutorizacionModule {}
