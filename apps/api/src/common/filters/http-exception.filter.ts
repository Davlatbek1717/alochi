import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

interface ValidationError {
  field: string;
  message: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception instanceof HttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    let message: string;
    let errors: ValidationError[] | undefined;

    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      if (typeof res === 'object' && res !== null) {
        const r = res as Record<string, unknown>;
        if (Array.isArray(r.message)) {
          // class-validator produces string[] or ValidationError[]
          if (typeof r.message[0] === 'string') {
            message = r.message.join(', ');
            if (status === 422 || status === 400) {
              errors = r.message.map((m: string) => {
                const match = /^([a-zA-Z_]+)\s/.exec(m);
                return { field: match?.[1] ?? 'unknown', message: m };
              });
            }
          } else {
            message = String(r.message[0]);
          }
        } else {
          message = typeof r.message === 'string' ? r.message : exception.message;
        }
      } else {
        message = exception.message;
      }
    } else {
      message = exception instanceof Error ? exception.message : 'Internal server error';
    }

    if (status >= 500) {
      this.logger.error(`${status} — ${message}`, exception instanceof Error ? exception.stack : undefined);
    }

    const body: Record<string, unknown> = {
      success: false,
      message,
      meta: { timestamp: new Date().toISOString() },
    };
    if (errors) body.errors = errors;

    response.status(status).json(body);
  }
}
