import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface DelegationContext {
  id: string;
  fromUserId: string;
  toUserId: string;
  permissions: unknown;
}

/**
 * Returns the active delegation `id` (UUID) for the authenticated user,
 * or `null` when the user is not currently acting under a delegation.
 *
 * The `DelegationContextInterceptor` populates `req.delegationId` and
 * `req.delegationContext` on each request before the handler runs.
 *
 * Pass `'context'` as the decorator argument to receive the full
 * `DelegationContext` object instead of just the id.
 *
 * @example
 *   give(@CurrentDelegation() delegationId?: string) { ... }
 *   give(@CurrentDelegation('context') ctx: DelegationContext | null) { ... }
 */
export const CurrentDelegation = createParamDecorator(
  (
    data: 'context' | undefined,
    ctx: ExecutionContext,
  ): string | DelegationContext | null => {
    const req = ctx.switchToHttp().getRequest();
    if (data === 'context') {
      return (req?.delegationContext as DelegationContext | null) ?? null;
    }
    return (req?.delegationId as string | null) ?? null;
  },
);
