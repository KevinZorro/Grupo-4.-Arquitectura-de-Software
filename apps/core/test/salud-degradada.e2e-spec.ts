import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Runs before the imports below, so the app reads an unreachable database from the start.
// Nothing listens on port 1, so every connection is refused at once.
const originalUrl = vi.hoisted(() => {
  const previous = process.env.CORE_DATABASE_URL;
  process.env.CORE_DATABASE_URL = 'postgresql://core:invalida@127.0.0.1:1/core_db';
  return previous;
});

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

describe('núcleo con la base caída (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (originalUrl === undefined) {
      delete process.env.CORE_DATABASE_URL;
    } else {
      process.env.CORE_DATABASE_URL = originalUrl;
    }
  });

  it('still starts, and GET /health answers 503 with the degraded state', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(503);

    expect(response.body).toEqual({ estado: 'degradado', base: 'caida' });
  });
});
