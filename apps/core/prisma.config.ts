import { config } from 'dotenv';
import { defineConfig } from 'prisma/config';

config({ path: ['.env', '../../.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  // Read from process.env on purpose: `prisma generate` runs on every npm install and must not
  // fail on a fresh clone. Commands that really need the URL (migrate, seed) report it as missing.
  datasource: { url: process.env.CORE_DATABASE_URL },
});
