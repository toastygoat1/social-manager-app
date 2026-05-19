import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { passportJwtSecret } from 'jwks-rsa';
import { decodeProtectedHeader } from 'jose';

interface SupabaseJwtPayload {
  sub: string;
  email: string;
  aud: string | string[];
  iss: string;
  user_role?: string;
}

@Injectable()
export class SupabaseStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const supabaseUrl = config.getOrThrow<string>('SUPABASE_URL');
    const supabaseJwtSecret = config.get<string>('SUPABASE_JWT_SECRET');
    const issuer = `${supabaseUrl}/auth/v1`;
    const jwksSecretProvider = passportJwtSecret({
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 5,
      jwksUri: `${issuer}/.well-known/jwks.json`,
    });

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      issuer,
      audience: 'authenticated',
      algorithms: supabaseJwtSecret
        ? ['HS256', 'ES256', 'RS256']
        : ['ES256', 'RS256'],
      secretOrKeyProvider(
        request: Parameters<typeof jwksSecretProvider>[0],
        rawJwtToken: string,
        done: Parameters<typeof jwksSecretProvider>[2],
      ) {
        try {
          const { alg } = decodeProtectedHeader(rawJwtToken);
          if (alg === 'HS256') {
            if (!supabaseJwtSecret) {
              done(
                new Error(
                  'SUPABASE_JWT_SECRET is required to verify legacy HS256 tokens',
                ),
                undefined,
              );
              return;
            }

            done(null, supabaseJwtSecret);
            return;
          }

          jwksSecretProvider(request, rawJwtToken, done);
        } catch (error) {
          done(error as Error, undefined);
        }
      },
    });
  }

  validate(payload: SupabaseJwtPayload) {
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.user_role,
    };
  }
}
