import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PACIENTES, USUARIOS } from '../prisma/seed/identidad';
import { sembrarTodo } from '../prisma/seed/index';
import { CitaInexistenteError, EstadoCitasService } from '../src/agenda';
import { CABECERA_USUARIO_DEV } from '../src/identidad';
import { PrismaService } from '../src/prisma/prisma.service';
import { createTestApp } from './helpers/app';
import { FranjasDePrueba } from './helpers/agenda';
import {
  bandejaDePrueba as bandeja,
  conPuertosDePrueba,
  reiniciarPuertos,
} from './helpers/puertos';

/** What PAG-3 calls when the gateway's webhook arrives, inside its own transaction. */
describe('cambios de estado de la cita para el webhook de pago (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let estados: EstadoCitasService;
  let franjas: FranjasDePrueba;

  const pendiente = async () => {
    const franjaId = await franjas.crear({ modalidad: 'VIRTUAL' });
    const cita = await franjas.citar(franjaId, PACIENTES[0].id, 'PENDIENTE_PAGO');
    return { franjaId, idCita: cita.id };
  };

  const estadoDe = async (idCita: string) =>
    (await prisma.cita.findUniqueOrThrow({ where: { id: idCita } })).estado;

  beforeAll(async () => {
    app = await createTestApp([], conPuertosDePrueba);
    prisma = app.get(PrismaService);
    estados = app.get(EstadoCitasService);
    await sembrarTodo(prisma);
    franjas = new FranjasDePrueba(prisma);
  });

  beforeEach(reiniciarPuertos);

  afterAll(async () => {
    await franjas.limpiar();
    await app.close();
  });

  it('confirms an approved payment and stores CitaConfirmada in the same transaction', async () => {
    const { idCita } = await pendiente();

    const cambio = await prisma.$transaction((tx) => estados.confirmarPorPago(tx, idCita));

    expect(cambio).toBe(true);
    expect(await prisma.cita.findUniqueOrThrow({ where: { id: idCita } })).toMatchObject({
      estado: 'CONFIRMADA',
      bloqueoVenceEn: null,
    });
    expect(bandeja.encolar).toHaveBeenCalledWith(expect.anything(), {
      clave: 'cita.confirmada',
      datos: { idCita, idPaciente: PACIENTES[0].id, modalidad: 'VIRTUAL' },
    });
  });

  it('does nothing for a webhook that arrives twice', async () => {
    const { idCita } = await pendiente();
    await prisma.$transaction((tx) => estados.confirmarPorPago(tx, idCita));
    bandeja.encolar.mockClear();

    const cambio = await prisma.$transaction((tx) => estados.confirmarPorPago(tx, idCita));

    expect(cambio).toBe(false);
    expect(bandeja.encolar).not.toHaveBeenCalled();
  });

  it('cancels a rejected payment with PAGO_RECHAZADO and frees the franja', async () => {
    const { franjaId, idCita } = await pendiente();

    const cambio = await prisma.$transaction((tx) => estados.cancelarPorPagoRechazado(tx, idCita));

    expect(cambio).toBe(true);
    expect(await estadoDe(idCita)).toBe('CANCELADA');
    expect(bandeja.encolar).toHaveBeenCalledWith(expect.anything(), {
      clave: 'cita.cancelada',
      datos: { idCita, idPaciente: PACIENTES[0].id, motivo: 'PAGO_RECHAZADO' },
    });
    await expect(franjas.citar(franjaId, PACIENTES[1].id, 'PENDIENTE_PAGO')).resolves.toBeDefined();
  });

  it('never confirms a cita that was already cancelled', async () => {
    const { idCita } = await pendiente();
    await prisma.$transaction((tx) => estados.cancelarPorPagoRechazado(tx, idCita));

    const cambio = await prisma.$transaction((tx) => estados.confirmarPorPago(tx, idCita));

    expect(cambio).toBe(false);
    expect(await estadoDe(idCita)).toBe('CANCELADA');
  });

  it('rolls back with the caller: if its transaction fails, the cita stays pending', async () => {
    const { idCita } = await pendiente();

    await expect(
      prisma.$transaction(async (tx) => {
        await estados.confirmarPorPago(tx, idCita);
        throw new Error('falló el registro de la transacción de pago');
      }),
    ).rejects.toThrow();

    expect(await estadoDe(idCita)).toBe('PENDIENTE_PAGO');
  });

  it('names the error when the cita does not exist', async () => {
    await expect(
      prisma.$transaction((tx) => estados.confirmarPorPago(tx, randomUUID())),
    ).rejects.toBeInstanceOf(CitaInexistenteError);
  });
});

describe('núcleo sin adaptadores de pago ni de bandeja (e2e)', () => {
  let app: INestApplication;
  let franjas: FranjasDePrueba;

  beforeAll(async () => {
    app = await createTestApp();
    await sembrarTodo(app.get(PrismaService));
    franjas = new FranjasDePrueba(app.get(PrismaService));
  });

  afterAll(async () => {
    await franjas.limpiar();
    await app.close();
  });

  it('starts with the stand-ins: a virtual booking is compensated with 503', async () => {
    const franjaId = await franjas.crear({ modalidad: 'VIRTUAL' });

    const { status } = await request(app.getHttpServer())
      .post('/api/v1/citas')
      .set(CABECERA_USUARIO_DEV, USUARIOS[0].correo)
      .set('Idempotency-Key', randomUUID())
      .send({ franjaId, modalidad: 'VIRTUAL' });

    expect(status).toBe(503);
  });
});
