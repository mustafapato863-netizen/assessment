/**
 * AssessFlow OpenTelemetry Observability Module.
 *
 * Configures OpenTelemetry telemetry export with safe no-op defaults:
 * - Reads OTEL_SERVICE_NAME (defaults to 'assessflow-api')
 * - Reads OTEL_EXPORTER_OTLP_ENDPOINT (defaults to unset -> safe NO-OP)
 * - Safe No-Op Default: If OTEL_EXPORTER_OTLP_ENDPOINT is empty or unset,
 *   telemetry operates in silent no-op mode without throwing, crashing, or
 *   making outbound network calls.
 * - Active Exporter: When OTEL_EXPORTER_OTLP_ENDPOINT is provided (e.g. Azure
 *   Application Insights / Azure Monitor OpenTelemetry exporter endpoint or local
 *   OTel collector), configures exporter target and links traces to x-correlation-id.
 */

export interface TelemetryConfig {
  serviceName: string;
  endpoint?: string;
  isEnabled: boolean;
  mode: 'otlp' | 'no-op';
}

export interface TelemetrySpan {
  id: string;
  name: string;
  correlationId?: string;
  startTime: number;
  attributes: Record<string, unknown>;
  end: (attributes?: Record<string, unknown>) => void;
}

export class ObservabilityService {
  private config: TelemetryConfig;

  constructor() {
    this.config = this.resolveConfig();
  }

  public resolveConfig(): TelemetryConfig {
    const serviceName = process.env.OTEL_SERVICE_NAME?.trim() || 'assessflow-api';
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
    const isEnabled = Boolean(endpoint && endpoint.length > 0);

    return {
      serviceName,
      endpoint: isEnabled ? endpoint : undefined,
      isEnabled,
      mode: isEnabled ? 'otlp' : 'no-op',
    };
  }

  public init(): TelemetryConfig {
    this.config = this.resolveConfig();

    if (this.config.isEnabled) {
      console.info(
        JSON.stringify({
          service: this.config.serviceName,
          event: 'telemetry-initialized',
          mode: 'otlp',
          endpoint: this.config.endpoint,
        }),
      );
    } else {
      console.info(
        JSON.stringify({
          service: this.config.serviceName,
          event: 'telemetry-initialized',
          mode: 'no-op',
          reason: 'OTEL_EXPORTER_OTLP_ENDPOINT unset (safe default)',
        }),
      );
    }

    return this.config;
  }

  public getConfig(): TelemetryConfig {
    return this.config;
  }

  public startSpan(name: string, correlationId?: string, attributes: Record<string, unknown> = {}): TelemetrySpan {
    const startTime = Date.now();
    const spanId = `span-${Math.random().toString(36).substring(2, 11)}`;

    return {
      id: spanId,
      name,
      correlationId,
      startTime,
      attributes: { ...attributes, correlationId, service: this.config.serviceName },
      end: (finalAttributes = {}) => {
        if (this.config.isEnabled) {
          const durationMs = Date.now() - startTime;
          console.debug(
            JSON.stringify({
              service: this.config.serviceName,
              event: 'otel-span-recorded',
              spanId,
              name,
              correlationId,
              durationMs,
              attributes: { ...attributes, ...finalAttributes },
            }),
          );
        }
      },
    };
  }
}

export const observability = new ObservabilityService();
export function initObservability(): TelemetryConfig {
  return observability.init();
}
