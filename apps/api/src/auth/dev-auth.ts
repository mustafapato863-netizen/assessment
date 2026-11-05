/**
 * Header-based demo sign-in (x-actor-id, x-actor-name, x-actor-roles) for local development.
 *
 * It is off unless DEV_AUTH_HEADERS=true, and it is never honoured when NODE_ENV is
 * production. With it off, a request without a valid bearer token is refused, and any
 * role headers it sends are ignored.
 */
export function isDevHeaderAuthEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.DEV_AUTH_HEADERS?.trim().toLowerCase() === 'true'
  );
}
