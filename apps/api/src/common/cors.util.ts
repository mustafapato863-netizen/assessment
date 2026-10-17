/**
 * CORS configuration using only exact origins provided through the environment.
 * Origins are comma-separated and whitespace around each entry is ignored.
 */

export const CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'x-correlation-id',
  'idempotency-key',
  'Idempotency-Key',
  'x-actor-id',
  'x-actor-role',
  'x-actor-name',
  'x-actor-roles',
];

export const CORS_EXPOSED_HEADERS = ['x-correlation-id', 'Retry-After'];

export function parseAllowedOrigins(rawAllowed?: string): string[] {
  return Array.from(
    new Set(
      (rawAllowed ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0 && !origin.includes('*')),
    ),
  );
}

export function isOriginAllowed(origin: string | undefined, allowedOrigins: string[]): boolean {
  // Non-browser clients do not send Origin and are not subject to CORS.
  return !origin || allowedOrigins.includes(origin);
}

export function createCorsOriginChecker(
  rawAllowed?: string,
): (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void {
  const allowedOrigins = parseAllowedOrigins(rawAllowed);

  return (origin, callback) => callback(null, isOriginAllowed(origin, allowedOrigins));
}
