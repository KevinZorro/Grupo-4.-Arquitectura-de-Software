import { defineConfig } from 'vitest/config';

// Unit and static tests: none of them needs a database.
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts', 'prisma/**/*.spec.ts', 'test/**/*.spec.ts'],
    env: { NODE_ENV: 'test' },
  },
});
