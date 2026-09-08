import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ObservabilityService } from './observability';

describe('OpenTelemetry Observability Module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_SERVICE_NAME;
  });

  it('initializes in safe no-op mode by default when OTEL_EXPORTER_OTLP_ENDPOINT is unset', () => {
    const obs = new ObservabilityService();
    const config = obs.init();

    expect(config.isEnabled).toBe(false);
    expect(config.mode).toBe('no-op');
    expect(config.endpoint).toBeUndefined();
    expect(config.serviceName).toBe('assessflow-api');
  });

  it('respects custom OTEL_SERVICE_NAME in no-op mode', () => {
    process.env.OTEL_SERVICE_NAME = 'assessflow-custom-svc';
    const obs = new ObservabilityService();
    const config = obs.init();

    expect(config.serviceName).toBe('assessflow-custom-svc');
    expect(config.mode).toBe('no-op');
  });

  it('wires OTLP exporter when OTEL_EXPORTER_OTLP_ENDPOINT is provided', () => {
    process.env.OTEL_SERVICE_NAME = 'assessflow-prod';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'https://eastus-8.in.applicationinsights.azure.com/v2.1/track';

    const obs = new ObservabilityService();
    const config = obs.init();

    expect(config.isEnabled).toBe(true);
    expect(config.mode).toBe('otlp');
    expect(config.endpoint).toBe('https://eastus-8.in.applicationinsights.azure.com/v2.1/track');
    expect(config.serviceName).toBe('assessflow-prod');
  });

  it('creates spans carrying correlationId in both no-op and active modes without throwing', () => {
    const obs = new ObservabilityService();
    obs.init();

    const span = obs.startSpan('http_request', 'corr-test-123', { path: '/api/v1/cases' });
    expect(span.id).toBeDefined();
    expect(span.name).toBe('http_request');
    expect(span.correlationId).toBe('corr-test-123');
    expect(span.attributes.service).toBe('assessflow-api');

    // Ending span is a safe no-op
    expect(() => span.end({ status: 200 })).not.toThrow();
  });
});
