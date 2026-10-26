import { Module } from '@nestjs/common';

/**
 * Clinical record: signed notes and their addenda (tasks HCL-*, sprint 3). Its tables go in
 * prisma/schema/historia.prisma and no other module may query them; share data by exporting
 * a service from this module's index.ts.
 */
@Module({})
export class HistoriaModule {}
