import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Response } from 'express';

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
    if (exception instanceof HttpException) {
      const res = exception.getResponse();
      message = typeof res === 'object' && res !== null && 'message' in res
        ? (Array.isArray((res as any).message) ? (res as any).message.join(', ') : String((res as any).message))
        : exception.message;
    } else {
      message = exception instanceof Error ? exception.message : 'Internal server error';
    }

    if (status >= 500) {
      this.logger.error(`${status} — ${message}`, exception instanceof Error ? exception.stack : undefined);
    }

    response.status(status).json({
      success: false,
      error: message,
      meta: { timestamp: new Date().toISOString() },
    });
  }
}
