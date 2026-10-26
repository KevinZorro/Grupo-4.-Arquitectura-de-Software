import type { ConfirmChannel } from 'amqplib';
import { esquemas, type ClaveEnrutamiento, type Evento } from './contratos';
import { EXCHANGE_CITAS } from './topologia';

// Resolves only after the broker confirms the message, so the outbox can mark it as sent
// without losing events; it rejects if RabbitMQ refuses it or the channel closes.
export async function publicar<C extends ClaveEnrutamiento>(
  canal: ConfirmChannel,
  clave: C,
  evento: Evento<C>,
): Promise<void> {
  const valido = esquemas[clave].parse(evento);
  const contenido = Buffer.from(JSON.stringify(valido));

  await new Promise<void>((resolve, reject) => {
    canal.publish(
      EXCHANGE_CITAS,
      clave,
      contenido,
      { persistent: true, messageId: valido.idEvento, contentType: 'application/json' },
      (error) => (error ? reject(error) : resolve()),
    );
  });
}
