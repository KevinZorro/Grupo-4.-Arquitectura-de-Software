import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sembrarTodo } from '../prisma/seed/index';
import { PACIENTES, USUARIOS } from '../prisma/seed/identidad';
import { PROFESIONALES } from '../prisma/seed/agenda';
import { CABECERA_USUARIO_DEV } from '../src/identidad';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/app';
import { SondeoMalUsoController, SondeoProtegidoController } from './helpers/sondeos';

const ANA = USUARIOS[0];
const LUIS = USUARIOS[1];
const LAURA = USUARIOS[6];

describe('identificación de desarrollo (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp([SondeoProtegidoController, SondeoMalUsoController]);
    prisma = app.get(PrismaService);
    await sembrarTodo(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  const protegido = (correo?: string) => {
    const call = request(app.getHttpServer()).get('/api/v1/protegido');
    return correo === undefined ? call : call.set(CABECERA_USUARIO_DEV, correo);
  };

  it('denies a route that is not @Publico() when nobody identifies', async () => {
    const response = await protegido().expect(401);

    expect(response.body.message).toContain(CABECERA_USUARIO_DEV);
  });

  it('denies a correo that is not a seeded user', async () => {
    await protegido('nadie@ejemplo.test').expect(401);
  });

  it('identifies a patient by the correo in the header', async () => {
    const response = await protegido(ANA.correo).expect(200);

    expect(response.body).toEqual({
      id: ANA.id,
      correo: ANA.correo,
      nombre: 'Ana Lucía Pérez Gómez',
      rol: 'PACIENTE',
      pacienteId: PACIENTES[0].id,
      profesionalId: null,
    });
  });

  it('identifies a profesional, who carries a profesionalId and no pacienteId', async () => {
    const response = await protegido(LAURA.correo).expect(200);

    expect(response.body).toMatchObject({
      rol: 'PROFESIONAL',
      pacienteId: null,
      profesionalId: PROFESIONALES[0].id,
    });
  });

  it('ignores the case of the correo', async () => {
    await protegido('ANA.Perez@Ejemplo.TEST').expect(200);
  });

  it('denies a user that was deactivated', async () => {
    await prisma.usuario.update({ where: { id: LUIS.id }, data: { activo: false } });
    try {
      await protegido(LUIS.correo).expect(401);
    } finally {
      await prisma.usuario.update({ where: { id: LUIS.id }, data: { activo: true } });
    }
    await protegido(LUIS.correo).expect(200);
  });

  it('keeps public routes open: the health probe needs no user', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('answers 401 when a public route asks for the current user', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/mal-uso')
      .set(CABECERA_USUARIO_DEV, ANA.correo)
      .expect(401);
  });

  it('lets the browser send the development header across origins', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/v1/protegido')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', CABECERA_USUARIO_DEV.toLowerCase())
      .expect(204);

    expect(response.headers['access-control-allow-headers']).toMatch(/x-usuario-dev/i);
  });
});
