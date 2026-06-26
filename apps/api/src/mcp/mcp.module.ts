import { Module } from '@nestjs/common';
import { WorkspaceModule } from '../workspace/workspace.module.js';
import { AnalyticsModule } from '../analytics/analytics.module.js';
import { McpController } from './mcp.controller.js';
import { OAuthStore } from './oauth-store.js';
import { SupabaseTokenVerifier } from './supabase-token.verifier.js';

@Module({
  imports: [WorkspaceModule, AnalyticsModule],
  controllers: [McpController],
  providers: [OAuthStore, SupabaseTokenVerifier],
})
export class McpModule {}
