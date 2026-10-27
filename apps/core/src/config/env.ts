import { z } from 'zod';

const NODE_ENVS = ['development', 'test', 'production'] as const;

const DEFAULT_PORT = 3000;

/** Comma-separated browser origins; each entry is reduced to its `scheme://host:port` form. */
const corsOrigins = z
  .string()
  .default('')
  .transform((raw) =>
    raw
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== ''),
  )
  .pipe(
    z
      .array(z.url({ error: 'debe ser una URL válida' }))
      .transform((urls) => urls.map((url) => new URL(url).origin)),
  );

export const envSchema = z.object({
  NODE_ENV: z.enum(NODE_ENVS, { error: 'debe ser development, test o production' }),
  PORT: z.coerce
    .number({ error: 'debe ser un número' })
    .int('debe ser un entero')
    .min(1, 'debe estar entre 1 y 65535')
    .max(65535, 'debe estar entre 1 y 65535')
    .default(DEFAULT_PORT),
  CORE_DATABASE_URL: z.url({
    protocol: /^postgres(ql)?$/,
    error: 'es obligatoria y debe ser una URL postgresql://',
  }),
  CORS_ORIGINS: corsOrigins,
  PASARELA_URL: z
    .url({
      protocol: /^https?$/,
      error: 'debe ser una URL http(s):// de la pasarela',
    })
    .default('http://localhost:4000'),
  PAGOS_TIMEOUT_MS: z.coerce
    .number({ error: 'debe ser un número' })
    .int('debe ser un entero')
    .positive('debe ser mayor que cero')
    .max(60_000, 'debe ser 60000 o menos')
    .default(5_000),
});

export type Env = z.infer<typeof envSchema>;

/** Thrown at startup so a bad environment stops the process instead of failing later. */
export class InvalidConfigurationError extends Error {
  constructor(problems: readonly string[]) {
    super(['Configuración inválida:', ...problems.map((problem) => `  - ${problem}`)].join('\n'));
    this.name = 'InvalidConfigurationError';
    // A missing variable is a user mistake, not a bug: the frames would only bury the message.
    this.stack = `${this.name}: ${this.message}`;
  }
}

/**
 * Validates the raw environment. The messages never echo the received values,
 * because a database URL carries a password.
 */
export function parseEnv(raw: Record<string, unknown>): Env {
  const result = envSchema.safeParse(raw);
  if (result.success) {
    return result.data;
  }
  throw new InvalidConfigurationError(
    result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
  );
}

/**
 * The X-Usuario-Dev header stands in for login until IDN-1 lands. It works while developing and
 * testing and nowhere else, so a deployment that forgets to configure real login stays closed.
 */
export function isDevHeaderEnabled(nodeEnv: Env['NODE_ENV']): boolean {
  return nodeEnv === 'development' || nodeEnv === 'test';
}

/** Swagger documents every route, internal ones included, so it only exists while developing. */
export function isSwaggerEnabled(nodeEnv: Env['NODE_ENV']): boolean {
  return nodeEnv === 'development';
}
