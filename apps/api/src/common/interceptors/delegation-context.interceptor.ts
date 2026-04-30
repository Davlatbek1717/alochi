import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Resolves the active delegation (if any) for the authenticated user and
 * attaches it to the request as `req.delegationContext`. The downstream
 * `@CurrentDelegation()` decorator reads from that field.
 *
 * - Skips the lookup for unauthenticated requests (no `req.user.userId`).
 * - Lookup is best-effort: any DB error leaves the context `null` rather
 *   than failing the request, since most endpoints don't require it.
 * - Result is cached on the request object so repeated reads inside a
 *   single request don't hit the DB twice.
 */
@Injectable()
export class DelegationContextInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const userId = req?.user?.userId;

    if (!userId) {
      req.delegationContext = null;
      req.delegationId = null;
      return next.handle();
    }

    if (Object.prototype.hasOwnProperty.call(req, 'delegationContext')) {
      return next.handle();
    }

    const lookup = this.prisma.delegation
      .findFirst({
        where: { toUserId: userId, status: 'active' },
        select: {
          id: true,
          fromUserId: true,
          toUserId: true,
          permissions: true,
        },
      })
      .catch(() => null)
      .then((delegation) => {
        req.delegationContext = delegation;
        req.delegationId = delegation?.id ?? null;
      });

    return from(lookup).pipe(switchMap(() => next.handle()));
  }
}
