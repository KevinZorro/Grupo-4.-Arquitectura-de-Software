import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const APP_DIR = join(__dirname, '..');
// A separate folder, so the build does not clash with a `npm run start:dev` that is running.
const BUILD_DIR = join(APP_DIR, 'dist', 'e2e-build');
const MAIN = join(BUILD_DIR, 'main.js');

/** Runs the compiled app as its own process, in a folder with no .env file to find. */
function startWith(env: Record<string, string>, cwd: string) {
  return spawnSync(process.execPath, [MAIN], {
    cwd,
    env: { PATH: process.env.PATH ?? '', ...env },
    encoding: 'utf8',
    timeout: 30_000,
  });
}

describe('arranque del proceso (e2e)', () => {
  let emptyDir: string;
  let scratchRoot: string;

  beforeAll(() => {
    execFileSync('npx', ['tsc', '-p', 'tsconfig.build.json', '--outDir', BUILD_DIR], {
      cwd: APP_DIR,
      stdio: 'pipe',
    });
    // Two levels deep, because the app also looks for ../../.env.
    scratchRoot = mkdtempSync(join(tmpdir(), 'core-arranque-'));
    emptyDir = join(scratchRoot, 'a', 'b');
    mkdirSync(emptyDir, { recursive: true });
  }, 120_000);

  afterAll(() => {
    rmSync(scratchRoot, { recursive: true, force: true });
    rmSync(BUILD_DIR, { recursive: true, force: true });
  });

  it('fails with exit code 1 and names every missing variable', () => {
    const result = startWith({}, emptyDir);

    const output = `${result.stdout}${result.stderr}`;
    expect(result.status).toBe(1);
    expect(output).toContain('Configuración inválida');
    expect(output).toContain('NODE_ENV');
    expect(output).toContain('CORE_DATABASE_URL');
    expect(output).not.toMatch(/^\s+at /m);
  });

  it('fails with exit code 1 on a value that does not validate', () => {
    const result = startWith(
      {
        NODE_ENV: 'development',
        PORT: 'abc',
        CORE_DATABASE_URL: 'postgresql://core:secreto@localhost:5432/core_db',
      },
      emptyDir,
    );

    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain('PORT');
  });
});
