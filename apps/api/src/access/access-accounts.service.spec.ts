import { UnauthorizedException } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AccessAccountsService } from './access-accounts.service';
import type { PrismaService } from '../database/prisma.service';

const originalDomain = process.env.ACCESS_ALLOWED_EMAIL_DOMAIN;

afterEach(() => {
  if (originalDomain === undefined) delete process.env.ACCESS_ALLOWED_EMAIL_DOMAIN;
  else process.env.ACCESS_ALLOWED_EMAIL_DOMAIN = originalDomain;
});

describe('AccessAccountsService login domain validation', () => {
  it('rejects disallowed domains on the server before account lookup', async () => {
    process.env.ACCESS_ALLOWED_EMAIL_DOMAIN = 'company.example';
    const findUnique = vi.fn();
    const prisma = {
      enabled: true,
      accessAccount: { findUnique },
    } as unknown as PrismaService;
    const accounts = new AccessAccountsService(prisma);

    await expect(
      accounts.authenticate('person@outside.example', 'password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('uses the configured domain when accepting a login email for lookup', async () => {
    process.env.ACCESS_ALLOWED_EMAIL_DOMAIN = 'company.example';
    const findUnique = vi.fn().mockResolvedValue(null);
    const prisma = {
      enabled: true,
      accessAccount: { findUnique },
    } as unknown as PrismaService;
    const accounts = new AccessAccountsService(prisma);

    await expect(
      accounts.authenticate('Person@Company.Example', 'password'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(findUnique).toHaveBeenCalledWith({ where: { email: 'person@company.example' } });
  });
});
