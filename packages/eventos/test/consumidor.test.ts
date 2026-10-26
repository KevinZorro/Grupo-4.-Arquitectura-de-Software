import { connect, type ChannelModel, type ConfirmChannel } from 'amqplib';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { consumir, crearEvento, declararTopologia, publicar, type CitaConfirmada } from '../src';

// Prueba de integración: requiere `docker compose up` (RabbitMQ y el PostgreSQL del núcleo).
const urlRabbit = process.env.RABBITMQ_URL ?? 'amqp://app:app_password@localhost:5672';
const urlNucleo =
  process.env.CORE_DATABASE_URL ?? 'postgresql://core:core_password@localhost:5432/core_db';

describe('consumidor idempotente', () => {
  let conexion: ChannelModel;
  let canal: ConfirmChannel;
  let pool: Pool;

  beforeAll(async () => {
    conexion = await connect(urlRabbit);
    canal = await conexion.createConfirmChannel();
    pool = new Pool({ connectionString: urlNucleo });
    await declararTopologia(canal);
    await canal.purgeQueue('mensajeria.cita-confirmada');
  });

  afterAll(async () => {
    // El exchange topic también enruta los eventos de prueba a la cola de video.
    await canal.purgeQueue('video.cita-confirmada');
    await conexion.close();
    await pool.end();
  });

  it('procesa una sola vez el mismo mensaje entregado dos veces', async () => {
    // Datos ficticios.
    const repetido = crearEvento('cita.confirmada', {
      idCita: '6f1c2a4e-8b3d-4c5e-9f7a-1b2c3d4e5f60',
      idPaciente: '0a9b8c7d-6e5f-4a3b-8c1d-2e3f4a5b6c7d',
      modalidad: 'VIRTUAL',
    });
    const testigo = crearEvento('cita.confirmada', {
      idCita: '1d2e3f4a-5b6c-4d7e-8f9a-0b1c2d3e4f5a',
      idPaciente: '0a9b8c7d-6e5f-4a3b-8c1d-2e3f4a5b6c7d',
      modalidad: 'PRESENCIAL',
    });

    // Prefetch 1 makes deliveries sequential: once the witness is processed,
    // both copies of the repeated message have already been handled.
    await canal.prefetch(1);
    const procesados: CitaConfirmada[] = [];
    let avisarTestigo: () => void = () => undefined;
    const testigoProcesado = new Promise<void>((resolve) => (avisarTestigo = resolve));

    const etiqueta = await consumir({
      canal,
      pool,
      cola: 'mensajeria.cita-confirmada',
      procesar: async (evento) => {
        procesados.push(evento);
        if (evento.idEvento === testigo.idEvento) avisarTestigo();
      },
    });

    await publicar(canal, 'cita.confirmada', repetido);
    await publicar(canal, 'cita.confirmada', repetido);
    await publicar(canal, 'cita.confirmada', testigo);
    await testigoProcesado;
    await canal.cancel(etiqueta);

    expect(procesados.map((evento) => evento.idEvento)).toEqual([
      repetido.idEvento,
      testigo.idEvento,
    ]);
    const filas = await pool.query(
      'SELECT count(*)::int AS total FROM mensajeria.mensajes_procesados WHERE id_mensaje = $1',
      [repetido.idEvento],
    );
    expect(filas.rows[0].total).toBe(1);
  });
});
