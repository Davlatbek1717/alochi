import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class EmptyStringToUndefinedInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    if (req?.body && typeof req.body === 'object') {
      this.cleanEmpty(req.body);
    }
    if (req?.query && typeof req.query === 'object') {
      this.cleanEmpty(req.query);
    }
    return next.handle();
  }

  private cleanEmpty(obj: Record<string, unknown>): void {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (value === '') {
        delete obj[key];
      } else if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value)
      ) {
        this.cleanEmpty(value as Record<string, unknown>);
      }
    }
  }
}
