import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Runs before the imports below, so the app starts as it does when a developer runs it.
const previousNodeEnv = vi.hoisted(() => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'development';
  return previous;
});

import { sembrarTodo } from '../prisma/seed/index';
import { USUARIOS } from '../prisma/seed/identidad';
import { CABECERA_USUARIO_DEV } from '../src/identidad';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/app';
import { SondeoProtegidoController } from './helpers/sondeos';

describe('núcleo en desarrollo (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp([SondeoProtegidoController]);
    await sembrarTodo(app.get(PrismaService));
  });

  afterAll(async () => {
    await app.close();
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('serves the Swagger page', async () => {
    const response = await request(app.getHttpServer()).get('/docs').expect(200);

    expect(response.text).toContain('swagger-ui');
  });

  it('documents the health probe and the development header as the way to authenticate', async () => {
    const { body } = await request(app.getHttpServer()).get('/docs-json').expect(200);

    expect(Object.keys(body.paths)).toContain('/health');
    expect(body.components.securitySchemes['usuario-dev']).toMatchObject({
      type: 'apiKey',
      in: 'header',
      name: CABECERA_USUARIO_DEV,
    });
    expect(body.security).toContainEqual({ 'usuario-dev': [] });
  });

  it('accepts the development header', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/protegido')
      .set(CABECERA_USUARIO_DEV, USUARIOS[0].correo)
      .expect(200);

    expect(response.body.rol).toBe('PACIENTE');
  });
});
