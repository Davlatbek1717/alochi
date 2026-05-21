import {
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Observable, from, switchMap, tap } from 'rxjs';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject(CACHE_MANAGER) private cache: Cache) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ headers: Record<string, string>; method: string }>();
    const key = req.headers['idempotency-key'];

    // Only apply to mutating requests with an Idempotency-Key header
    if (!key || !['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next.handle();
    }

    const cacheKey = `idem:${key}`;

    return from(this.cache.get<unknown>(cacheKey)).pipe(
      switchMap((cached) => {
        if (cached !== undefined && cached !== null) {
          return from(Promise.resolve(cached));
        }
        return next.handle().pipe(
          tap((response) => {
            // Cache fire-and-forget; don't let cache errors break the response
            this.cache.set(cacheKey, response, IDEMPOTENCY_TTL_MS).catch(() => undefined);
          }),
        );
      }),
    );
  }
}
