import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { ApprovalsDomain } from '../cases/domain/approvals.domain';
import { currentCorrelationId, runWithCorrelationId } from './correlation.context';
import { securityHeadersMiddleware } from './security.middleware';

describe('currentCorrelationId', () => {
  it('returns a fresh corr-<uuid> outside a request', () => {
    const first = currentCorrelationId();
    const second = currentCorrelationId();

    expect(first).toMatch(/^corr-[0-9a-f-]{36}$/);
    expect(second).not.toBe(first);
  });

  it('returns the correlation ID of the running request', () => {
    runWithCorrelationId('trace-request-7', () => {
      expect(currentCorrelationId()).toBe('trace-request-7');
    });
  });

  it('is set for each request by the security middleware, including the echoed header', () => {
    const req = { headers: { 'x-correlation-id': 'trace-middleware-42' } } as unknown as Request;
    const res = { setHeader: vi.fn() } as unknown as Response;
    let seenInsideRequest: string | undefined;
    const next = vi.fn(() => {
      seenInsideRequest = currentCorrelationId();
    });

    securityHeadersMiddleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(seenInsideRequest).toBe('trace-middleware-42');
  });

  it('puts the request correlation ID on domain validation errors', () => {
    runWithCorrelationId('trace-domain-9', () => {
      let thrown: unknown;
      try {
        ApprovalsDomain.validateDecision({} as never);
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBeDefined();
      const body = (
        thrown as { getResponse(): { error: { correlationId: string } } }
      ).getResponse();
      expect(body.error.correlationId).toBe('trace-domain-9');
    });
  });
});
