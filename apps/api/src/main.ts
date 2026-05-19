import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const webOrigin = process.env.WEB_ORIGIN;
  app.enableCors({
    origin: webOrigin ? webOrigin.split(',').map((o) => o.trim()) : true,
    credentials: true,
  });

  await app.listen({
    port: Number(process.env.PORT ?? 3001),
    host: '0.0.0.0',
  });
}

void bootstrap();
