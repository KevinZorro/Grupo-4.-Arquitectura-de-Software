import type { Channel } from 'amqplib';
import type { ClaveEnrutamiento } from './contratos';

export const EXCHANGE_CITAS = 'citas';
const EXCHANGE_MUERTOS = 'citas.muertos';

// Una cola por consumidor, cada una con su cola de mensajes muertos. Solo las del sprint 1:
// una cola sin consumidor acumularía eventos que nadie lee.
export const colas = {
  'video.cita-confirmada': 'cita.confirmada',
  'mensajeria.cita-confirmada': 'cita.confirmada',
} satisfies Record<string, ClaveEnrutamiento>;

export type Cola = keyof typeof colas;

// Publishers and consumers both call this, so no event is dropped as unroutable
// when a publisher starts before its consumers.
export async function declararTopologia(canal: Channel): Promise<void> {
  await canal.assertExchange(EXCHANGE_CITAS, 'topic', { durable: true });
  await canal.assertExchange(EXCHANGE_MUERTOS, 'direct', { durable: true });

  for (const [cola, clave] of Object.entries(colas)) {
    const colaMuertos = `${cola}.dlq`;
    await canal.assertQueue(colaMuertos, { durable: true });
    await canal.bindQueue(colaMuertos, EXCHANGE_MUERTOS, cola);

    await canal.assertQueue(cola, {
      durable: true,
      deadLetterExchange: EXCHANGE_MUERTOS,
      deadLetterRoutingKey: cola,
    });
    await canal.bindQueue(cola, EXCHANGE_CITAS, clave);
  }
}
