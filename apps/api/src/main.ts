// Sentry must be imported first so it can instrument all subsequent modules.
import './instrument';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger as NestLogger, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { EmptyStringToUndefinedInterceptor } from './common/interceptors/empty-string-to-undefined.interceptor';

/**
 * Production env vars whose absence would break a deployment in
 * subtle ways (CORS open to *, JWTs unsigned, etc). We bail loudly on
 * boot rather than discover it at first request.
 */
const REQUIRED_PROD_ENV = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ALLOWED_ORIGIN',
] as const;

function assertProdEnv(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const missing = REQUIRED_PROD_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required production env vars: ${missing.join(', ')}. ` +
        `Set them or run with NODE_ENV != production for dev defaults.`,
    );
  }
  // Reject the placeholder secrets that ship in .env.example so a
  // half-configured deploy fails fast instead of accepting forged JWTs
  // signed with a publicly known key.
  for (const k of ['JWT_SECRET', 'JWT_REFRESH_SECRET'] as const) {
    if (process.env[k]?.includes('your-super-secret')) {
      throw new Error(
        `${k} still uses the .env.example placeholder. Generate a real secret (openssl rand -base64 64).`,
      );
    }
  }
}

async function bootstrap() {
  assertProdEnv();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Trust the immediate proxy so X-Forwarded-* headers are honoured —
  // needed for accurate client IPs in audit logs and any future rate
  // limiter that keys on IP. Set to an integer hop count (1) in
  // production behind a single reverse proxy; bump if you stack more.
  if (process.env.NODE_ENV === 'production') {
    app.getHttpAdapter().getInstance().set('trust proxy', 1);
  }

  app.use(helmet());

  // Explicit body size caps so a single oversized POST cannot OOM the
  // node process. 1 MB covers the largest legitimate payload (face
  // enrol vector, exam answers blob); larger uploads should be routed
  // through dedicated multipart endpoints.
  app.use(json({ limit: '1mb' }));
  app.use(urlencoded({ extended: true, limit: '1mb' }));

  // Swagger is dev-only — in production the docs leak the entire
  // route map, including admin endpoints, to anyone on the internet.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle("Adouptivo API")
      .setDescription("Adouptivo ta'lim platformasi API hujjatlari")
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableCors({
    // Production: must come from an explicit allow-list (assertProdEnv
    // guarantees the var exists). Comma-separate multiple origins —
    // useful for staging + prod sharing one image.
    // Dev: reflect any origin so localhost:3000/3001 + LAN IPs work.
    origin:
      process.env.NODE_ENV === 'production'
        ? (process.env.ALLOWED_ORIGIN ?? '').split(',').map((s) => s.trim())
        : true,
    credentials: true,
  });

  app.useGlobalInterceptors(new EmptyStringToUndefinedInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Flush in-flight requests on SIGTERM so a rolling deploy doesn't
  // cut connections mid-response.
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  new NestLogger('Bootstrap').log(
    `Adouptivo API listening on :${port} (${process.env.NODE_ENV ?? 'development'})`,
  );
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Bootstrap failed:', err);
  process.exit(1);
});
