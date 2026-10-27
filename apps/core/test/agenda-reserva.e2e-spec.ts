import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PACIENTES, USUARIOS } from '../prisma/seed/identidad';
import { sembrarTodo } from '../prisma/seed/index';
import {
  BANDEJA_SALIDA,
  INICIADOR_PAGO,
  type BandejaSalida,
  type IniciadorPago,
} from '../src/agenda';
import { CABECERA_USUARIO_DEV } from '../src/identidad';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/app';
import { FranjasDePrueba } from './helpers/agenda';

const ANA = USUARIOS[0];
const LUIS = USUARIOS[1];
const PROFESIONAL = USUARIOS.find((u) => u.rol === 'PROFESIONAL')!;

describe('reserva de una franja (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let franjas: FranjasDePrueba;

  // Doubles for the gateway (PAG-2) and the outbox (EVT-3); each test sets how they answer.
  const pago = { iniciarPago: vi.fn<IniciadorPago['iniciarPago']>() };
  const bandeja = { encolar: vi.fn<BandejaSalida['encolar']>() };

  const reservar = (
    cuerpo: object,
    { correo = ANA.correo, clave = randomUUID() as string | null } = {},
  ) => {
    const solicitud = request(app.getHttpServer())
      .post('/api/v1/citas')
      .set(CABECERA_USUARIO_DEV, correo);
    return (clave === null ? solicitud : solicitud.set('Idempotency-Key', clave)).send(cuerpo);
  };

  const citasDe = (franjaId: string) => prisma.cita.findMany({ where: { franjaId } });

  beforeAll(async () => {
    app = await createTestApp([], (builder) =>
      builder
        .overrideProvider(INICIADOR_PAGO)
        .useValue(pago)
        .overrideProvider(BANDEJA_SALIDA)
        .useValue(bandeja),
    );
    prisma = app.get(PrismaService);
    await sembrarTodo(prisma);
    franjas = new FranjasDePrueba(prisma);
  });

  beforeEach(() => {
    pago.iniciarPago
      .mockReset()
      .mockImplementation((idCita) =>
        Promise.resolve({ urlPago: `http://localhost:4000/pagar/${idCita}` }),
      );
    bandeja.encolar.mockReset().mockResolvedValue();
  });

  afterAll(async () => {
    await franjas.limpiar();
    await app.close();
  });

  describe('virtual', () => {
    it('holds the franja for 15 minutes and answers the payment link', async () => {
      const franjaId = await franjas.crear({ modalidad: 'VIRTUAL' });
      const antes = Date.now();

      const { body } = await reservar({ franjaId, modalidad: 'VIRTUAL' }).expect(201);

      expect(body).toEqual({
        id: expect.any(String),
        estado: 'PENDIENTE_PAGO',
        bloqueoVenceEn: expect.any(String),
        urlPago: `http://localhost:4000/pagar/${body.id}`,
      });
      const vence = Date.parse(body.bloqueoVenceEn) - antes;
      expect(vence).toBeGreaterThanOrEqual(15 * 60_000 - 1_000);
      expect(vence).toBeLessThanOrEqual(15 * 60_000 + 5_000);
      expect(pago.iniciarPago).toHaveBeenCalledWith(body.id);
      expect(bandeja.encolar).not.toHaveBeenCalled();
    });

    it('cancels the cita, frees the franja and answers 503 when the payment cannot start', async () => {
      const franjaId = await franjas.crear({ modalidad: 'VIRTUAL' });
      pago.iniciarPago.mockRejectedValue(new Error('timeout de 5 s'));

      expect((await reservar({ franjaId, modalidad: 'VIRTUAL' })).status).toBe(503);

      const [cita] = await citasDe(franjaId);
      expect(cita).toMatchObject({ estado: 'CANCELADA', bloqueoVenceEn: null });
      expect(bandeja.encolar).toHaveBeenCalledWith(expect.anything(), {
        clave: 'cita.cancelada',
        datos: { idCita: cita.id, idPaciente: PACIENTES[0].id, motivo: 'FALLA_INICIO_PAGO' },
      });
      // Freed: once the gateway answers again, another patient can take it.
      pago.iniciarPago.mockResolvedValue({ urlPago: 'http://localhost:4000/pagar/otra' });
      await reservar({ franjaId, modalidad: 'VIRTUAL' }, { correo: LUIS.correo }).expect(201);
    });
  });

  describe('presencial', () => {
    it('is confirmed at once and announces CitaConfirmada through the outbox', async () => {
      const franjaId = await franjas.crear({ modalidad: 'PRESENCIAL' });

      const { body } = await reservar({ franjaId, modalidad: 'PRESENCIAL' }).expect(201);

      expect(body).toEqual({ id: expect.any(String), estado: 'CONFIRMADA' });
      expect(pago.iniciarPago).not.toHaveBeenCalled();
      expect(bandeja.encolar).toHaveBeenCalledWith(expect.anything(), {
        clave: 'cita.confirmada',
        datos: { idCita: body.id, idPaciente: PACIENTES[0].id, modalidad: 'PRESENCIAL' },
      });
    });

    it('keeps no cita when the outbox fails: the event and the change commit together', async () => {
      const franjaId = await franjas.crear({ modalidad: 'PRESENCIAL' });
      bandeja.encolar.mockRejectedValue(new Error('bandeja caída'));

      expect((await reservar({ franjaId, modalidad: 'PRESENCIAL' })).status).toBe(500);

      expect(await citasDe(franjaId)).toEqual([]);
    });
  });

  describe('Idempotency-Key', () => {
    it('answers the same cita when the same request comes again', async () => {
      const franjaId = await franjas.crear({ modalidad: 'VIRTUAL' });
      const clave = randomUUID();

      const primera = await reservar({ franjaId, modalidad: 'VIRTUAL' }, { clave }).expect(201);
      const segunda = await reservar({ franjaId, modalidad: 'VIRTUAL' }, { clave }).expect(201);

      expect(segunda.body).toEqual(primera.body);
      expect(await citasDe(franjaId)).toHaveLength(1);
    });

    it('answers the same cita when both copies arrive at the same time', async () => {
      const franjaId = await franjas.crear({ modalidad: 'PRESENCIAL' });
      const clave = randomUUID();

      const respuestas = await Promise.all([
        reservar({ franjaId, modalidad: 'PRESENCIAL' }, { clave }),
        reservar({ franjaId, modalidad: 'PRESENCIAL' }, { clave }),
      ]);

      expect(respuestas.map((r) => r.status)).toEqual([201, 201]);
      expect(respuestas[0].body.id).toBe(respuestas[1].body.id);
      expect(await citasDe(franjaId)).toHaveLength(1);
    });

    it('refuses a key reused for another franja', async () => {
      const clave = randomUUID();
      const primera = await franjas.crear({ modalidad: 'VIRTUAL' });
      const otra = await franjas.crear({ modalidad: 'VIRTUAL' });
      await reservar({ franjaId: primera, modalidad: 'VIRTUAL' }, { clave }).expect(201);

      expect((await reservar({ franjaId: otra, modalidad: 'VIRTUAL' }, { clave })).status).toBe(
        422,
      );
    });

    it.each([
      ['missing', null],
      ['not a UUID', 'reintento-1'],
    ])('answers 400 when the key is %s', async (_caso, clave) => {
      const franjaId = await franjas.crear();

      expect((await reservar({ franjaId, modalidad: 'VIRTUAL' }, { clave })).status).toBe(400);
    });
  });

  describe('doble reserva', () => {
    it('gives the franja to only one of two patients who ask at the same time', async () => {
      const franjaId = await franjas.crear({ modalidad: 'PRESENCIAL' });

      const respuestas = await Promise.all([
        reservar({ franjaId, modalidad: 'PRESENCIAL' }, { correo: ANA.correo }),
        reservar({ franjaId, modalidad: 'PRESENCIAL' }, { correo: LUIS.correo }),
      ]);

      expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await citasDe(franjaId)).toHaveLength(1);
    });

    it('answers 409 for a franja another patient already holds', async () => {
      const franjaId = await franjas.crear({ modalidad: 'VIRTUAL' });
      await reservar({ franjaId, modalidad: 'VIRTUAL' }, { correo: LUIS.correo }).expect(201);

      expect((await reservar({ franjaId, modalidad: 'VIRTUAL' })).status).toBe(409);
    });
  });

  describe('rejects', () => {
    it('a franja that does not exist', async () => {
      expect((await reservar({ franjaId: randomUUID(), modalidad: 'VIRTUAL' })).status).toBe(404);
    });

    it('a franja of the other modalidad', async () => {
      const franjaId = await franjas.crear({ modalidad: 'PRESENCIAL' });

      expect((await reservar({ franjaId, modalidad: 'VIRTUAL' })).status).toBe(422);
      expect(await citasDe(franjaId)).toEqual([]);
    });

    it('a franja that has already started', async () => {
      const iniciaEn = new Date(Date.now() - 60_000);
      const franjaId = await franjas.crear({
        iniciaEn,
        terminaEn: new Date(iniciaEn.getTime() + 30 * 60_000),
      });

      expect((await reservar({ franjaId, modalidad: 'VIRTUAL' })).status).toBe(422);
      expect(await citasDe(franjaId)).toEqual([]);
    });

    it('a body with unknown fields', async () => {
      const franjaId = await franjas.crear();

      expect((await reservar({ franjaId, modalidad: 'VIRTUAL', motivo: 'dolor' })).status).toBe(
        400,
      );
      expect(await citasDe(franjaId)).toEqual([]);
    });

    it('a caller who is not a patient', async () => {
      const franjaId = await franjas.crear();

      expect(
        (await reservar({ franjaId, modalidad: 'VIRTUAL' }, { correo: PROFESIONAL.correo })).status,
      ).toBe(403);
      expect(await citasDe(franjaId)).toEqual([]);
    });
  });
});
