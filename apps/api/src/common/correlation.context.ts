import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

const correlationStorage = new AsyncLocalStorage<string>();

/**
 * Runs `fn` with the request's correlation ID, so code deep in the call chain can read it.
 */
export function runWithCorrelationId<T>(correlationId: string, fn: () => T): T {
  return correlationStorage.run(correlationId, fn);
}

/**
 * The current request's correlation ID. Outside a request it returns a fresh `corr-<uuid>`.
 */
export function currentCorrelationId(): string {
  return correlationStorage.getStore() ?? `corr-${randomUUID()}`;
}
