import {
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { AuthUser } from '../auth.types.js';

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  user?: AuthUser;
}

function readHeader(
  req: RequestLike,
  name: string,
): string | undefined {
  const raw = req.headers?.[name];
  if (Array.isArray(raw)) return raw[0];
  return typeof raw === 'string' ? raw : undefined;
}

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestLike>();
    const devUserId = process.env.DEV_BYPASS_USER_ID;

    if (devUserId && process.env.NODE_ENV !== 'production') {
      const incoming = readHeader(request, 'x-dev-user-id');
      if (incoming && incoming === devUserId) {
        const email =
          readHeader(request, 'x-dev-user-email') ??
          process.env.DEV_BYPASS_USER_EMAIL ??
          'dev@local';
        request.user = { userId: devUserId, email } satisfies AuthUser;
        this.logger.warn(
          `DEV_BYPASS active — request authorized as ${devUserId}. Disable by unsetting DEV_BYPASS_USER_ID.`,
        );
        return true;
      }
    }

    return (await super.canActivate(context)) as boolean;
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    info: unknown,
  ): TUser {
    if (err || info || !user) {
      if (process.env.NODE_ENV !== 'production') {
        const reason =
          (info as Error | undefined)?.message ??
          (err as Error | undefined)?.message ??
          'Unauthorized';
        this.logger.debug(`JWT rejected: ${reason}`);
      }
      throw err instanceof Error
        ? err
        : new UnauthorizedException('Invalid token');
    }
    return user;
  }
}
