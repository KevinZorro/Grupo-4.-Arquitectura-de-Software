import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

function controllerWith(queryRaw: () => Promise<unknown>): HealthController {
  return new HealthController({ $queryRaw: queryRaw } as unknown as PrismaService);
}

describe('HealthController', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reports ok when the database answers', async () => {
    const controller = controllerWith(() => Promise.resolve([{ '?column?': 1 }]));

    await expect(controller.estado()).resolves.toEqual({ estado: 'ok', base: 'ok' });
  });

  it('answers 503 with the degraded state when the query fails', async () => {
    const controller = controllerWith(() => Promise.reject(new Error('connect ECONNREFUSED')));

    const error = await controller.estado().catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getStatus()).toBe(503);
    expect((error as ServiceUnavailableException).getResponse()).toEqual({
      estado: 'degradado',
      base: 'caida',
    });
  });

  it('gives up on a database that hangs instead of hanging with it', async () => {
    vi.useFakeTimers();
    const controller = controllerWith(() => new Promise(() => undefined));

    const outcome = controller.estado().catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(2_000);

    expect(await outcome).toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not leave its timer running after a quick answer', async () => {
    vi.useFakeTimers();
    const controller = controllerWith(() => Promise.resolve([]));

    await controller.estado();

    expect(vi.getTimerCount()).toBe(0);
  });
});
