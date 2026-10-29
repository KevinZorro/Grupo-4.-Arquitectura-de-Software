import type { INestApplication, Type } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

export interface AjustesDePrueba {
  /** Modules next to AppModule, such as a global one that wires a port to a double. */
  imports?: Type<unknown>[];
  /** Swaps providers, such as an adapter that is already wired, for doubles. */
  ajustar?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

/** The real app, configured as main.ts configures it, plus the probe controllers a test needs. */
export async function createTestApp(
  controllers: Type<unknown>[] = [],
  { imports = [], ajustar = (builder) => builder }: AjustesDePrueba = {},
): Promise<INestApplication> {
  const moduleRef = await ajustar(
    Test.createTestingModule({ imports: [AppModule, ...imports], controllers }),
  ).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}
