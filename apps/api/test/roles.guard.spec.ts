import { RolesGuard } from '../src/auth/roles.guard';
import { Reflector } from '@nestjs/core';

describe('RolesGuard', () => {
  function buildCtx(userRole: string, requiredRoles: string[]) {
    const mockReflector = { getAllAndOverride: jest.fn().mockReturnValue(requiredRoles) };
    const mockCtx = {
      switchToHttp: () => ({ getRequest: () => ({ user: { role: userRole } }) }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    };
    return { guard: new RolesGuard(mockReflector as any), ctx: mockCtx as any };
  }

  it('superadmin passes any role check', () => {
    const { guard, ctx } = buildCtx('superadmin', ['filadmin']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('filadmin passes filadmin check', () => {
    const { guard, ctx } = buildCtx('filadmin', ['filadmin']);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('student fails filadmin check', () => {
    const { guard, ctx } = buildCtx('student', ['filadmin']);
    expect(guard.canActivate(ctx)).toBe(false);
  });

  it('no roles required — everyone passes', () => {
    const { guard, ctx } = buildCtx('student', []);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('no user in request — fails', () => {
    const mockReflector = { getAllAndOverride: jest.fn().mockReturnValue(['mentor']) };
    const mockCtx = {
      switchToHttp: () => ({ getRequest: () => ({ user: null }) }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    };
    const guard = new RolesGuard(mockReflector as any);
    expect(guard.canActivate(mockCtx as any)).toBe(false);
  });
});
