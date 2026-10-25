import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Runs before the imports below, so the app starts as it would in a deployment.
const previousNodeEnv = vi.hoisted(() => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  return previous;
});

import { USUARIOS } from '../prisma/seed/identidad';
import { CABECERA_USUARIO_DEV } from '../src/identidad';
import { createTestApp } from './helpers/app';
import { SondeoProtegidoController } from './helpers/sondeos';

describe('núcleo en producción (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp([SondeoProtegidoController]);
  });

  afterAll(async () => {
    await app.close();
    process.env.NODE_ENV = previousNodeEnv;
  });

  it('ignores the development header: even a seeded user is denied', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/protegido')
      .set(CABECERA_USUARIO_DEV, USUARIOS[0].correo)
      .expect(401);

    expect(response.body.message).toBe('No autenticado');
  });

  it('answers the same without the header, so the header is not advertised', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/protegido').expect(401);

    expect(response.body.message).toBe('No autenticado');
  });

  it('keeps the health probe open', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('does not serve Swagger', async () => {
    await request(app.getHttpServer()).get('/docs').expect(404);
    await request(app.getHttpServer()).get('/docs-json').expect(404);
  });

  it('does not let the browser send the development header across origins', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/protegido')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', CABECERA_USUARIO_DEV.toLowerCase());

    expect(response.headers['access-control-allow-headers'] ?? '').not.toMatch(/x-usuario-dev/i);
  });
});
