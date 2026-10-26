import { Module } from '@nestjs/common';

/**
 * Copago collection through the payment gateway: payment start and the signed webhook
 * (tasks PAG-*). Its tables go in prisma/schema/pagos.prisma and no other module may query them;
 * share data by exporting a service from this module's index.ts.
 */
@Module({})
export class PagosModule {}
