import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OAuthClient {
  clientId: string;
  redirectUris: string[];
  clientName?: string;
  createdAt: number;
}

/** A pending /authorize request, parked while the human logs in + consents. */
export interface AuthRequest {
  requestId: string;
  clientId: string;
  redirectUri: string;
  state?: string;
  scope?: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource?: string;
  createdAt: number;
}

/** An authorization code, issued after consent, exchanged once for a token. */
export interface AuthCode {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  userId: string;
  email: string;
  expiresAt: number;
}

export interface AccessToken {
  token: string;
  refreshToken: string;
  clientId: string;
  userId: string;
  email: string;
  expiresAt: number;
}

interface StoreShape {
  clients: Record<string, OAuthClient>;
  authRequests: Record<string, AuthRequest>;
  authCodes: Record<string, AuthCode>;
  tokens: Record<string, AccessToken>;
  refreshIndex: Record<string, string>; // refreshToken -> access token
}

const AUTH_REQUEST_TTL_MS = 10 * 60 * 1000;
const AUTH_CODE_TTL_MS = 5 * 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;

function token(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/**
 * Minimal OAuth 2.1 state store for the MCP connector. Backed by a JSON file so
 * issued tokens survive API restarts during development. This is intentionally
 * simple — for multi-instance production deployments, move this to Postgres.
 */
@Injectable()
export class OAuthStore {
  private readonly logger = new Logger(OAuthStore.name);
  private readonly filePath: string;
  private data: StoreShape = {
    clients: {},
    authRequests: {},
    authCodes: {},
    tokens: {},
    refreshIndex: {},
  };

  constructor(config: ConfigService) {
    this.filePath =
      config.get<string>('MCP_OAUTH_STORE_PATH') ?? '.mcp-oauth-store.json';
    this.load();
  }

  private load() {
    try {
      const raw = readFileSync(this.filePath, 'utf8');
      this.data = { ...this.data, ...(JSON.parse(raw) as StoreShape) };
    } catch {
      // No store yet — start empty.
    }
  }

  private persist() {
    try {
      writeFileSync(this.filePath, JSON.stringify(this.data), 'utf8');
    } catch (error) {
      this.logger.warn(`Could not persist OAuth store: ${(error as Error).message}`);
    }
  }

  registerClient(redirectUris: string[], clientName?: string): OAuthClient {
    const client: OAuthClient = {
      clientId: token(16),
      redirectUris,
      clientName,
      createdAt: Date.now(),
    };
    this.data.clients[client.clientId] = client;
    this.persist();
    return client;
  }

  getClient(clientId: string): OAuthClient | undefined {
    return this.data.clients[clientId];
  }

  createAuthRequest(
    input: Omit<AuthRequest, 'requestId' | 'createdAt'>,
  ): AuthRequest {
    const request: AuthRequest = {
      ...input,
      requestId: token(16),
      createdAt: Date.now(),
    };
    this.data.authRequests[request.requestId] = request;
    this.persist();
    return request;
  }

  getAuthRequest(requestId: string): AuthRequest | undefined {
    const request = this.data.authRequests[requestId];
    if (!request) return undefined;
    if (Date.now() - request.createdAt > AUTH_REQUEST_TTL_MS) {
      delete this.data.authRequests[requestId];
      this.persist();
      return undefined;
    }
    return request;
  }

  /** Consume the pending request and mint an authorization code for the user. */
  issueCode(
    requestId: string,
    userId: string,
    email: string,
  ): AuthCode | undefined {
    const request = this.getAuthRequest(requestId);
    if (!request) return undefined;
    delete this.data.authRequests[requestId];

    const authCode: AuthCode = {
      code: token(32),
      clientId: request.clientId,
      redirectUri: request.redirectUri,
      codeChallenge: request.codeChallenge,
      codeChallengeMethod: request.codeChallengeMethod,
      userId,
      email,
      expiresAt: Date.now() + AUTH_CODE_TTL_MS,
    };
    this.data.authCodes[authCode.code] = authCode;
    this.persist();
    return authCode;
  }

  takeAuthCode(code: string): AuthCode | undefined {
    const authCode = this.data.authCodes[code];
    if (!authCode) return undefined;
    delete this.data.authCodes[code];
    this.persist();
    if (authCode.expiresAt < Date.now()) return undefined;
    return authCode;
  }

  issueToken(clientId: string, userId: string, email: string): AccessToken {
    const accessToken: AccessToken = {
      token: token(32),
      refreshToken: token(32),
      clientId,
      userId,
      email,
      expiresAt: Date.now() + ACCESS_TOKEN_TTL_MS,
    };
    this.data.tokens[accessToken.token] = accessToken;
    this.data.refreshIndex[accessToken.refreshToken] = accessToken.token;
    this.persist();
    return accessToken;
  }

  rotateRefreshToken(refreshToken: string): AccessToken | undefined {
    const existingTokenId = this.data.refreshIndex[refreshToken];
    if (!existingTokenId) return undefined;
    const existing = this.data.tokens[existingTokenId];
    delete this.data.refreshIndex[refreshToken];
    if (existing) {
      delete this.data.tokens[existing.token];
    }
    if (!existing) return undefined;
    return this.issueToken(existing.clientId, existing.userId, existing.email);
  }

  getValidToken(accessToken: string): AccessToken | undefined {
    const record = this.data.tokens[accessToken];
    if (!record) return undefined;
    if (record.expiresAt < Date.now()) {
      delete this.data.tokens[accessToken];
      this.persist();
      return undefined;
    }
    return record;
  }

  get accessTokenTtlSeconds(): number {
    return Math.floor(ACCESS_TOKEN_TTL_MS / 1000);
  }
}
