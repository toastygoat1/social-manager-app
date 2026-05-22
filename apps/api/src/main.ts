import { Readable } from 'node:stream';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module.js';
import type { FastifyRequest } from 'fastify';
import type { RequestPayload } from 'fastify/types/hooks.js';

type RawBodyRequest = FastifyRequest & {
  rawBody?: Buffer;
};

type ReplayPayload = RequestPayload & {
  receivedEncodedLength?: number;
};

function resolveAllowedOrigins() {
  const configuredOrigins = process.env.WEB_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins?.length) {
    return configuredOrigins;
  }

  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  return ['http://localhost:3000', 'http://127.0.0.1:3000'];
}

function captureWebhookRawBody(adapter: FastifyAdapter) {
  adapter
    .getInstance()
    .addHook('preParsing', (request, _reply, payload, done) => {
      if (
        request.method !== 'POST' ||
        !request.url.startsWith('/instagram/webhooks')
      ) {
        done(null, payload);
        return;
      }

      const chunks: Buffer[] = [];

      payload.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      payload.on('end', () => {
        const rawBody = Buffer.concat(chunks);
        (request as RawBodyRequest).rawBody = rawBody;

        const replayPayload = Readable.from(rawBody) as ReplayPayload;
        replayPayload.receivedEncodedLength = Number(
          request.headers['content-length'] ?? rawBody.length,
        );
        done(null, replayPayload);
      });

      payload.on('error', (error: Error) => {
        done(error);
      });
    });
}

async function bootstrap() {
  const adapter = new FastifyAdapter();
  captureWebhookRawBody(adapter);

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.enableCors({
    origin: resolveAllowedOrigins(),
    credentials: true,
  });

  await app.listen({
    port: Number(process.env.PORT ?? 3001),
    host: '0.0.0.0',
  });
}

void bootstrap();
