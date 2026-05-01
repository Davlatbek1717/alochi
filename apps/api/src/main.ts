import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { EmptyStringToUndefinedInterceptor } from './common/interceptors/empty-string-to-undefined.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.use(helmet());

  const config = new DocumentBuilder()
    .setTitle("A'lochi API")
    .setDescription("A'lochi ta'lim platformasi API hujjatlari")
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
  app.enableCors({
    origin:
      process.env.NODE_ENV === 'production'
        ? (process.env.ALLOWED_ORIGIN ?? 'https://yourdomain.com')
        : true,
    credentials: true,
  });
  app.useGlobalInterceptors(new EmptyStringToUndefinedInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
