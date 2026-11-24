import { AsyncLocalStorage } from 'node:async_hooks';
import { AuthActor, DEFAULT_STUB_ACTOR } from './auth.types';

export const actorStorage = new AsyncLocalStorage<AuthActor>();

/**
 * Returns the current authenticated actor from the asynchronous request context.
 * If called outside of a request context, falls back to the default stub actor (`demo-user`).
 */
export function getActorContext(): AuthActor {
  return actorStorage.getStore() ?? DEFAULT_STUB_ACTOR;
}

/**
 * Executes a function within the scope of an authenticated actor.
 */
export function runWithActor<T>(actor: AuthActor, fn: () => T): T {
  return actorStorage.run(actor, fn);
}

/**
 * Sets the active actor context for the current asynchronous execution flow.
 */
export function setActorContext(actor: AuthActor): void {
  actorStorage.enterWith(actor);
}
