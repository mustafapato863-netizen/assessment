/**
 * CORS Configuration & Origin Matching Utilities.
 *
 * Provides:
 * - Domain & wildcard pattern matching (e.g. `*.vercel.app`, `https://*.vercel.app`, `*.zainx.cloud`).
 * - Case-insensitive and trailing-slash tolerant origin normalization.
 * - Non-throwing CORS callback (uses `callback(null, false)` to avoid Express 500 error crashes).
 * - Comprehensive allowed header list for client credentials and idempotency keys.
 */

export const DEFAULT_ALLOWED_ORIGIN_PATTERNS = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3000',
  'https://web-opal-tau-44.vercel.app',
  '*.vercel.app',
  'https://*.vercel.app',
  '*.zainx.cloud',
  'https://*.zainx.cloud',
  '*.dokploy.app',
  'https://*.dokploy.app',
];

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

/**
 * Checks if a normalized origin matches a pattern.
 * Supports:
 * - Exact matches: `https://web-opal-tau-44.vercel.app`
 * - Scheme wildcards: `https://*.vercel.app`
 * - Domain wildcards: `*.vercel.app`
 * - Universal wildcard: `*`
 */
export function matchOriginPattern(origin: string, pattern: string): boolean {
  const normOrigin = origin.trim().replace(/\/+$/, '').toLowerCase();
  const normPattern = pattern.trim().replace(/\/+$/, '').toLowerCase();

  if (!normOrigin || !normPattern) {
    return false;
  }

  if (normPattern === '*' || normOrigin === normPattern) {
    return true;
  }

  // Handle patterns starting with https://*. or http://*.
  if (normPattern.startsWith('https://*.') || normPattern.startsWith('http://*.')) {
    const protocol = normPattern.startsWith('https://') ? 'https://' : 'http://';
    const domainPart = normPattern.slice(protocol.length + 2);
    const escapedDomain = domainPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${protocol}([a-zA-Z0-9_-]+\\.)*${escapedDomain}$`);
    return regex.test(normOrigin);
  }

  // Handle patterns starting with *. (e.g. *.vercel.app)
  if (normPattern.startsWith('*.')) {
    const domainPart = normPattern.slice(2);
    const escapedDomain = domainPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^https?:\\/\\/([a-zA-Z0-9_-]+\\.)*${escapedDomain}$`);
    return regex.test(normOrigin);
  }

  // Generic wildcard in pattern
  if (normPattern.includes('*')) {
    const escaped = normPattern.replace(/[.*+?^${}()|[\]\\]/g, (match) =>
      match === '*' ? '[a-zA-Z0-9_.-]+' : `\\${match}`,
    );
    const regex = new RegExp(`^${escaped}$`);
    return regex.test(normOrigin);
  }

  return false;
}

/**
 * Tests whether an incoming origin is permitted against an allowed pattern list.
 * Always allows empty/undefined origins (server-to-server, curl, health probes).
 */
export function isOriginAllowed(origin: string | undefined, allowedPatterns: string[]): boolean {
  if (!origin) {
    return true;
  }

  for (const pattern of allowedPatterns) {
    if (matchOriginPattern(origin, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Builds the origin delegate function or boolean for NestJS `app.enableCors()`.
 */
export function createCorsOriginChecker(
  rawAllowed?: string,
): (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void {
  const envList = (rawAllowed ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const patterns = Array.from(new Set([...envList, ...DEFAULT_ALLOWED_ORIGIN_PATTERNS]));

  return (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Requests with no origin (mobile apps, server-to-server, curl, health checks)
    if (!origin) {
      return callback(null, true);
    }

    if (rawAllowed?.trim() === '*' || isOriginAllowed(origin, patterns)) {
      return callback(null, true);
    }

    // Reject without throwing a 500 unhandled exception
    console.warn(`[CORS] Request blocked for origin: "${origin}"`);
    return callback(null, false);
  };
}
