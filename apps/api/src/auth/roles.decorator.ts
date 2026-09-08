import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AppRole, AuthActor } from './auth.types';
import { getActorContext } from './actor.context';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Parameter decorator extracting the current verified AuthActor
 * from the HTTP request or request context fallback.
 */
export const Actor = createParamDecorator((data: unknown, ctx: ExecutionContext): AuthActor => {
  const request = ctx.switchToHttp().getRequest();
  return request?.actor ?? request?.user ?? getActorContext();
});
