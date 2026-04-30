import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

interface ValidationError {
  field: string;
  message: string;
}

interface EnrichedErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
    errors?: ValidationError[];
  };
  meta: { timestamp: string };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    let code = this.statusToCode(status);
    let message =
      exception instanceof Error ? exception.message : 'Internal server error';
    let details: unknown;
    let errors: ValidationError[] | undefined;

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;

        // Enriched shape: { code, message, details? }
        if (typeof r.code === 'string') {
          code = r.code;
        }

        if (Array.isArray(r.message)) {
          if (typeof r.message[0] === 'string') {
            message = (r.message as string[]).join(', ');
            if (status === 422 || status === 400) {
              errors = (r.message as string[]).map((m: string) => {
                const match = /^([a-zA-Z_]+)\s/.exec(m);
                return { field: match?.[1] ?? 'unknown', message: m };
              });
            }
          } else {
            message = String(r.message[0]);
          }
        } else if (typeof r.message === 'string') {
          message = r.message;
        } else {
          message = exception.message;
        }

        if (r.details !== undefined) {
          details = r.details;
        }
      } else if (typeof res === 'string') {
        message = res;
      } else {
        message = exception.message;
      }
    }

    if (status >= 500) {
      this.logger.error(
        `${status} [${code}] — ${message}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    const body: EnrichedErrorBody = {
      success: false,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
        ...(errors ? { errors } : {}),
      },
      meta: { timestamp: new Date().toISOString() },
    };

    response.status(status).json(body);
  }

  private statusToCode(status: number): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
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
        return 'TOO_MANY_REQUESTS';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'INTERNAL_ERROR';
      default:
        return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
    }
  }
}
