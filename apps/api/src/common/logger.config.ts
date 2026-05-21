import { Params } from 'nestjs-pino';

const SENSITIVE_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.body.password',
  'req.body.pin',
  'req.body.token',
  'req.body.refreshToken',
  'req.body.totpSecret',
  'req.body.backupCodes',
  'res.body.accessToken',
  'res.body.refreshToken',
];

export const loggerConfig: Params = {
  pinoHttp: {
    transport:
      process.env.NODE_ENV !== 'production'
        ? {
            target: 'pino-pretty',
            options: { colorize: true, singleLine: true },
          }
        : undefined,
    level: process.env.LOG_LEVEL ?? 'info',
    redact: {
      paths: SENSITIVE_PATHS,
      censor: '[MASKED]',
    },
    serializers: {
      req(req: any) {
        return {
          method: req.method,
          url: req.url,
          ip: req.remoteAddress,
          userAgent: req.headers?.['user-agent'],
        };
      },
      res(res: any) {
        return { statusCode: res.statusCode };
      },
    },
    customProps(req: any) {
      const user = (req as any).user;
      return {
        userId: user?.userId ?? undefined,
        tenantId: user?.tenantId ?? undefined,
        role: user?.role ?? undefined,
      };
    },
    autoLogging: {
      ignore(req: any) {
        // Suppress noisy health/ping endpoints from access logs
        return (
          req.url?.includes('/health') ||
          req.url?.includes('/study-time/ping') ||
          req.url?.includes('/devices') && req.url?.includes('/ping')
        );
      },
    },
  },
};
