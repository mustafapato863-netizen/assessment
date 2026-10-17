import { describe, expect, it } from 'vitest';
import { validateProductionEnvironment } from './environment.validation';

describe('validateProductionEnvironment', () => {
  it('does not enforce production credentials outside production', () => {
    expect(() =>
      validateProductionEnvironment({
        NODE_ENV: 'test',
        DATA_MODE: 'memory',
        AUTH_JWT_SECRET: 'short',
        DATABASE_URL: 'postgresql://user:123456@localhost:5432/db',
      }),
    ).not.toThrow();
  });

  it.each([
    ['', 'AUTH_JWT_SECRET'],
    ['short', 'AUTH_JWT_SECRET'],
    ['replace-with-a-random-value-that-is-long-enough', 'AUTH_JWT_SECRET'],
  ])('rejects invalid production AUTH_JWT_SECRET values', (secret, variable) => {
    expect(() =>
      validateProductionEnvironment({
        NODE_ENV: 'production',
        DATA_MODE: 'database',
        AUTH_JWT_SECRET: secret,
        DATABASE_URL: 'postgresql://user:secure-value@localhost:5432/db',
      }),
    ).toThrow(variable);
  });

  it.each(['123456', 'PASSWORD', 'your%20password'])(
    'rejects a weak or placeholder database password',
    (password) => {
      expect(() =>
        validateProductionEnvironment({
          NODE_ENV: 'production',
          DATA_MODE: 'database',
          AUTH_JWT_SECRET: 'a'.repeat(32),
          DATABASE_URL: `postgresql://user:${password}@localhost:5432/db`,
        }),
      ).toThrow('DATABASE_URL');
    },
  );

  it('reports invalid variable names without including their values', () => {
    const environment = {
      NODE_ENV: 'production',
      DATA_MODE: 'database',
      AUTH_JWT_SECRET: 'replace-with-secret-value-that-is-long-enough',
      DATABASE_URL: 'postgresql://user:PASSWORD@localhost:5432/db',
    };

    try {
      validateProductionEnvironment(environment);
      throw new Error('Expected production validation to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toContain('AUTH_JWT_SECRET');
      expect((error as Error).message).toContain('DATABASE_URL');
      expect((error as Error).message).not.toContain(environment.AUTH_JWT_SECRET);
      expect((error as Error).message).not.toContain(environment.DATABASE_URL);
    }
  });

  it('accepts secure production credentials', () => {
    expect(() =>
      validateProductionEnvironment({
        NODE_ENV: 'production',
        DATA_MODE: 'database',
        AUTH_JWT_SECRET: 'a'.repeat(32),
        DATABASE_URL: 'postgresql://user:secure-value@localhost:5432/db',
      }),
    ).not.toThrow();
  });
});
