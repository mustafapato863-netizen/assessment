import { describe, it, expect, vi } from 'vitest';
import {
  matchOriginPattern,
  isOriginAllowed,
  createCorsOriginChecker,
  DEFAULT_ALLOWED_ORIGIN_PATTERNS,
} from './cors.util';

describe('CORS Utilities', () => {
  describe('matchOriginPattern', () => {
    it('matches exact domain origins', () => {
      expect(
        matchOriginPattern(
          'https://web-opal-tau-44.vercel.app',
          'https://web-opal-tau-44.vercel.app',
        ),
      ).toBe(true);
      expect(
        matchOriginPattern(
          'https://web-opal-tau-44.vercel.app/',
          'https://web-opal-tau-44.vercel.app',
        ),
      ).toBe(true);
      expect(
        matchOriginPattern(
          'https://web-opal-tau-44.vercel.app',
          'https://web-opal-tau-44.vercel.app/',
        ),
      ).toBe(true);
    });

    it('handles case insensitivity', () => {
      expect(
        matchOriginPattern(
          'HTTPS://WEB-OPAL-TAU-44.VERCEL.APP',
          'https://web-opal-tau-44.vercel.app',
        ),
      ).toBe(true);
    });

    it('matches wildcard https://*.vercel.app', () => {
      expect(matchOriginPattern('https://web-opal-tau-44.vercel.app', 'https://*.vercel.app')).toBe(
        true,
      );
      expect(
        matchOriginPattern('https://my-preview-branch-123.vercel.app', 'https://*.vercel.app'),
      ).toBe(true);
      expect(matchOriginPattern('http://insecure.vercel.app', 'https://*.vercel.app')).toBe(false);
    });

    it('matches wildcard *.vercel.app across http and https', () => {
      expect(matchOriginPattern('https://web-opal-tau-44.vercel.app', '*.vercel.app')).toBe(true);
      expect(matchOriginPattern('https://preview-1.web.vercel.app', '*.vercel.app')).toBe(true);
      expect(matchOriginPattern('https://evil-vercel.app.attacker.com', '*.vercel.app')).toBe(
        false,
      );
    });

    it('matches wildcard *.zainx.cloud and *.dokploy.app', () => {
      expect(matchOriginPattern('https://bkassess.zainx.cloud', '*.zainx.cloud')).toBe(true);
      expect(matchOriginPattern('https://assessflow-preview.dokploy.app', '*.dokploy.app')).toBe(
        true,
      );
    });

    it('matches universal wildcard *', () => {
      expect(matchOriginPattern('https://random-domain.com', '*')).toBe(true);
    });

    it('rejects completely mismatched origins', () => {
      expect(
        matchOriginPattern('https://evil-site.com', 'https://web-opal-tau-44.vercel.app'),
      ).toBe(false);
      expect(matchOriginPattern('https://evil.com', '*.vercel.app')).toBe(false);
    });
  });

  describe('isOriginAllowed', () => {
    it('always permits empty or undefined origins (server/curl/mobile)', () => {
      expect(isOriginAllowed(undefined, DEFAULT_ALLOWED_ORIGIN_PATTERNS)).toBe(true);
      expect(isOriginAllowed('', DEFAULT_ALLOWED_ORIGIN_PATTERNS)).toBe(true);
    });

    it('allows Vercel frontend by default', () => {
      expect(
        isOriginAllowed('https://web-opal-tau-44.vercel.app', DEFAULT_ALLOWED_ORIGIN_PATTERNS),
      ).toBe(true);
    });

    it('allows localhost ports by default', () => {
      expect(isOriginAllowed('http://localhost:5173', DEFAULT_ALLOWED_ORIGIN_PATTERNS)).toBe(true);
      expect(isOriginAllowed('http://localhost:5174', DEFAULT_ALLOWED_ORIGIN_PATTERNS)).toBe(true);
      expect(isOriginAllowed('http://localhost:3000', DEFAULT_ALLOWED_ORIGIN_PATTERNS)).toBe(true);
    });

    it('blocks unauthorized origins', () => {
      expect(isOriginAllowed('https://attacker.io', DEFAULT_ALLOWED_ORIGIN_PATTERNS)).toBe(false);
    });
  });

  describe('createCorsOriginChecker callback behavior', () => {
    it('returns callback(null, true) for allowed origins', () => {
      const checker = createCorsOriginChecker();
      const callback = vi.fn();

      checker('https://web-opal-tau-44.vercel.app', callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('returns callback(null, true) for undefined origin (server-to-server)', () => {
      const checker = createCorsOriginChecker();
      const callback = vi.fn();

      checker(undefined, callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('returns callback(null, false) WITHOUT throwing Error for blocked origin', () => {
      const checker = createCorsOriginChecker();
      const callback = vi.fn();

      checker('https://blocked-malicious-site.org', callback);
      // Must NOT pass an Error instance to avoid Express 500 crash
      expect(callback).toHaveBeenCalledWith(null, false);
      expect(callback).not.toHaveBeenCalledWith(expect.any(Error));
    });

    it('allows custom origins passed via environment parameter', () => {
      const checker = createCorsOriginChecker('https://custom-portal.company.com');
      const callback = vi.fn();

      checker('https://custom-portal.company.com', callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('allows everything when env is *', () => {
      const checker = createCorsOriginChecker('*');
      const callback = vi.fn();

      checker('https://any-external-domain.com', callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });
  });
});
