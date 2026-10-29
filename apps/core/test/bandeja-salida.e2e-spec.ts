import { randomUUID } from 'node:crypto';
import { declararTopologia } from '@citas/eventos';
import type { ConfigService } from '@nestjs/config';
import { connect, type Channel, type ChannelModel } from 'amqplib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { BandejaSalidaService } from '../src/bandeja-salida';
import { PublicadorPendientes } from '../src/bandeja-salida/publicador-pendientes';
import type { Env } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';

// Needs RabbitMQ besides the database: docker compose up -d postgres-core rabbitmq.
const URL_NUCLEO = process.env.CORE_DATABASE_URL ?? '';
const URL_RABBIT = process.env.RABBITMQ_URL ?? '';
// Nothing listens on port 1, so this publisher always finds the broker down.
const URL_RABBIT_CAIDO = 'amqp://app:app_password@127.0.0.1:1';
const COLA = 'mensajeria.cita-confirmada';

function configCon(urlRabbit: string): ConfigService<Env, true> {
  const valores: Record<string, string> = {
    CORE_DATABASE_URL: URL_NUCLEO,
    RABBITMQ_URL: urlRabbit,
  };
  return { get: (clave: string) => valores[clave] } as unknown as ConfigService<Env, true>;
}

describe('bandeja de salida', () => {
  const bandeja = new BandejaSalidaService();
  let prisma: PrismaService;
  let publicador: PublicadorPendientes;
  let conexion: ChannelModel;
  let canal: Channel;

  // Datos ficticios.
  const confirmada = (idCita: string) => ({
    clave: 'cita.confirmada' as const,
    datos: { idCita, idPaciente: randomUUID(), modalidad: 'PRESENCIAL' as const },
  });

  const pendientesDe = (idCita: string) =>
    prisma.eventoSaliente.count({
      where: { enviadoEn: null, contenido: { path: ['idCita'], equals: idCita } },
    });

  /** Publishes whatever earlier runs left pending and empties the queues the tests read. */
  async function empezarLimpio(): Promise<void> {
    while ((await publicador.publicarPendientes()) > 0);
    await canal.purgeQueue(COLA);
    await canal.purgeQueue('video.cita-confirmada');
  }

  async function idCitasEnCola(cantidad: number): Promise<string[]> {
    const ids: string[] = [];
    for (let i = 0; i < cantidad; i += 1) {
      const mensaje = await canal.get(COLA, { noAck: true });
      if (mensaje) ids.push(JSON.parse(mensaje.content.toString()).idCita);
    }
    return ids;
  }

  beforeAll(async () => {
    expect(URL_RABBIT, 'Falta RABBITMQ_URL: copie .env.example a .env').not.toBe('');
    prisma = new PrismaService(configCon(URL_RABBIT));
    publicador = new PublicadorPendientes(prisma, configCon(URL_RABBIT));
    conexion = await connect(URL_RABBIT);
    canal = await conexion.createChannel();
    await declararTopologia(canal);
  });

  afterAll(async () => {
    await canal.purgeQueue(COLA);
    await canal.purgeQueue('video.cita-confirmada');
    await conexion.close();
    await publicador.onModuleDestroy();
    await prisma.$disconnect();
  });

  it('guarda el evento solo si la transacción que cambia la cita confirma', async () => {
    const deshecha = randomUUID();
    const confirmadaEnBase = randomUUID();

    await expect(
      prisma.$transaction(async (tx) => {
        await bandeja.encolar(tx, confirmada(deshecha));
        throw new Error('falla después de cambiar el estado de la cita');
      }),
    ).rejects.toThrow('falla después');
    await prisma.$transaction((tx) => bandeja.encolar(tx, confirmada(confirmadaEnBase)));

    expect(await pendientesDe(deshecha)).toBe(0);
    expect(await pendientesDe(confirmadaEnBase)).toBe(1);
  });

  it('publica lo pendiente en orden y lo marca como enviado', async () => {
    await empezarLimpio();
    const citas = [randomUUID(), randomUUID(), randomUUID()];
    for (const idCita of citas) {
      await prisma.$transaction((tx) => bandeja.encolar(tx, confirmada(idCita)));
    }

    expect(await publicador.publicarPendientes()).toBe(3);

    expect(await idCitasEnCola(3)).toEqual(citas);
    for (const idCita of citas) {
      expect(await pendientesDe(idCita)).toBe(0);
    }
  });

  it('con RabbitMQ caído no pierde eventos y los publica cuando vuelve', async () => {
    await empezarLimpio();
    const idCita = randomUUID();
    await prisma.$transaction((tx) => bandeja.encolar(tx, confirmada(idCita)));
    const sinBroker = new PublicadorPendientes(prisma, configCon(URL_RABBIT_CAIDO));

    expect(await sinBroker.publicarPendientes()).toBe(0);
    expect(await pendientesDe(idCita)).toBe(1);

    expect(await publicador.publicarPendientes()).toBe(1);
    expect(await pendientesDe(idCita)).toBe(0);
    expect(await idCitasEnCola(1)).toEqual([idCita]);
  });
});
