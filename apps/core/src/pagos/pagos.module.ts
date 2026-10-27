import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';
import { PagosService } from './pagos.service';
import { PasarelaClient } from './pasarela.client';

/**
 * Copago collection through the payment gateway: payment start and the signed webhook
 * (tasks PAG-*). Its tables go in prisma/schema/pagos.prisma and no other module may query them;
 * share data by exporting a service from this module's index.ts.
 */
@Module({
  providers: [
    {
      provide: PasarelaClient,
      useFactory: (config: ConfigService<Env, true>) =>
        new PasarelaClient({
          baseUrl: config.get('PASARELA_URL', { infer: true }),
          timeoutMs: config.get('PAGOS_TIMEOUT_MS', { infer: true }),
        }),
      inject: [ConfigService],
    },
    PagosService,
  ],
  exports: [PagosService],
})
export class PagosModule {}
