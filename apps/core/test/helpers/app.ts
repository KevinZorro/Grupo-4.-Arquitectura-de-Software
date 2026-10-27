import type { INestApplication, Type } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';

/**
 * The real app, configured as main.ts configures it, plus the probe controllers a test needs.
 * `ajustar` lets a test swap a provider, such as a port to a third party, for a double.
 */
export async function createTestApp(
  controllers: Type<unknown>[] = [],
  ajustar: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder,
): Promise<INestApplication> {
  const moduleRef = await ajustar(
    Test.createTestingModule({ imports: [AppModule], controllers }),
  ).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return app;
}
