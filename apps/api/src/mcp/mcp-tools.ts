import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import type { AnalyticsService } from '../analytics/analytics.service.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import {
  WORKSPACE_TASK_STATUSES,
  WORKSPACE_TASK_URGENCIES,
} from '../workspace/dto/workspace-task.dto.js';

export interface McpUserContext {
  userId: string;
  email: string;
}

export interface McpDeps {
  workspace: WorkspaceService;
  analytics: AnalyticsService;
  prisma: PrismaService;
}

const POST_STATUSES = ['DRAFT', 'PENDING', 'READY', 'PUBLISHED', 'REMOVED'] as const;

function truncate(value: string | null | undefined, max = 140): string {
  if (!value) return '';
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

const deadlineSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,
    'Use a local datetime like 2026-06-20T14:30',
  );

function jsonResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
    structuredContent: value as Record<string, unknown>,
  };
}

/**
 * Builds an MCP server scoped to a single authenticated user. The tools are thin
 * wrappers over WorkspaceService, so all validation/ownership rules are reused.
 */
export function buildMcpServer(
  deps: McpDeps,
  user: McpUserContext,
): McpServer {
  const { workspace, analytics, prisma } = deps;
  const server = new McpServer({
    name: 'social-manager-workspace',
    version: '1.0.0',
  });

  server.registerTool(
    'list_folders',
    {
      title: 'List Folders',
      description:
        'List all workspace folders for the current user, including their tasks. ' +
        'Use this first to discover the folderId you need before creating a task.',
      inputSchema: {},
    },
    async () => {
      const result = await workspace.listFolders(user.userId, user.email);
      const folders = result.folders.map((folder) => ({
        id: folder.id,
        name: folder.name,
        taskCount: folder.tasks.length,
        tasks: folder.tasks.map((task) => ({
          id: task.id,
          taskName: task.taskName,
          status: task.status,
          urgency: task.urgency,
          assignee: task.assignee,
          startDate: task.startDate,
          deadline: task.deadline,
        })),
      }));
      return jsonResult({ folders });
    },
  );

  server.registerTool(
    'create_folder',
    {
      title: 'Create Folder',
      description:
        'Create a new workspace folder (a column / table) for tasks.',
      inputSchema: {
        name: z.string().min(1).max(120).describe('Folder name'),
      },
    },
    async ({ name }) => {
      const folder = await workspace.createFolder(user.userId, user.email, {
        name,
      });
      return jsonResult({ folder });
    },
  );

  server.registerTool(
    'create_task',
    {
      title: 'Create Task',
      description:
        'Add a new task to a workspace folder. Call list_folders first to get a valid folderId.',
      inputSchema: {
        folderId: z
          .string()
          .uuid()
          .describe('The folder to add the task to (from list_folders)'),
        taskName: z.string().min(1).max(160).describe('Short task title'),
        assignee: z
          .string()
          .max(80)
          .optional()
          .describe('Person responsible (defaults to Unassigned)'),
        urgency: z
          .enum(WORKSPACE_TASK_URGENCIES)
          .optional()
          .describe('High | Medium | Low (defaults to Medium)'),
        status: z
          .enum(WORKSPACE_TASK_STATUSES)
          .optional()
          .describe('Defaults to "Not started"'),
        deadline: deadlineSchema
          .optional()
          .describe('Local datetime, e.g. 2026-06-20T14:30'),
        startDate: deadlineSchema
          .optional()
          .describe('Optional start datetime, e.g. 2026-06-20T09:00'),
        briefExecution: z
          .string()
          .max(1200)
          .optional()
          .describe('What to do / execution brief'),
        notes: z
          .string()
          .max(1200)
          .optional()
          .describe('Extra notes / context'),
        inputFrom: z
          .string()
          .max(80)
          .optional()
          .describe('Source of the request, e.g. "Claude", "WA Client"'),
        accountIds: z
          .array(z.string().uuid())
          .max(20)
          .optional()
          .describe('Instagram account ids to attach (optional)'),
      },
    },
    async ({ folderId, ...body }) => {
      const task = await workspace.createTask(user.userId, folderId, {
        ...body,
        inputFrom: body.inputFrom ?? 'Claude',
      });
      return jsonResult({ task });
    },
  );

  server.registerTool(
    'update_task',
    {
      title: 'Update Task',
      description:
        'Update fields on an existing task. Only provided fields are changed.',
      inputSchema: {
        taskId: z.string().uuid().describe('The task to update'),
        taskName: z.string().min(1).max(160).optional(),
        assignee: z.string().max(80).optional(),
        urgency: z.enum(WORKSPACE_TASK_URGENCIES).optional(),
        status: z.enum(WORKSPACE_TASK_STATUSES).optional(),
        startDate: deadlineSchema.optional(),
        deadline: deadlineSchema.optional(),
        briefExecution: z.string().max(1200).optional(),
        notes: z.string().max(1200).optional(),
        inputFrom: z.string().max(80).optional(),
        accountIds: z.array(z.string().uuid()).max(20).optional(),
      },
    },
    async ({ taskId, ...body }) => {
      const task = await workspace.updateTask(user.userId, taskId, body);
      return jsonResult({ task });
    },
  );

  // ---- Read tools (concise projections to keep token usage low) -----------

  server.registerTool(
    'list_instagram_accounts',
    {
      title: 'List Instagram Accounts',
      description:
        "List the user's connected Instagram accounts. Use the returned id " +
        'to filter content posts or analytics.',
      inputSchema: {},
    },
    async () => {
      const accounts = await prisma.instagramAccount.findMany({
        where: { userId: user.userId, isActive: true },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          displayName: true,
          accountType: true,
        },
      });
      return jsonResult({ accounts });
    },
  );

  server.registerTool(
    'list_content_posts',
    {
      title: 'List Content Posts',
      description:
        'List the content calendar posts (captions, status, schedule). ' +
        'Filter by account or status, and keep limit small to save tokens.',
      inputSchema: {
        accountId: z
          .string()
          .uuid()
          .optional()
          .describe('Only posts for this Instagram account id'),
        status: z
          .enum(POST_STATUSES)
          .optional()
          .describe('Filter by post status'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('Max posts to return (default 20)'),
      },
    },
    async ({ accountId, status, limit }) => {
      const posts = await prisma.contentPost.findMany({
        where: {
          status,
          instagramAccount: { userId: user.userId },
          ...(accountId ? { instagramAccountId: accountId } : {}),
        },
        orderBy: [{ scheduledFor: 'desc' }, { createdAt: 'desc' }],
        take: limit ?? 20,
        select: {
          id: true,
          instagramAccountId: true,
          postType: true,
          status: true,
          caption: true,
          scheduledFor: true,
          publishedAt: true,
          igPermalink: true,
          instagramAccount: { select: { username: true } },
        },
      });

      return jsonResult({
        posts: posts.map((post) => ({
          id: post.id,
          accountId: post.instagramAccountId,
          username: post.instagramAccount.username,
          postType: post.postType,
          status: post.status,
          caption: truncate(post.caption),
          scheduledFor: post.scheduledFor,
          publishedAt: post.publishedAt,
          permalink: post.igPermalink,
        })),
      });
    },
  );

  server.registerTool(
    'get_analytics_overview',
    {
      title: 'Get Analytics Overview',
      description:
        'Headline performance metrics and per-account summary for a time ' +
        'range. Returns only summary stats (not full series) to save tokens.',
      inputSchema: {
        accountId: z
          .string()
          .uuid()
          .optional()
          .describe('Scope to one account (defaults to all)'),
        range: z
          .string()
          .optional()
          .describe('Range like "7d", "30d", "90d" (defaults to app default)'),
      },
    },
    async ({ accountId, range }) => {
      const overview = await analytics.getOverview(user.userId, {
        accountId,
        range,
      });
      return jsonResult({
        rangeDays: overview.rangeDays,
        lastUpdatedAt: overview.lastUpdatedAt,
        stats: overview.statGrid.map((stat) => ({
          title: stat.title,
          value: stat.value,
          delta: stat.delta,
          trend: stat.trend,
        })),
        accounts: overview.leaderboard.map((entry) => ({
          username: entry.account.username,
          postCount: entry.postCount,
          followers: entry.followers,
          views: entry.views,
          reach: entry.reach,
          interactions: entry.interactions,
          engagementRate: entry.engagementRate,
        })),
      });
    },
  );

  return server;
}
