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

const WORKER_SECRET_HEADER = 'x-worker-ai-secret';

@Injectable()
export class WorkerAiGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext) {
    const expectedSecret = this.config
      .get<string>('WORKER_AI_SECRET')
      ?.trim();

    if (!expectedSecret) {
      throw new ServiceUnavailableException('AI worker secret is not configured');
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const suppliedHeader = request.headers[WORKER_SECRET_HEADER];
    const supplied = Array.isArray(suppliedHeader)
      ? suppliedHeader[0]
      : suppliedHeader;

    if (!supplied || !secureEquals(supplied, expectedSecret)) {
      throw new UnauthorizedException('Invalid worker credentials');
    }

    return true;
  }
}

function secureEquals(supplied: string, expected: string) {
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
