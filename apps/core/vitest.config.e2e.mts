import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

// The e2e suite talks to a real PostgreSQL, so it reads the same .env as the app.
config({ path: ['.env', '../../.env'], quiet: true });

export default defineConfig({
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    env: { NODE_ENV: 'test', CORS_ORIGINS: 'http://localhost:5173' },
    globalSetup: ['test/global-setup.ts'],
    // The files share one database, so they run one after the other.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
