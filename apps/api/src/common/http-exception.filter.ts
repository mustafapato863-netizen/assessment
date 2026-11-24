import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@assessflow/database';
import type { Request, Response } from 'express';
import { currentCorrelationId } from './correlation.context';

interface ZodLikeError extends Error {
  issues: Array<{ message?: string }>;
  flatten: () => { fieldErrors: Record<string, string[]> };
}

function isZodLikeError(exception: unknown): exception is ZodLikeError {
  return (
    exception instanceof Error &&
    exception.name === 'ZodError' &&
    'issues' in exception &&
    Array.isArray((exception as ZodLikeError).issues) &&
    typeof (exception as ZodLikeError).flatten === 'function'
  );
}

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'VALIDATION_ERROR';
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN';
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND';
    case HttpStatus.CONFLICT:
      return 'CONFLICT';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'UNPROCESSABLE_ENTITY';
    case HttpStatus.TOO_MANY_REQUESTS:
      return 'RATE_LIMITED';
    case HttpStatus.SERVICE_UNAVAILABLE:
      return 'SERVICE_UNAVAILABLE';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED';
  }
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request & { correlationId?: string }>();
    const response = ctx.getResponse<Response>();

    const correlationId =
      request?.correlationId ??
      (typeof request?.headers?.['x-correlation-id'] === 'string'
        ? request.headers['x-correlation-id']
        : undefined) ??
      currentCorrelationId();

    response.setHeader('x-correlation-id', correlationId);

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const raw = exception.getResponse();

      if (
        raw &&
        typeof raw === 'object' &&
        'error' in raw &&
        raw.error &&
        typeof raw.error === 'object'
      ) {
        const errObj = raw.error as Record<string, unknown>;
        const retryAfter = errObj.retryAfterSeconds;
        if (typeof retryAfter === 'number' && Number.isFinite(retryAfter) && retryAfter > 0) {
          response.setHeader('Retry-After', Math.ceil(retryAfter));
        }
        response.status(status).json({
          error: {
            ...errObj,
            code: typeof errObj.code === 'string' ? errObj.code : defaultCodeForStatus(status),
            message:
              typeof errObj.message === 'string' && errObj.message.trim()
                ? errObj.message
                : exception.message,
            correlationId:
              typeof errObj.correlationId === 'string' && errObj.correlationId.trim()
                ? errObj.correlationId
                : correlationId,
          },
        });
        return;
      }

      let message = exception.message;
      let fieldErrors: Record<string, string[]> | undefined;
      let code = defaultCodeForStatus(status);

      if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        if (typeof obj.code === 'string') code = obj.code;
        if (Array.isArray(obj.message)) {
          message = obj.message.map(String).join(', ');
        } else if (typeof obj.message === 'string' && obj.message.trim()) {
          message = obj.message;
        }
        if (obj.fieldErrors && typeof obj.fieldErrors === 'object') {
          fieldErrors = obj.fieldErrors as Record<string, string[]>;
        }
      } else if (typeof raw === 'string' && raw.trim()) {
        message = raw;
      }

      response.status(status).json({
        error: {
          code,
          message,
          ...(fieldErrors ? { fieldErrors } : {}),
          correlationId,
        },
      });
      return;
    }

    if (isZodLikeError(exception)) {
      const flattened = exception.flatten();
      const firstIssue = exception.issues[0]?.message ?? 'Review the highlighted request fields.';
      response.status(HttpStatus.BAD_REQUEST).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: firstIssue,
          fieldErrors: flattened.fieldErrors,
          correlationId,
        },
      });
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2023' || exception.code === 'P2025') {
        response.status(HttpStatus.NOT_FOUND).json({
          error: {
            code: 'RESOURCE_NOT_FOUND',
            message: 'The requested record could not be found.',
            correlationId,
          },
        });
        return;
      }
      if (exception.code === 'P2002') {
        response.status(HttpStatus.CONFLICT).json({
          error: {
            code: 'CONFLICT',
            message: 'A conflicting record already exists.',
            correlationId,
          },
        });
        return;
      }
      if (exception.code === 'P2003') {
        response.status(HttpStatus.BAD_REQUEST).json({
          error: {
            code: 'INVALID_REFERENCE',
            message: 'Referenced record could not be found.',
            correlationId,
          },
        });
        return;
      }
    }

    this.logger.error(
      JSON.stringify({
        event: 'unhandled-api-exception',
        correlationId,
        method: request?.method,
        path: request?.originalUrl ?? request?.url,
        message: exception instanceof Error ? exception.message : String(exception),
      }),
    );

    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while processing the request.',
        correlationId,
      },
    });
  }
}
