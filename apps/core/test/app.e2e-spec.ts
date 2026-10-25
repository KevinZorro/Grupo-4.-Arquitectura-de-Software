import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from './helpers/app';
import {
  SondeoInternoController,
  SondeoPublicoController,
  SondeoValidacionController,
} from './helpers/sondeos';

describe('núcleo (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp([
      SondeoPublicoController,
      SondeoInternoController,
      SondeoValidacionController,
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('reports the state of the database, with no user', async () => {
      const response = await request(app.getHttpServer()).get('/health').expect(200);

      expect(response.body).toEqual({ estado: 'ok', base: 'ok' });
    });

    it('lives outside the API prefix', async () => {
      await request(app.getHttpServer()).get('/api/v1/health').expect(404);
    });
  });

  describe('global prefix', () => {
    it('puts ordinary routes under /api/v1', async () => {
      await request(app.getHttpServer()).get('/api/v1/sondeo').expect(200);
      await request(app.getHttpServer()).get('/sondeo').expect(404);
    });

    it('leaves the adapters contract under /internal/v1 without it', async () => {
      await request(app.getHttpServer()).get('/internal/v1/sondeo').expect(200);
      await request(app.getHttpServer()).get('/api/v1/internal/v1/sondeo').expect(404);
    });
  });

  describe('validación de la entrada con zod', () => {
    const valido = { franjaId: '00000000-0000-4000-8000-000000000001', modalidad: 'VIRTUAL' };
    const enviar = (cuerpo: object) =>
      request(app.getHttpServer()).post('/api/v1/sondeo-validacion').send(cuerpo);

    it('lets a body that matches its schema through', async () => {
      const response = await enviar(valido).expect(201);

      expect(response.body).toEqual(valido);
    });

    it('answers 400 and names the field that does not match', async () => {
      const response = await enviar({ ...valido, franjaId: 'no-es-un-uuid' }).expect(400);

      expect(JSON.stringify(response.body.message)).toContain('franjaId');
    });

    it('answers 400 when a field is missing', async () => {
      await enviar({ franjaId: valido.franjaId }).expect(400);
    });

    it('answers 400 on a field the schema does not know (strictObject)', async () => {
      await enviar({ ...valido, rol: 'AUDITOR' }).expect(400);
    });
  });

  it('does not serve Swagger outside development', async () => {
    await request(app.getHttpServer()).get('/docs').expect(404);
    await request(app.getHttpServer()).get('/docs-json').expect(404);
  });

  describe('CORS', () => {
    it('answers the preflight of a configured origin, including Idempotency-Key', async () => {
      const response = await request(app.getHttpServer())
        .options('/api/v1/sondeo')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'content-type,idempotency-key')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
      expect(response.headers['access-control-allow-headers']).toMatch(/idempotency-key/i);
    });

    it('stays silent for an origin that is not configured', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/sondeo')
        .set('Origin', 'https://otro.ejemplo.test');

      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
