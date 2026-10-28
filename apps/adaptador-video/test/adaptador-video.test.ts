import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { crearEvento, type CitaConfirmada } from '@citas/eventos';
import type { ConfirmChannel } from 'amqplib';
import type { Pool } from 'pg';
import { AdaptadorVideo } from '../src/adaptador-video';

function esperar(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 20));
}

function crearEventoCita(modalidad: 'VIRTUAL' | 'PRESENCIAL'): CitaConfirmada {
  return crearEvento('cita.confirmada', {
    idCita: randomUUID(),
    idPaciente: randomUUID(),
    modalidad,
  });
}

function prepararDependencias() {
  let recibir:
    ((mensaje: { content: Buffer; fields: object; properties: object }) => void) | undefined;

  const publicaciones: unknown[] = [];
  let inserciones = 0;

  const canal = {
    assertExchange: vi.fn(async () => undefined),
    assertQueue: vi.fn(async () => undefined),
    bindQueue: vi.fn(async () => undefined),
    consume: vi.fn(async (_cola, callback) => {
      recibir = callback;
      return { consumerTag: 'video-test' };
    }),
    publish: vi.fn((_exchange, _clave, contenido, _opciones, callback) => {
      publicaciones.push(JSON.parse(contenido.toString()));
      callback(null);
      return true;
    }),
    ack: vi.fn(),
    nack: vi.fn(),
  } as unknown as ConfirmChannel;

  const cliente = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('INSERT INTO')) {
        inserciones += 1;
        return { rowCount: inserciones === 1 ? 1 : 0 };
      }

      return { rowCount: 1 };
    }),
    release: vi.fn(),
  };

  const pool = {
    query: vi.fn(async () => ({ rowCount: 0 })),
    connect: vi.fn(async () => cliente),
  } as unknown as Pool;

  return {
    canal,
    pool,
    publicaciones,
    recibir: () => recibir,
  };
}

describe('AdaptadorVideo', () => {
  it('crea y publica una sala para una cita virtual', async () => {
    const dependencias = prepararDependencias();
    const adaptador = new AdaptadorVideo(dependencias.canal, dependencias.pool);

    await adaptador.iniciar();

    const cita = crearEventoCita('VIRTUAL');
    dependencias.recibir()?.({
      content: Buffer.from(JSON.stringify(cita)),
      fields: {},
      properties: {},
    });

    await esperar();

    expect(dependencias.publicaciones).toHaveLength(1);
    expect(dependencias.publicaciones[0]).toMatchObject({
      idCita: cita.idCita,
    });
    expect(dependencias.canal.ack).toHaveBeenCalled();
  });

  it('ignora una cita presencial', async () => {
    const dependencias = prepararDependencias();
    const adaptador = new AdaptadorVideo(dependencias.canal, dependencias.pool);

    await adaptador.iniciar();

    const cita = crearEventoCita('PRESENCIAL');
    dependencias.recibir()?.({
      content: Buffer.from(JSON.stringify(cita)),
      fields: {},
      properties: {},
    });

    await esperar();

    expect(dependencias.publicaciones).toHaveLength(0);
    expect(dependencias.canal.ack).toHaveBeenCalled();
  });

  it('no crea dos salas para la misma cita repetida', async () => {
    const dependencias = prepararDependencias();
    const adaptador = new AdaptadorVideo(dependencias.canal, dependencias.pool);

    await adaptador.iniciar();

    const cita = crearEventoCita('VIRTUAL');
    const mensaje = {
      content: Buffer.from(JSON.stringify(cita)),
      fields: {},
      properties: {},
    };

    dependencias.recibir()?.(mensaje);
    await esperar();

    dependencias.recibir()?.(mensaje);
    await esperar();

    expect(dependencias.publicaciones).toHaveLength(1);
    expect(dependencias.canal.ack).toHaveBeenCalledTimes(2);
  });
});
