import { describe, expect, it } from 'vitest';
import { InvalidConfigurationError, isSwaggerEnabled, parseEnv } from './env';

const VALID = {
  NODE_ENV: 'development',
  CORE_DATABASE_URL: 'postgresql://core:secreto@localhost:5432/core_db',
};

function messageOf(raw: Record<string, unknown>): string {
  try {
    parseEnv(raw);
  } catch (error) {
    expect(error).toBeInstanceOf(InvalidConfigurationError);
    return (error as Error).message;
  }
  throw new Error('parseEnv should have thrown');
}

describe('parseEnv', () => {
  it('accepts the minimal environment and fills the defaults', () => {
    expect(parseEnv(VALID)).toEqual({ ...VALID, PORT: 3000, CORS_ORIGINS: [] });
  });

  it('coerces PORT from text', () => {
    expect(parseEnv({ ...VALID, PORT: '8080' }).PORT).toBe(8080);
  });

  it('accepts postgres:// as well as postgresql://', () => {
    expect(() =>
      parseEnv({ ...VALID, CORE_DATABASE_URL: 'postgres://core:secreto@db:5432/core_db' }),
    ).not.toThrow();
  });

  it('ignores variables that belong to other apps', () => {
    expect(parseEnv({ ...VALID, RABBITMQ_URL: 'amqp://app:app@localhost' })).not.toHaveProperty(
      'RABBITMQ_URL',
    );
  });

  it('names every missing variable in a single error', () => {
    const message = messageOf({});
    expect(message).toContain('NODE_ENV');
    expect(message).toContain('CORE_DATABASE_URL');
  });

  it.each(['staging', 'prod', ''])('rejects NODE_ENV=%j', (nodeEnv) => {
    expect(messageOf({ ...VALID, NODE_ENV: nodeEnv })).toContain('NODE_ENV');
  });

  it.each(['0', '65536', '80.5', 'abc', ''])('rejects PORT=%j', (port) => {
    expect(messageOf({ ...VALID, PORT: port })).toContain('PORT');
  });

  it.each(['mysql://core:secreto@localhost/core_db', 'localhost:5432', ''])(
    'rejects CORE_DATABASE_URL=%j',
    (url) => {
      expect(messageOf({ ...VALID, CORE_DATABASE_URL: url })).toContain('CORE_DATABASE_URL');
    },
  );

  it('never echoes the received values, which may hold a password', () => {
    const message = messageOf({ ...VALID, CORE_DATABASE_URL: 'mysql://core:ClaveSecreta@db/x' });
    expect(message).not.toContain('ClaveSecreta');
  });

  describe('CORS_ORIGINS', () => {
    it('is an empty list when unset or blank, which leaves CORS off', () => {
      expect(parseEnv(VALID).CORS_ORIGINS).toEqual([]);
      expect(parseEnv({ ...VALID, CORS_ORIGINS: '  ' }).CORS_ORIGINS).toEqual([]);
    });

    it('trims entries and reduces each one to its origin', () => {
      const raw = ' http://localhost:5173/ , https://citas.ejemplo.test/portal ,';
      expect(parseEnv({ ...VALID, CORS_ORIGINS: raw }).CORS_ORIGINS).toEqual([
        'http://localhost:5173',
        'https://citas.ejemplo.test',
      ]);
    });

    it('rejects an entry that is not a URL', () => {
      expect(messageOf({ ...VALID, CORS_ORIGINS: 'http://localhost:5173,no-es-url' })).toContain(
        'CORS_ORIGINS',
      );
    });
  });
});

describe('isSwaggerEnabled', () => {
  it('is on only while developing', () => {
    expect(isSwaggerEnabled('development')).toBe(true);
    expect(isSwaggerEnabled('test')).toBe(false);
    expect(isSwaggerEnabled('production')).toBe(false);
  });
});
