import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { WorkspaceService } from '../workspace/workspace.service.js';
import {
  WORKSPACE_TASK_STATUSES,
  WORKSPACE_TASK_URGENCIES,
} from '../workspace/dto/workspace-task.dto.js';

export interface McpUserContext {
  userId: string;
  email: string;
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
  workspace: WorkspaceService,
  user: McpUserContext,
): McpServer {
  const server = new McpServer({
    name: 'social-manager-workspace',
    version: '1.0.0',
  });

  server.registerTool(
    'list_folders',
    {
      title: 'List workspace folders',
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
          deadline: task.deadline,
        })),
      }));
      return jsonResult({ folders });
    },
  );

  server.registerTool(
    'create_folder',
    {
      title: 'Create a workspace folder',
      description: 'Create a new workspace folder (a column / table) for tasks.',
      inputSchema: {
        name: z.string().min(1).max(120).describe('Folder name'),
      },
    },
    async ({ name }) => {
      const folder = await workspace.createFolder(
        user.userId,
        user.email,
        name,
      );
      return jsonResult({ folder });
    },
  );

  server.registerTool(
    'create_task',
    {
      title: 'Create a workspace task',
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
        briefExecution: z
          .string()
          .max(1200)
          .optional()
          .describe('What to do / execution brief'),
        notes: z.string().max(1200).optional().describe('Extra notes / context'),
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
      title: 'Update a workspace task',
      description:
        'Update fields on an existing task. Only provided fields are changed.',
      inputSchema: {
        taskId: z.string().uuid().describe('The task to update'),
        taskName: z.string().min(1).max(160).optional(),
        assignee: z.string().max(80).optional(),
        urgency: z.enum(WORKSPACE_TASK_URGENCIES).optional(),
        status: z.enum(WORKSPACE_TASK_STATUSES).optional(),
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

  return server;
}
