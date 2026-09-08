import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { createTestJwt, decodeJwt, extractRolesFromClaims, verifyEntraJwt } from './jwt.util';

describe('jwt.util', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const issuer = 'https://login.microsoftonline.com/test-tenant/v2.0';
  const clientId = 'test-client-id-123';

  describe('decodeJwt', () => {
    it('successfully decodes valid 3-part JWT', () => {
      const token = createTestJwt({ sub: 'user-1', name: 'Alice' }, { secret: 'secret' });
      const decoded = decodeJwt(token);

      expect(decoded.header.alg).toBe('HS256');
      expect(decoded.payload.sub).toBe('user-1');
      expect(decoded.payload.name).toBe('Alice');
      expect(decoded.signature).toBeDefined();
    });

    it('rejects empty or malformed tokens', () => {
      expect(() => decodeJwt('')).toThrow('JWT must be a non-empty string');
      expect(() => decodeJwt('part1.part2')).toThrow('must contain exactly 3 dot-separated parts');
      expect(() => decodeJwt('invalid.invalid.invalid')).toThrow();
    });
  });

  describe('extractRolesFromClaims', () => {
    it('extracts and normalizes roles from array claim', () => {
      const roles = extractRolesFromClaims({
        roles: ['SYSTEM_ADMIN', 'HR_TALENT_ADMIN', 'TECH_MANAGER'],
      });
      expect(roles).toEqual(expect.arrayContaining(['Admin', 'HR', 'Requester']));
    });

    it('extracts from groups claim', () => {
      const roles = extractRolesFromClaims({
        groups: ['AssessmentCoordinator', 'PanelLead'],
      });
      expect(roles).toEqual(expect.arrayContaining(['Coordinator', 'PanelLead']));
    });

    it('extracts from scp (scope) claim', () => {
      const roles = extractRolesFromClaims({
        scp: 'Assessor Auditor',
      });
      expect(roles).toEqual(expect.arrayContaining(['Assessor', 'Auditor']));
    });

    it('ignores unknown or unrecognized roles', () => {
      const roles = extractRolesFromClaims({
        roles: ['unknown-role-xyz'],
      });
      expect(roles).toHaveLength(0);
    });
  });

  describe('verifyEntraJwt - RS256 with asymmetric key pair', () => {
    it('verifies valid RS256 token and derives actor', () => {
      const token = createTestJwt(
        {
          oid: 'user-oid-456',
          name: 'Sarah Connor',
          iss: issuer,
          aud: clientId,
          roles: ['Coordinator', 'HR'],
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        { privateKey, alg: 'RS256' },
      );

      const actor = verifyEntraJwt(token, {
        issuer,
        clientId,
        publicKey,
      });

      expect(actor).toEqual({
        id: 'user-oid-456',
        name: 'Sarah Connor',
        roles: expect.arrayContaining(['Coordinator', 'HR']),
      });
    });

    it('rejects token signed with wrong private key', () => {
      const anotherKey = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
      const token = createTestJwt(
        {
          oid: 'user-oid-456',
          iss: issuer,
          aud: clientId,
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        { privateKey: anotherKey.privateKey, alg: 'RS256' },
      );

      expect(() =>
        verifyEntraJwt(token, {
          issuer,
          clientId,
          publicKey,
        }),
      ).toThrow('JWT signature verification failed');
    });

    it('rejects tampered token content', () => {
      const token = createTestJwt(
        {
          oid: 'user-oid-456',
          iss: issuer,
          aud: clientId,
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        { privateKey, alg: 'RS256' },
      );

      const parts = token.split('.');
      // Tamper with payload
      const tamperedPayload = Buffer.from(
        JSON.stringify({ oid: 'hacked', iss: issuer, aud: clientId }),
      ).toString('base64url');
      const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

      expect(() =>
        verifyEntraJwt(tamperedToken, {
          issuer,
          clientId,
          publicKey,
        }),
      ).toThrow('JWT signature verification failed');
    });
  });

  describe('verifyEntraJwt - HS256 with secret', () => {
    const secret = 'super-secret-key-for-test-suite-minimum-32-chars';

    it('verifies valid HS256 token', () => {
      const token = createTestJwt(
        {
          sub: 'user-sub-789',
          preferred_username: 'bob@example.com',
          iss: issuer,
          aud: clientId,
          roles: ['Assessor'],
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        { secret, alg: 'HS256' },
      );

      const actor = verifyEntraJwt(token, {
        issuer,
        clientId,
        secret,
      });

      expect(actor).toEqual({
        id: 'user-sub-789',
        name: 'bob@example.com',
        roles: ['Assessor'],
      });
    });

    it('rejects token when secret does not match', () => {
      const token = createTestJwt(
        {
          sub: 'user-sub-789',
          iss: issuer,
          aud: clientId,
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        { secret, alg: 'HS256' },
      );

      expect(() =>
        verifyEntraJwt(token, {
          issuer,
          clientId,
          secret: 'wrong-secret',
        }),
      ).toThrow('JWT signature verification failed');
    });
  });

  describe('Claim validation', () => {
    it('rejects expired token', () => {
      const token = createTestJwt(
        {
          oid: 'user-1',
          iss: issuer,
          aud: clientId,
          exp: Math.floor(Date.now() / 1000) - 120, // Expired 2 minutes ago
        },
        { privateKey, alg: 'RS256' },
      );

      expect(() =>
        verifyEntraJwt(token, {
          issuer,
          clientId,
          publicKey,
        }),
      ).toThrow('Token has expired');
    });

    it('allows token within 60-second clock skew tolerance', () => {
      const token = createTestJwt(
        {
          oid: 'user-1',
          iss: issuer,
          aud: clientId,
          exp: Math.floor(Date.now() / 1000) - 30, // Expired 30 seconds ago (< 60s tolerance)
        },
        { privateKey, alg: 'RS256' },
      );

      const actor = verifyEntraJwt(token, {
        issuer,
        clientId,
        publicKey,
      });

      expect(actor.id).toBe('user-1');
    });

    it('rejects not-yet-valid token (nbf in future)', () => {
      const token = createTestJwt(
        {
          oid: 'user-1',
          iss: issuer,
          aud: clientId,
          exp: Math.floor(Date.now() / 1000) + 3600,
          nbf: Math.floor(Date.now() / 1000) + 300, // Valid 5 minutes in future
        },
        { privateKey, alg: 'RS256' },
      );

      expect(() =>
        verifyEntraJwt(token, {
          issuer,
          clientId,
          publicKey,
        }),
      ).toThrow('Token is not active yet');
    });

    it('rejects issuer mismatch', () => {
      const token = createTestJwt(
        {
          oid: 'user-1',
          iss: 'https://login.microsoftonline.com/other-tenant/v2.0',
          aud: clientId,
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        { privateKey, alg: 'RS256' },
      );

      expect(() =>
        verifyEntraJwt(token, {
          issuer,
          clientId,
          publicKey,
        }),
      ).toThrow('Issuer mismatch');
    });

    it('rejects audience mismatch', () => {
      const token = createTestJwt(
        {
          oid: 'user-1',
          iss: issuer,
          aud: 'different-client-id',
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        { privateKey, alg: 'RS256' },
      );

      expect(() =>
        verifyEntraJwt(token, {
          issuer,
          clientId,
          publicKey,
        }),
      ).toThrow('Audience mismatch');
    });

    it('accepts audience array containing expected clientId', () => {
      const token = createTestJwt(
        {
          oid: 'user-1',
          iss: issuer,
          aud: ['other-audience', clientId],
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        { privateKey, alg: 'RS256' },
      );

      const actor = verifyEntraJwt(token, {
        issuer,
        clientId,
        publicKey,
      });

      expect(actor.id).toBe('user-1');
    });

    it('rejects token without user identifier claim', () => {
      const token = createTestJwt(
        {
          iss: issuer,
          aud: clientId,
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        { privateKey, alg: 'RS256' },
      );

      expect(() =>
        verifyEntraJwt(token, {
          issuer,
          clientId,
          publicKey,
        }),
      ).toThrow('Token is missing user identifier claim');
    });
  });
});
