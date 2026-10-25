import { Client } from 'pg';

/** Fails fast, with a readable message, when the database the e2e suite needs is not there. */
export default async function setup(): Promise<void> {
  const url = process.env.CORE_DATABASE_URL;
  if (!url) {
    throw new Error(
      'Falta CORE_DATABASE_URL: copie .env.example a .env en la raíz del repositorio.',
    );
  }

  const client = new Client({ connectionString: url, connectionTimeoutMillis: 3_000 });
  try {
    await client.connect();
    await client.query('SELECT 1');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(
      `No hay PostgreSQL disponible en ${new URL(url).host} (${reason}). ` +
        'Levante la base con: docker compose up -d postgres-core',
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}
