import * as Sentry from '@sentry/nestjs';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

/**
 * Sentry instrumentation — must be imported BEFORE any other module.
 * Import this file as the very first line of main.ts.
 *
 * When SENTRY_DSN is not set (local dev, CI without secrets) the
 * SDK silently no-ops so no crashes or console noise.
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  integrations: [nodeProfilingIntegration()],
  // Capture 100% of transactions in dev; tune down in production
  // once you understand the volume (e.g. 0.1 = 10%).
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  // Don't send events for missing-route 404s or intentional 401s —
  // they're normal operation, not bugs.
  ignoreErrors: [/NotFoundException/, /UnauthorizedException/],
});
