import { createHash, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { WorkspaceService } from '../workspace/workspace.service.js';
import { AnalyticsService } from '../analytics/analytics.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { buildMcpServer } from './mcp-tools.js';
import { OAuthStore } from './oauth-store.js';
import { SupabaseTokenVerifier } from './supabase-token.verifier.js';

function s256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

interface McpSession {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  userId: string;
}

@SkipThrottle()
@Controller()
export class McpController {
  private readonly logger = new Logger(McpController.name);
  private readonly sessions = new Map<string, McpSession>();

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly analytics: AnalyticsService,
    private readonly prisma: PrismaService,
    private readonly store: OAuthStore,
    private readonly verifier: SupabaseTokenVerifier,
    private readonly config: ConfigService,
  ) {}

  private get publicUrl(): string {
    return (
      this.config.get<string>('MCP_PUBLIC_URL')?.replace(/\/$/, '') ??
      'http://localhost:3001'
    );
  }

  private get webOrigin(): string {
    const configured = this.config
      .get<string>('WEB_ORIGIN')
      ?.split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    return configured?.[0] ?? 'http://localhost:3000';
  }

  // ---- OAuth discovery (RFC 9728 + RFC 8414) -------------------------------

  @Get('.well-known/oauth-protected-resource')
  @Get('.well-known/oauth-protected-resource/*')
  protectedResourceMetadata() {
    return {
      resource: `${this.publicUrl}/mcp`,
      authorization_servers: [this.publicUrl],
      scopes_supported: ['workspace'],
      bearer_methods_supported: ['header'],
    };
  }

  @Get('.well-known/oauth-authorization-server')
  @Get('.well-known/oauth-authorization-server/*')
  authorizationServerMetadata() {
    return {
      issuer: this.publicUrl,
      authorization_endpoint: `${this.publicUrl}/oauth/authorize`,
      token_endpoint: `${this.publicUrl}/oauth/token`,
      registration_endpoint: `${this.publicUrl}/oauth/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['workspace'],
    };
  }

  // ---- Dynamic Client Registration (RFC 7591) -----------------------------

  @Post('oauth/register')
  register(@Body() body: Record<string, unknown>) {
    const redirectUris = Array.isArray(body?.redirect_uris)
      ? (body.redirect_uris as unknown[]).filter(
          (u): u is string => typeof u === 'string',
        )
      : [];
    if (redirectUris.length === 0) {
      throw new BadRequestException('redirect_uris is required');
    }
    const clientName =
      typeof body?.client_name === 'string' ? body.client_name : undefined;
    const client = this.store.registerClient(redirectUris, clientName);
    return {
      client_id: client.clientId,
      client_id_issued_at: Math.floor(client.createdAt / 1000),
      redirect_uris: client.redirectUris,
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    };
  }

  // ---- Authorization endpoint ---------------------------------------------

  @Get('oauth/authorize')
  authorize(@Query() query: Record<string, string>, @Res() reply: FastifyReply) {
    const {
      response_type,
      client_id,
      redirect_uri,
      code_challenge,
      code_challenge_method,
      state,
      scope,
      resource,
    } = query;

    const client = client_id ? this.store.getClient(client_id) : undefined;
    if (!client || !redirect_uri || !client.redirectUris.includes(redirect_uri)) {
      // Can't safely redirect — fail loud.
      void reply
        .status(400)
        .send({ error: 'invalid_client_or_redirect_uri' });
      return;
    }

    const fail = (error: string) => {
      const url = new URL(redirect_uri);
      url.searchParams.set('error', error);
      if (state) url.searchParams.set('state', state);
      void reply.redirect(url.toString(), 302);
    };

    if (response_type !== 'code') return fail('unsupported_response_type');
    if (!code_challenge || code_challenge_method !== 'S256') {
      return fail('invalid_request');
    }

    const request = this.store.createAuthRequest({
      clientId: client_id,
      redirectUri: redirect_uri,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method,
      state,
      scope,
      resource,
    });

    // Hand off to the web app so the user logs in (Supabase) and consents.
    const consentUrl = new URL('/connector/authorize', this.webOrigin);
    consentUrl.searchParams.set('request_id', request.requestId);
    void reply.redirect(consentUrl.toString(), 302);
  }

  /**
   * Called by the web consent page after the user is authenticated. The page
   * sends the user's Supabase access token; we verify it and mint an auth code.
   * Returns the URL the browser should be redirected to (back to the client).
   */
  @Post('oauth/consent')
  async consent(
    @Body()
    body: { requestId?: string; supabaseAccessToken?: string; approve?: boolean },
  ) {
    const request = body.requestId
      ? this.store.getAuthRequest(body.requestId)
      : undefined;
    if (!request) {
      throw new BadRequestException('Authorization request expired or invalid');
    }

    const redirectUrl = new URL(request.redirectUri);
    if (request.state) redirectUrl.searchParams.set('state', request.state);

    if (body.approve === false) {
      redirectUrl.searchParams.set('error', 'access_denied');
      return { redirectTo: redirectUrl.toString() };
    }

    const identity = await this.resolveConsentIdentity(body.supabaseAccessToken);
    const code = this.store.issueCode(
      request.requestId,
      identity.userId,
      identity.email,
    );
    if (!code) {
      throw new BadRequestException('Authorization request expired');
    }

    redirectUrl.searchParams.set('code', code.code);
    return { redirectTo: redirectUrl.toString() };
  }

  private async resolveConsentIdentity(supabaseAccessToken?: string) {
    if (supabaseAccessToken) {
      return this.verifier.verify(supabaseAccessToken);
    }

    // Dev-bypass: mirror the JWT guard so the flow is testable without a real
    // Supabase session. Non-production only.
    const devUserId = this.config.get<string>('DEV_BYPASS_USER_ID');
    if (devUserId && process.env.NODE_ENV !== 'production') {
      this.logger.warn(
        `DEV_BYPASS active — connector authorized as ${devUserId}.`,
      );
      return {
        userId: devUserId,
        email:
          this.config.get<string>('DEV_BYPASS_USER_EMAIL') ?? 'dev@local',
      };
    }

    throw new BadRequestException('Missing Supabase access token');
  }

  // ---- Token endpoint ------------------------------------------------------

  @Post('oauth/token')
  token(@Body() body: Record<string, string>, @Res() reply: FastifyReply) {
    const grantType = body.grant_type;

    if (grantType === 'authorization_code') {
      const authCode = this.store.takeAuthCode(body.code);
      if (!authCode) {
        return void reply.status(400).send({ error: 'invalid_grant' });
      }
      if (
        authCode.clientId !== body.client_id ||
        authCode.redirectUri !== body.redirect_uri
      ) {
        return void reply.status(400).send({ error: 'invalid_grant' });
      }
      if (
        !body.code_verifier ||
        s256(body.code_verifier) !== authCode.codeChallenge
      ) {
        return void reply.status(400).send({ error: 'invalid_grant' });
      }

      const issued = this.store.issueToken(
        authCode.clientId,
        authCode.userId,
        authCode.email,
      );
      return void reply.send(this.tokenResponse(issued.token, issued.refreshToken));
    }

    if (grantType === 'refresh_token') {
      const rotated = this.store.rotateRefreshToken(body.refresh_token);
      if (!rotated) {
        return void reply.status(400).send({ error: 'invalid_grant' });
      }
      return void reply.send(
        this.tokenResponse(rotated.token, rotated.refreshToken),
      );
    }

    return void reply.status(400).send({ error: 'unsupported_grant_type' });
  }

  private tokenResponse(accessToken: string, refreshToken: string) {
    return {
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: this.store.accessTokenTtlSeconds,
      refresh_token: refreshToken,
      scope: 'workspace',
    };
  }

  // ---- MCP transport (Streamable HTTP, stateful sessions) ------------------

  /** Validate the bearer token, or send a 401 that triggers OAuth discovery. */
  private authenticate(request: FastifyRequest, reply: FastifyReply) {
    const auth = request.headers['authorization'];
    const bearer =
      typeof auth === 'string' && auth.startsWith('Bearer ')
        ? auth.slice('Bearer '.length)
        : undefined;
    const tokenRecord = bearer ? this.store.getValidToken(bearer) : undefined;

    if (!tokenRecord) {
      void reply
        .header(
          'WWW-Authenticate',
          `Bearer resource_metadata="${this.publicUrl}/.well-known/oauth-protected-resource"`,
        )
        .status(401)
        .send({ error: 'invalid_token' });
      return undefined;
    }
    return tokenRecord;
  }

  @Post('mcp')
  async handleMcpPost(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const tokenRecord = this.authenticate(request, reply);
    if (!tokenRecord) return;

    const sessionId = request.headers['mcp-session-id'] as string | undefined;
    let session = sessionId ? this.sessions.get(sessionId) : undefined;

    // Reject a session that belongs to a different user.
    if (session && session.userId !== tokenRecord.userId) {
      void reply.status(403).send({ error: 'session_user_mismatch' });
      return;
    }

    if (!session) {
      if (!isInitializeRequest(request.body)) {
        void reply.status(400).send({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'No valid session; expected initialize' },
          id: null,
        });
        return;
      }

      const server = buildMcpServer(
        {
          workspace: this.workspace,
          analytics: this.analytics,
          prisma: this.prisma,
        },
        {
          userId: tokenRecord.userId,
          email: tokenRecord.email,
        },
      );
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sid) => {
          this.sessions.set(sid, {
            transport,
            server,
            userId: tokenRecord.userId,
          });
        },
      });
      transport.onclose = () => {
        if (transport.sessionId) this.sessions.delete(transport.sessionId);
      };
      await server.connect(transport);
      session = { transport, server, userId: tokenRecord.userId };
    }

    await this.dispatch(session.transport, request, reply);
  }

  @Get('mcp')
  async handleMcpGet(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    await this.handleSessionScopedRequest(request, reply);
  }

  @Delete('mcp')
  async handleMcpDelete(
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    await this.handleSessionScopedRequest(request, reply);
  }

  private async handleSessionScopedRequest(
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    const tokenRecord = this.authenticate(request, reply);
    if (!tokenRecord) return;

    const sessionId = request.headers['mcp-session-id'] as string | undefined;
    const session = sessionId ? this.sessions.get(sessionId) : undefined;
    if (!session || session.userId !== tokenRecord.userId) {
      void reply.status(404).send({ error: 'unknown_session' });
      return;
    }
    await this.dispatch(session.transport, request, reply);
  }

  private async dispatch(
    transport: StreamableHTTPServerTransport,
    request: FastifyRequest,
    reply: FastifyReply,
  ) {
    reply.hijack();
    try {
      await transport.handleRequest(request.raw, reply.raw, request.body);
    } catch (error) {
      this.logger.error(`MCP request failed: ${(error as Error).message}`);
      if (!reply.raw.headersSent) {
        reply.raw.statusCode = 500;
        reply.raw.end(JSON.stringify({ error: 'internal_error' }));
      }
    }
  }
}
