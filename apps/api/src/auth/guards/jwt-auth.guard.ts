import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

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
