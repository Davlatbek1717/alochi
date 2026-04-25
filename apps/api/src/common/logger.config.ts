import { Params } from 'nestjs-pino';

export const loggerConfig: Params = {
  pinoHttp: {
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
        : undefined,
    level: process.env.LOG_LEVEL ?? 'info',
    redact: ['req.headers.authorization'],
    serializers: {
      req(req: { method: string; url: string }) {
        return { method: req.method, url: req.url };
      },
    },
  },
};
