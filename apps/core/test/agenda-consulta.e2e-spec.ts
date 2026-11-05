import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ESPECIALIDADES, PROFESIONALES, SEDES } from '../prisma/seed/agenda';
import { PACIENTES, USUARIOS } from '../prisma/seed/identidad';
import { sembrarTodo } from '../prisma/seed/index';
import { CABECERA_USUARIO_DEV } from '../src/identidad';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/app';
import { FranjasDePrueba } from './helpers/agenda';

const ANA = USUARIOS[0];
const LUIS = USUARIOS[1];
const PROFESIONAL = USUARIOS.find((u) => u.rol === 'PROFESIONAL')!;

describe('consulta de franjas y de mis citas (e2e)', () => {
  let app: INestApplication;
  let franjas: FranjasDePrueba;
  let libre: string;
  let presencial: string;
  let tomada: string;
  let liberada: string;
  let deOtroProfesional: string;

  const get = (ruta: string, correo = ANA.correo) =>
    request(app.getHttpServer()).get(`/api/v1/${ruta}`).set(CABECERA_USUARIO_DEV, correo);

  const idsDe = (body: { id: string }[]) => body.map((franja) => franja.id);

  beforeAll(async () => {
    app = await createTestApp();
    const prisma = app.get(PrismaService);
    await sembrarTodo(prisma);

    franjas = new FranjasDePrueba(prisma);
    libre = await franjas.crear();
    presencial = await franjas.crear({ modalidad: 'PRESENCIAL', sedeId: SEDES[1].id });
    tomada = await franjas.crear();
    liberada = await franjas.crear();
    // PROFESIONALES[2] is in another especialidad (pediatría).
    deOtroProfesional = await franjas.crear({ profesionalId: PROFESIONALES[2].id });
    await franjas.citar(tomada, PACIENTES[1].id, 'PENDIENTE_PAGO');
    await franjas.citar(liberada, PACIENTES[1].id, 'CANCELADA');
    await franjas.citar(libre, PACIENTES[0].id, 'CANCELADA');
  });

  afterAll(async () => {
    await franjas.limpiar();
    await app.close();
  });

  describe('GET /api/v1/franjas', () => {
    it('lists the free franjas of the day: one held by a live cita is gone, a cancelled one is back', async () => {
      const { body } = await get(`franjas?fecha=${franjas.fecha}`).expect(200);

      expect(idsDe(body)).toEqual([libre, presencial, liberada, deOtroProfesional]);
    });

    it('shows the sede, the profesional and the especialidad, with instants in UTC', async () => {
      const { body } = await get(`franjas?fecha=${franjas.fecha}&modalidad=PRESENCIAL`).expect(200);

      expect(body).toEqual([
        {
          id: presencial,
          modalidad: 'PRESENCIAL',
          iniciaEn: `${franjas.fecha}T13:30:00.000Z`,
          terminaEn: `${franjas.fecha}T14:00:00.000Z`,
          sede: { id: SEDES[1].id, nombre: SEDES[1].nombre, ciudad: SEDES[1].ciudad },
          profesional: {
            id: PROFESIONALES[0].id,
            nombre: `${PROFESIONALES[0].nombres} ${PROFESIONALES[0].apellidos}`,
          },
          especialidad: { id: ESPECIALIDADES[0].id, nombre: ESPECIALIDADES[0].nombre },
        },
      ]);
    });

    it.each([
      ['sedeId', SEDES[1].id, () => [presencial]],
      ['profesionalId', PROFESIONALES[2].id, () => [deOtroProfesional]],
      ['especialidadId', ESPECIALIDADES[1].id, () => [deOtroProfesional]],
      ['modalidad', 'VIRTUAL', () => [libre, liberada, deOtroProfesional]],
    ])('filters by %s', async (filtro, valor, esperadas) => {
      const { body } = await get(`franjas?fecha=${franjas.fecha}&${filtro}=${valor}`).expect(200);

      expect(idsDe(body)).toEqual(esperadas());
    });

    it('never offers a franja that has already started', async () => {
      const prisma = app.get(PrismaService);
      const pasada = await prisma.franja.findFirst({
        where: { iniciaEn: { lt: new Date() } },
        select: { id: true },
      });
      const { body } = await get(`franjas?profesionalId=${PROFESIONALES[0].id}`).expect(200);

      expect(body.every((f: { iniciaEn: string }) => new Date(f.iniciaEn) > new Date())).toBe(true);
      if (pasada) {
        expect(idsDe(body)).not.toContain(pasada.id);
      }
    });

    it.each([
      ['a date in another format', 'fecha=28-10-2026'],
      ['an impossible date', 'fecha=2026-02-30'],
      ['an id that is not a UUID', 'sedeId=12'],
      ['an unknown modalidad', 'modalidad=DOMICILIO'],
      ['an unknown filter', 'motivo=dolor'],
    ])('answers 400 for %s', async (_caso, consulta) => {
      expect((await get(`franjas?${consulta}`)).status).toBe(400);
    });

    it('asks who is calling', async () => {
      expect((await request(app.getHttpServer()).get('/api/v1/franjas')).status).toBe(401);
    });
  });

  describe('GET /api/v1/citas/mias', () => {
    it("returns only the caller's citas, with their state", async () => {
      const { body: deLuis } = await get('citas/mias', LUIS.correo).expect(200);
      const { body: deAna } = await get('citas/mias').expect(200);

      expect(deLuis).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            estado: 'PENDIENTE_PAGO',
            franja: expect.objectContaining({ id: tomada }),
          }),
          expect.objectContaining({
            estado: 'CANCELADA',
            franja: expect.objectContaining({ id: liberada }),
          }),
        ]),
      );
      expect(idsDe(deAna.map((c: { franja: { id: string } }) => c.franja))).toContain(libre);
      expect(idsDe(deAna.map((c: { franja: { id: string } }) => c.franja))).not.toContain(tomada);
    });

    it('is only for patients', async () => {
      expect((await get('citas/mias', PROFESIONAL.correo)).status).toBe(403);
    });
  });
});
