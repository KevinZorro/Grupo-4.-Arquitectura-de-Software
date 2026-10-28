import { config } from 'dotenv';
import amqp from 'amqplib';
import { Pool } from 'pg';
import { AdaptadorVideo } from './adaptador-video';

config({ path: ['.env', '../../.env'], quiet: true });

async function main(): Promise<void> {
  const rabbitmqUrl = process.env.RABBITMQ_URL;
  const databaseUrl = process.env.CORE_DATABASE_URL;

  if (!rabbitmqUrl) {
    throw new Error('Falta RABBITMQ_URL en el archivo .env');
  }

  if (!databaseUrl) {
    throw new Error('Falta CORE_DATABASE_URL en el archivo .env');
  }

  const conexion = await amqp.connect(rabbitmqUrl);
  const canal = await conexion.createConfirmChannel();
  const pool = new Pool({ connectionString: databaseUrl });

  const adaptador = new AdaptadorVideo(canal, pool);
  await adaptador.iniciar();

  console.log('Adaptador de video iniciado');

  const cerrar = async (): Promise<void> => {
    await pool.end();
    await conexion.close();
  };

  process.on('SIGINT', () => void cerrar());
  process.on('SIGTERM', () => void cerrar());
}

void main().catch((error: unknown) => {
  console.error('No se pudo iniciar el adaptador de video', error);
  process.exitCode = 1;
});
