import { AuthController } from '../src/auth/auth.controller';

/**
 * Phase 1.5 — global rate limit + named auth limit.
 *
 * The default limit (100/min) is enforced by ThrottlerGuard registered
 * as a global APP_GUARD in AppModule. Auth endpoints additionally pin
 * to the named "auth" config (5/min) via the @Throttle decorator on
 * AuthController.
 *
 * We assert that the @Throttle metadata is attached to AuthController.
 * Full e2e flood coverage belongs in integration tests with a live
 * Redis-backed throttler.
 */
describe('Throttler wiring', () => {
  it('AuthController has at least one throttle metadata key', () => {
    const keys = Reflect.getMetadataKeys(AuthController);
    const throttleKey = keys.find(
      (k) => typeof k === 'string' && k.toUpperCase().includes('THROTTLER'),
    );
    expect(throttleKey).toBeDefined();
  });
});
