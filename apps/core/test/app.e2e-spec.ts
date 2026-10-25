import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

// Stand-ins for routes that later tasks will add, to prove where the global prefix applies.
@Controller('sondeo')
class ApiProbeController {
  @Get()
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

@Controller('internal/v1/sondeo')
class InternalProbeController {
  @Get()
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

describe('núcleo (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ApiProbeController, InternalProbeController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /health', () => {
    it('reports the state of the database', async () => {
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
