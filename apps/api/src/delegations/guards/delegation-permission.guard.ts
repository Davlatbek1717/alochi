import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

export type DelegationAction = 'warnings' | 'payments' | 'staff_manage';

export const DELEGATION_PERMISSION_KEY = 'delegation_permission';

/**
 * Marks a route handler as requiring a specific permission when the user is
 * acting under a delegation. If the user is not under a delegation, the guard
 * is a no-op (other RolesGuards still apply). If the user is under a
 * delegation, the requested action MUST be present in delegation.permissions.
 */
export const RequiresDelegationPermission = (action: DelegationAction) =>
  SetMetadata(DELEGATION_PERMISSION_KEY, action);

@Injectable()
export class DelegationPermissionGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredAction = this.reflector.getAllAndOverride<
      DelegationAction | undefined
    >(DELEGATION_PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    if (!requiredAction) return true;

    const req = context.switchToHttp().getRequest();
    const delegationCtx = req?.delegationContext as
      | { permissions?: unknown }
      | null
      | undefined;

    // No active delegation → guard is a no-op (other guards enforce role).
    if (!delegationCtx) return true;

    const permissions = Array.isArray(delegationCtx.permissions)
      ? (delegationCtx.permissions as string[])
      : [];

    if (!permissions.includes(requiredAction)) {
      throw new ForbiddenException({
        code: 'DELEGATION_PERMISSION_DENIED',
        message: `Sizning delegatsiyangizda "${requiredAction}" amali ruxsat etilmagan`,
      });
    }
    return true;
  }
}
