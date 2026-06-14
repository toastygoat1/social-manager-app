import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createRemoteJWKSet,
  decodeProtectedHeader,
  jwtVerify,
  type JWTPayload,
} from 'jose';

export interface SupabaseIdentity {
  userId: string;
  email: string;
}

/**
 * Verifies a Supabase access token (the same JWTs the rest of the API trusts via
 * SupabaseStrategy) and extracts the user identity. Used by the OAuth bridge to
 * authenticate the human at consent time before issuing an MCP access token.
 */
@Injectable()
export class SupabaseTokenVerifier {
  private readonly issuer: string;
  private readonly audience = 'authenticated';
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly hsSecret?: Uint8Array;

  constructor(config: ConfigService) {
    const supabaseUrl = config.getOrThrow<string>('SUPABASE_URL');
    this.issuer = `${supabaseUrl}/auth/v1`;
    this.jwks = createRemoteJWKSet(
      new URL(`${this.issuer}/.well-known/jwks.json`),
    );

    const secret = config.get<string>('SUPABASE_JWT_SECRET');
    if (secret) {
      this.hsSecret = new TextEncoder().encode(secret);
    }
  }

  async verify(token: string): Promise<SupabaseIdentity> {
    let payload: JWTPayload;
    try {
      const { alg } = decodeProtectedHeader(token);
      if (alg === 'HS256') {
        if (!this.hsSecret) {
          throw new Error(
            'SUPABASE_JWT_SECRET is required to verify legacy HS256 tokens',
          );
        }
        ({ payload } = await jwtVerify(token, this.hsSecret, {
          issuer: this.issuer,
          audience: this.audience,
        }));
      } else {
        ({ payload } = await jwtVerify(token, this.jwks, {
          issuer: this.issuer,
          audience: this.audience,
        }));
      }
    } catch (error) {
      throw new UnauthorizedException(
        `Invalid Supabase token: ${(error as Error).message}`,
      );
    }

    const userId = typeof payload.sub === 'string' ? payload.sub : undefined;
    const email =
      typeof payload.email === 'string' ? payload.email : undefined;
    if (!userId) {
      throw new UnauthorizedException('Supabase token is missing a subject');
    }

    return { userId, email: email ?? `${userId}@users.noreply` };
  }
}
