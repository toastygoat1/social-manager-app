import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

const WORKER_SECRET_HEADER = 'x-worker-publish-secret';

@Injectable()
export class WorkerPublishGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const expectedSecret = this.config
      .get<string>('WORKER_PUBLISH_SECRET')
      ?.trim();

    if (!expectedSecret) {
      throw new ServiceUnavailableException(
        'Scheduled publishing is not configured',
      );
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const suppliedHeader = request.headers[WORKER_SECRET_HEADER];
    const suppliedSecret = Array.isArray(suppliedHeader)
      ? suppliedHeader[0]
      : suppliedHeader;

    if (!suppliedSecret || !secureEquals(suppliedSecret, expectedSecret)) {
      throw new UnauthorizedException('Invalid worker credentials');
    }

    return true;
  }
}

function secureEquals(supplied: string, expected: string) {
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);

  return (
    suppliedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(suppliedBuffer, expectedBuffer)
  );
}
