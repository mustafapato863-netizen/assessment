/** Prisma ids are UUIDs. Anything else can never match a row, and passing it
 * to `findUnique`/`update` throws a raw P2023 instead of the clean 404 the
 * API promises. Validate before any Prisma id lookup. */
const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}
