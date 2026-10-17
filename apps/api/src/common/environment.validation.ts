interface ProductionEnvironment {
  NODE_ENV?: string;
  DATA_MODE?: string;
  AUTH_JWT_SECRET?: string;
  DATABASE_URL?: string;
}

function databasePassword(databaseUrl: string): string | null {
  try {
    const password = new URL(databaseUrl).password;
    try {
      return decodeURIComponent(password);
    } catch {
      return password;
    }
  } catch {
    const match = databaseUrl.match(/^[a-z][a-z\d+.-]*:\/\/[^:/?#]+:([^@/?#]*)@/i);
    if (!match?.[1]) return null;
    try {
      return decodeURIComponent(match[1]);
    } catch {
      return match[1];
    }
  }
}

export function validateProductionEnvironment(
  environment: ProductionEnvironment = process.env,
): void {
  if (environment.NODE_ENV !== 'production') return;

  const invalidVariables: string[] = [];
  if (environment.DATA_MODE !== 'database') {
    invalidVariables.push('DATA_MODE');
  }

  if (!environment.DATABASE_URL?.trim()) {
    invalidVariables.push('DATABASE_URL');
  }

  const secret = environment.AUTH_JWT_SECRET?.trim() ?? '';
  if (secret.length < 32 || /replace-with/i.test(secret)) {
    invalidVariables.push('AUTH_JWT_SECRET');
  }

  const password = environment.DATABASE_URL ? databasePassword(environment.DATABASE_URL) : null;
  if (password === '123456' || (password !== null && /password/i.test(password))) {
    invalidVariables.push('DATABASE_URL');
  }

  if (invalidVariables.length > 0) {
    throw new Error(`Invalid production configuration: ${invalidVariables.join(', ')}.`);
  }
}
