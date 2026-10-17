import { describe, expect, it, vi } from 'vitest';
import { createCorsOriginChecker, isOriginAllowed, parseAllowedOrigins } from './cors.util';

describe('CORS origin configuration', () => {
  it('reads a comma-separated allowlist and trims each exact origin', () => {
    expect(
      parseAllowedOrigins(
        ' https://portal.example.com , http://localhost:5174,https://portal.example.com ',
      ),
    ).toEqual(['https://portal.example.com', 'http://localhost:5174']);
  });

  it('allows only an exact configured origin', () => {
    const checker = createCorsOriginChecker('https://portal.example.com');
    const callback = vi.fn();

    checker('https://portal.example.com', callback);
    expect(callback).toHaveBeenCalledWith(null, true);
    expect(
      isOriginAllowed('https://portal.example.com.evil.test', ['https://portal.example.com']),
    ).toBe(false);
    expect(isOriginAllowed('https://PORTAL.example.com', ['https://portal.example.com'])).toBe(
      false,
    );
    expect(isOriginAllowed('https://portal.example.com/', ['https://portal.example.com'])).toBe(
      false,
    );
  });

  it('does not add built-in domains when the environment variable is absent', () => {
    expect(parseAllowedOrigins()).toEqual([]);
    expect(isOriginAllowed('http://localhost:5174', parseAllowedOrigins())).toBe(false);
  });

  it('does not interpret wildcards as allowed origins', () => {
    const checker = createCorsOriginChecker('https://*.example.com,*');
    const callback = vi.fn();

    checker('https://preview.example.com', callback);
    expect(callback).toHaveBeenCalledWith(null, false);
    expect(parseAllowedOrigins('https://*.example.com,*')).toEqual([]);
  });

  it('permits requests without an Origin header', () => {
    const checker = createCorsOriginChecker('https://portal.example.com');
    const callback = vi.fn();

    checker(undefined, callback);
    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it('rejects a configured origin that does not exactly match', () => {
    const checker = createCorsOriginChecker('https://portal.example.com');
    const callback = vi.fn();

    checker('https://other.example.com', callback);
    expect(callback).toHaveBeenCalledWith(null, false);
  });
});
