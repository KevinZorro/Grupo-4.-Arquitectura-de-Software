import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import type { Env } from '../config/env';
import { PrismaClient } from '../generated/prisma/client';

/** A pool that cannot reach the database gives up after this long instead of hanging the request. */
const CONNECTION_TIMEOUT_MS = 5_000;

/**
 * The only door to the core database. Prisma connects lazily, so the app still starts when
 * PostgreSQL is down and GET /health reports it.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('CORE_DATABASE_URL', { infer: true }),
        connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
      }),
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
