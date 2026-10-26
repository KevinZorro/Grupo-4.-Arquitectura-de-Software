import type { ConfigService } from '@nestjs/config';
import type { Env } from './env';

/**
 * Typed view of the validated environment: `get` never returns undefined.
 * Use it for `app.get<AppConfig>(ConfigService)`. In a constructor, write
 * `ConfigService<Env, true>` instead: Nest needs the class itself, not an alias, to inject it.
 */
export type AppConfig = ConfigService<Env, true>;
