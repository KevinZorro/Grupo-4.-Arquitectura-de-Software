import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import type { AppConfig } from './config/app-config';

async function bootstrap(): Promise<void> {
  // An invalid environment surfaces here: Nest logs it and exits with code 1 on its own.
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  app.enableShutdownHooks();

  const port = app.get<AppConfig>(ConfigService).get('PORT', { infer: true });
  await app.listen(port);
  new Logger('Bootstrap').log(`Núcleo escuchando en el puerto ${port}`);
}

// Covers what Nest does not handle itself, such as a port that is already in use.
bootstrap().catch((error: unknown) => {
  new Logger('Bootstrap').error(
    'El núcleo no pudo arrancar',
    error instanceof Error ? error.stack : String(error),
  );
  process.exit(1);
});
