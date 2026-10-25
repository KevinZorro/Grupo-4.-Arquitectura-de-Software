import { StandardSchemaValidationPipe, type INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from './config/app-config';
import { isSwaggerEnabled } from './config/env';
import { setupSwagger } from './swagger';

export const API_PREFIX = 'api/v1';

/** Served without the prefix: the infrastructure probe and the adapters' contract (plan §7.5). */
const UNPREFIXED_ROUTES = ['health', 'internal/{*splat}'];

const CORS_ALLOWED_HEADERS = ['Content-Type', 'Authorization', 'Idempotency-Key'];

const CORS_PREFLIGHT_MAX_AGE_SECONDS = 600;

/** Everything main.ts and the e2e tests share, so tests exercise the same app that runs. */
export function configureApp(app: INestApplication): void {
  const config = app.get<AppConfig>(ConfigService);

  app.setGlobalPrefix(API_PREFIX, { exclude: UNPREFIXED_ROUTES });
  // Validates every @Body, @Query and @Param that declares a zod `schema`.
  app.useGlobalPipes(new StandardSchemaValidationPipe());

  const origins = config.get('CORS_ORIGINS', { infer: true });
  if (origins.length > 0) {
    app.enableCors({
      origin: origins,
      allowedHeaders: CORS_ALLOWED_HEADERS,
      maxAge: CORS_PREFLIGHT_MAX_AGE_SECONDS,
    });
  }

  if (isSwaggerEnabled(config.get('NODE_ENV', { infer: true }))) {
    setupSwagger(app);
  }
}
