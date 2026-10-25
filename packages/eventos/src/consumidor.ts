import type { Channel, ConsumeMessage } from 'amqplib';
import type { Pool } from 'pg';
import { esquemas, type Evento } from './contratos';
import { colas, type Cola } from './topologia';

type EventoDeCola<Q extends Cola> = Evento<(typeof colas)[Q]>;

export interface OpcionesConsumidor<Q extends Cola> {
  canal: Channel;
  pool: Pool;
  cola: Q;
  procesar: (evento: EventoDeCola<Q>) => Promise<void>;
  // Por defecto, idEvento. Cada consumidor usa la clave de la tabla del ADR-001,
  // por ejemplo idCita en video o idCita más tipo de mensaje en mensajería.
  claveIdempotencia?: (evento: EventoDeCola<Q>) => string;
}

// Each adapter keeps its processed-messages table in its own schema inside the core database,
// named after the queue prefix ("mensajeria.cita-confirmada" -> "mensajeria").
async function prepararTabla(pool: Pool, esquema: string): Promise<void> {
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${esquema}`);
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${esquema}.mensajes_procesados (
      id_mensaje TEXT NOT NULL,
      consumidor TEXT NOT NULL,
      fecha TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (id_mensaje, consumidor)
    )`,
  );
}

function leerJson(contenido: Buffer): unknown {
  try {
    return JSON.parse(contenido.toString());
  } catch {
    return undefined;
  }
}

// Returns the consumer tag, so the caller can cancel the subscription.
export async function consumir<Q extends Cola>(opciones: OpcionesConsumidor<Q>): Promise<string> {
  const { canal, pool, cola, procesar, claveIdempotencia } = opciones;
  const esquema = cola.split('.')[0];
  await prepararTabla(pool, esquema);

  const manejar = async (mensaje: ConsumeMessage): Promise<void> => {
    const resultado = esquemas[colas[cola]].safeParse(leerJson(mensaje.content));
    if (!resultado.success) {
      canal.nack(mensaje, false, false);
      return;
    }

    const evento = resultado.data as EventoDeCola<Q>;
    const idMensaje = claveIdempotencia ? claveIdempotencia(evento) : evento.idEvento;
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      // A concurrent copy of the same message blocks on the primary key until this
      // transaction ends, so it is processed once even if both arrive at the same time.
      const registro = await cliente.query(
        `INSERT INTO ${esquema}.mensajes_procesados (id_mensaje, consumidor)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [idMensaje, cola],
      );
      if (registro.rowCount === 0) {
        await cliente.query('ROLLBACK');
        canal.ack(mensaje);
        return;
      }

      await procesar(evento);
      await cliente.query('COMMIT');
      canal.ack(mensaje);
    } catch {
      // Sin reintentos todavía (EVT-2): el mensaje va directo a su cola de mensajes muertos.
      await cliente.query('ROLLBACK');
      canal.nack(mensaje, false, false);
    } finally {
      cliente.release();
    }
  };

  const { consumerTag } = await canal.consume(cola, (mensaje) => {
    if (mensaje) void manejar(mensaje);
  });
  return consumerTag;
}
