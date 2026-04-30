import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  StreamableFile,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta: { timestamp: string };
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  T | ApiSuccessEnvelope<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<T | ApiSuccessEnvelope<T>> {
    return next.handle().pipe(
      map((data) => {
        // Skip wrapping for streams/buffers (e.g., file downloads)
        if (
          data instanceof StreamableFile ||
          (typeof Buffer !== 'undefined' && Buffer.isBuffer(data)) ||
          this.isStream(data)
        ) {
          return data;
        }
        return {
          success: true as const,
          data,
          meta: { timestamp: new Date().toISOString() },
        };
      }),
    );
  }

  private isStream(value: unknown): boolean {
    return (
      value !== null &&
      typeof value === 'object' &&
      typeof (value as { pipe?: unknown }).pipe === 'function'
    );
  }
}
