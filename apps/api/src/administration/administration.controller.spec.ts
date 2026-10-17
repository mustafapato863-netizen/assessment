import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { ROLES_KEY } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { AdministrationController } from './administration.controller';

describe('AdministrationController permissions', () => {
  it('requires the System admin role for every Administration endpoint', () => {
    const methods = [
      'accounts',
      'createAccount',
      'updateAccount',
      'deactivateAccount',
      'resetPassword',
      'policy',
      'enforcePolicy',
      'audit',
    ] as const;
    for (const method of methods) {
      expect(Reflect.getMetadata(ROLES_KEY, AdministrationController.prototype[method])).toEqual([
        'Admin',
      ]);
    }
  });

  it('returns 403 for an Assessor on every Administration endpoint', () => {
    const guard = new RolesGuard(new Reflector());
    const methods = [
      'accounts',
      'createAccount',
      'updateAccount',
      'deactivateAccount',
      'resetPassword',
      'policy',
      'enforcePolicy',
      'audit',
    ] as const;
    for (const method of methods) {
      const request = {
        method: method === 'accounts' || method === 'policy' || method === 'audit' ? 'GET' : 'POST',
        path: `/api/v1/assessflow/admin/${method}`,
        headers: {},
        params: {},
        actor: {
          id: 'assessor-1',
          name: 'Assessor',
          roles: ['Assessor'],
          scopeType: 'ASSIGNED',
          scopeValues: [],
        },
      };
      const context = {
        getHandler: () => AdministrationController.prototype[method],
        getClass: () => AdministrationController,
        switchToHttp: () => ({ getRequest: () => request }),
      } as never;
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    }
  });

  it('returns 403 on an Administration endpoint when no explicit local role is supplied', () => {
    const guard = new RolesGuard(new Reflector());
    const context = {
      getHandler: () => AdministrationController.prototype.accounts,
      getClass: () => AdministrationController,
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          path: '/api/v1/assessflow/admin/accounts',
          headers: {},
          params: {},
        }),
      }),
    } as never;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
