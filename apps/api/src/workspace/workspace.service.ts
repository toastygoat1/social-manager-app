import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@social-manager/database';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  CreateWorkspaceFolderDto,
  UpdateWorkspaceFolderDto,
} from './dto/workspace-folder.dto.js';
import {
  WORKSPACE_TASK_STATUSES,
  WORKSPACE_TASK_URGENCIES,
  type CreateWorkspaceTaskDto,
  type UpdateWorkspaceTaskDto,
} from './dto/workspace-task.dto.js';

type DefaultTask = {
  taskName: string;
  assignee: string;
  urgency: (typeof WORKSPACE_TASK_URGENCIES)[number];
  status: (typeof WORKSPACE_TASK_STATUSES)[number];
  deadline: string;
  briefExecution: string;
  notes: string;
  inputFrom: string;
};

type DefaultFolder = {
  name: string;
  tasks: DefaultTask[];
};

const DEFAULT_FOLDERS: DefaultFolder[] = [
  {
    name: 'Daily Ops',
    tasks: [
      {
        taskName: 'Recheck semua merch Cenklik Coffee',
        assignee: 'Fata (Owner)',
        urgency: 'High',
        status: 'Not started',
        deadline: '2026-06-05T17:00',
        briefExecution:
          'Recheck seluruh item merch Cenklik Coffee: cek desain, kualitas, dan kelengkapan.',
        notes:
          'Reminder dari Fata untuk cek ulang semua merchandise Cenklik Coffee.',
        inputFrom: 'WA Fata',
      },
      {
        taskName: 'Finalisasi brief story weekend',
        assignee: 'Nadia',
        urgency: 'Medium',
        status: 'In progress',
        deadline: '2026-06-07T10:00',
        briefExecution:
          'Susun angle story, CTA, dan urutan frame untuk promo weekend.',
        notes: 'Pastikan tidak bentrok dengan campaign payday.',
        inputFrom: 'Claude Intake',
      },
      {
        taskName: 'Audit folder footage reels',
        assignee: 'Bima',
        urgency: 'Low',
        status: 'Review',
        deadline: '2026-06-08T15:30',
        briefExecution:
          'Rapikan footage mentah, tandai yang siap edit, dan pisahkan aset yang perlu reshoot.',
        notes: 'Tambahkan label lokasi dan tanggal shooting.',
        inputFrom: 'Slack Ops',
      },
    ],
  },
  {
    name: 'Content Production',
    tasks: [
      {
        taskName: 'Draft caption product bundling',
        assignee: 'Rani',
        urgency: 'Medium',
        status: 'Review',
        deadline: '2026-06-09T11:00',
        briefExecution:
          'Buat 3 opsi caption bundling dengan tone hangat dan CTA pemesanan.',
        notes: 'Client minta wording tidak terlalu hard selling.',
        inputFrom: 'WA Client',
      },
      {
        taskName: 'Shoot list promo payday',
        assignee: 'Dimas',
        urgency: 'High',
        status: 'In progress',
        deadline: '2026-06-06T16:00',
        briefExecution:
          'Siapkan shot list before-after, detail tools, dan ambience waiting area.',
        notes: 'Prioritaskan reels vertical 9:16.',
        inputFrom: 'Claude Intake',
      },
      {
        taskName: 'QA scheduled posts minggu ini',
        assignee: 'Fata',
        urgency: 'Medium',
        status: 'Done',
        deadline: '2026-06-06T18:00',
        briefExecution:
          'Cek caption, asset, tanggal publish, account tag, dan approval status.',
        notes: 'Semua post approved perlu masuk scheduler.',
        inputFrom: 'Dashboard',
      },
    ],
  },
  {
    name: 'Client Requests',
    tasks: [
      {
        taskName: 'Update menu seasonal di brief Juni',
        assignee: 'Alya',
        urgency: 'High',
        status: 'Not started',
        deadline: '2026-06-10T13:00',
        briefExecution:
          'Masukkan menu seasonal terbaru ke brief konten dan tandai item prioritas.',
        notes: 'Tunggu foto menu final dari client.',
        inputFrom: 'WA Client',
      },
      {
        taskName: 'Rangkum feedback reels opening',
        assignee: 'Nadia',
        urgency: 'Medium',
        status: 'Review',
        deadline: '2026-06-11T14:00',
        briefExecution:
          'Gabungkan feedback client, tandai revisi copy, dan susun next action untuk editor.',
        notes: 'Pisahkan feedback minor dan wajib revisi.',
        inputFrom: 'Claude Intake',
      },
    ],
  },
];

const WORKSPACE_TASK_INCLUDE = {
  taskAccounts: {
    orderBy: { createdAt: 'asc' },
    select: { instagramAccountId: true },
  },
} satisfies Prisma.WorkspaceTaskInclude;

const WORKSPACE_FOLDER_INCLUDE = {
  tasks: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: WORKSPACE_TASK_INCLUDE,
  },
} satisfies Prisma.WorkspaceFolderInclude;

type WorkspaceFolderRecord = Prisma.WorkspaceFolderGetPayload<{
  include: typeof WORKSPACE_FOLDER_INCLUDE;
}>;

type WorkspaceTaskRecord = Prisma.WorkspaceTaskGetPayload<{
  include: typeof WORKSPACE_TASK_INCLUDE;
}>;

function padDatePart(value: number) {
  return String(value).padStart(2, '0');
}

function toDateTimeLocalValue(value: Date) {
  return `${value.getFullYear()}-${padDatePart(
    value.getMonth() + 1,
  )}-${padDatePart(value.getDate())}T${padDatePart(
    value.getHours(),
  )}:${padDatePart(value.getMinutes())}`;
}

function parseDeadline(value: string | undefined) {
  if (!value) return undefined;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException('Deadline must be a valid date and time');
  }
  return parsed;
}

function defaultDeadline() {
  const deadline = new Date();
  deadline.setHours(deadline.getHours() + 2, 0, 0, 0);
  return deadline;
}

function trimOrFallback(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : fallback;
}

function trimOrNull(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function hasOwnField(value: object, field: string): boolean {
  return Object.hasOwn(value, field);
}

function hasAccountSelection(value: UpdateWorkspaceTaskDto): boolean {
  return hasOwnField(value, 'accountIds') || hasOwnField(value, 'accountId');
}

function getRequestedAccountIds(
  value: CreateWorkspaceTaskDto | UpdateWorkspaceTaskDto,
): string[] {
  if (hasOwnField(value, 'accountIds')) return value.accountIds ?? [];
  return value.accountId ? [value.accountId] : [];
}

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  async listFolders(userId: string, email: string) {
    await this.ensureUser(userId, email);
    await this.ensureBoardInitialized(userId);
    return { folders: await this.findFolders(userId, email) };
  }

  async createFolder(
    userId: string,
    email: string,
    body: CreateWorkspaceFolderDto,
  ) {
    await this.ensureUser(userId, email);
    await this.ensureBoardState(userId);

    const folderCount = await this.prisma.workspaceFolder.count({
      where: { userId },
    });
    const folder = await this.prisma.workspaceFolder.create({
      data: {
        userId,
        name: trimOrFallback(body.name, `Folder ${folderCount + 1}`),
        bannerTitle: trimOrNull(body.bannerTitle),
        bannerDescription: trimOrNull(body.bannerDescription),
        bannerColor: trimOrNull(body.bannerColor),
        sortOrder: folderCount,
      },
      include: WORKSPACE_FOLDER_INCLUDE,
    });

    return this.mapFolder(folder, email);
  }

  async updateFolder(
    userId: string,
    email: string,
    folderId: string,
    body: UpdateWorkspaceFolderDto,
  ) {
    await this.assertFolder(userId, folderId);

    const data: Prisma.WorkspaceFolderUpdateInput = {};
    if (body.name !== undefined) {
      data.name = trimOrFallback(body.name, 'Folder');
    }
    if (hasOwnField(body, 'bannerTitle')) {
      data.bannerTitle = trimOrNull(body.bannerTitle);
    }
    if (hasOwnField(body, 'bannerDescription')) {
      data.bannerDescription = trimOrNull(body.bannerDescription);
    }
    if (hasOwnField(body, 'bannerColor')) {
      data.bannerColor = trimOrNull(body.bannerColor);
    }

    const folder = await this.prisma.workspaceFolder.update({
      where: { id: folderId },
      data,
      include: WORKSPACE_FOLDER_INCLUDE,
    });

    return this.mapFolder(folder, email);
  }

  async deleteFolder(userId: string, folderId: string) {
    const result = await this.prisma.workspaceFolder.deleteMany({
      where: { id: folderId, userId },
    });

    if (result.count === 0) {
      throw new NotFoundException('Workspace folder not found');
    }
  }

  async createTask(
    userId: string,
    folderId: string,
    body: CreateWorkspaceTaskDto,
  ) {
    await this.assertFolder(userId, folderId);

    const taskCount = await this.prisma.workspaceTask.count({
      where: { folderId },
    });
    const accountIds = await this.resolveAccountIds(
      userId,
      getRequestedAccountIds(body),
    );
    const deadline = parseDeadline(body.deadline) ?? defaultDeadline();

    const task = await this.prisma.workspaceTask.create({
      data: {
        folder: { connect: { id: folderId } },
        instagramAccount: accountIds[0]
          ? { connect: { id: accountIds[0] } }
          : undefined,
        taskAccounts:
          accountIds.length > 0
            ? {
                create: accountIds.map((accountId) => ({
                  instagramAccount: { connect: { id: accountId } },
                })),
              }
            : undefined,
        taskName: trimOrFallback(body.taskName, `New task ${taskCount + 1}`),
        assignee: trimOrFallback(body.assignee, 'Unassigned'),
        urgency: body.urgency ?? 'Medium',
        status: body.status ?? 'Not started',
        deadline,
        briefExecution: body.briefExecution ?? '',
        notes: body.notes ?? '',
        inputFrom: trimOrFallback(body.inputFrom, 'Manual'),
        sortOrder: taskCount,
      },
      include: WORKSPACE_TASK_INCLUDE,
    });

    return this.mapTask(task);
  }

  async updateTask(
    userId: string,
    taskId: string,
    body: UpdateWorkspaceTaskDto,
  ) {
    const existing = await this.prisma.workspaceTask.findFirst({
      where: { id: taskId, folder: { userId } },
    });
    if (!existing) {
      throw new NotFoundException('Workspace task not found');
    }

    const data: Prisma.WorkspaceTaskUpdateInput = {};

    if (body.taskName !== undefined) data.taskName = body.taskName;
    if (body.assignee !== undefined) data.assignee = body.assignee;
    if (body.urgency !== undefined) data.urgency = body.urgency;
    if (body.status !== undefined) data.status = body.status;
    if (body.deadline !== undefined) {
      data.deadline = parseDeadline(body.deadline);
    }
    if (body.briefExecution !== undefined) {
      data.briefExecution = body.briefExecution;
    }
    if (body.notes !== undefined) data.notes = body.notes;
    if (body.inputFrom !== undefined) data.inputFrom = body.inputFrom;

    if (hasAccountSelection(body)) {
      const accountIds = await this.resolveAccountIds(
        userId,
        getRequestedAccountIds(body),
      );
      data.instagramAccount = accountIds[0]
        ? { connect: { id: accountIds[0] } }
        : { disconnect: true };
      data.taskAccounts = {
        deleteMany: {},
        create: accountIds.map((accountId) => ({
          instagramAccount: { connect: { id: accountId } },
        })),
      };
    }

    const task = await this.prisma.workspaceTask.update({
      where: { id: taskId },
      data,
      include: WORKSPACE_TASK_INCLUDE,
    });

    return this.mapTask(task);
  }

  private async ensureUser(userId: string, email: string) {
    await this.prisma.user.upsert({
      where: { id: userId },
      update: { email },
      create: { id: userId, email },
    });
  }

  private async ensureBoardState(userId: string) {
    await this.prisma.workspaceBoardState.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  private async ensureBoardInitialized(userId: string) {
    const state = await this.prisma.workspaceBoardState.findUnique({
      where: { userId },
      select: { userId: true },
    });
    if (state) return;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.workspaceBoardState.create({ data: { userId } });

        for (const [folderIndex, folder] of DEFAULT_FOLDERS.entries()) {
          await tx.workspaceFolder.create({
            data: {
              userId,
              name: folder.name,
              sortOrder: folderIndex,
              tasks: {
                create: folder.tasks.map((task, taskIndex) => ({
                  taskName: task.taskName,
                  assignee: task.assignee,
                  urgency: task.urgency,
                  status: task.status,
                  deadline: parseDeadline(task.deadline) ?? defaultDeadline(),
                  briefExecution: task.briefExecution,
                  notes: task.notes,
                  inputFrom: task.inputFrom,
                  sortOrder: taskIndex,
                })),
              },
            },
          });
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return;
      }
      throw error;
    }
  }

  private async assertFolder(userId: string, folderId: string) {
    const folder = await this.prisma.workspaceFolder.findFirst({
      where: { id: folderId, userId },
      select: { id: true },
    });
    if (!folder) {
      throw new NotFoundException('Workspace folder not found');
    }
  }

  private async resolveAccountIds(
    userId: string,
    accountIds: string[] | null | undefined,
  ): Promise<string[]> {
    const uniqueAccountIds = [
      ...new Set((accountIds ?? []).map((accountId) => accountId.trim())),
    ].filter(Boolean);
    if (uniqueAccountIds.length === 0) return [];

    const accounts = await this.prisma.instagramAccount.findMany({
      where: { id: { in: uniqueAccountIds }, userId, isActive: true },
      select: { id: true },
    });
    if (accounts.length !== uniqueAccountIds.length) {
      throw new BadRequestException('Account is not connected to this user');
    }

    const connectedAccountIds = new Set(accounts.map((account) => account.id));
    return uniqueAccountIds.filter((accountId) =>
      connectedAccountIds.has(accountId),
    );
  }

  private async findFolders(userId: string, email: string) {
    const folders = await this.prisma.workspaceFolder.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: WORKSPACE_FOLDER_INCLUDE,
    });

    return folders.map((folder) => this.mapFolder(folder, email));
  }

  private mapFolder(folder: WorkspaceFolderRecord, email: string) {
    return {
      id: folder.id,
      name: folder.name,
      owner: email,
      bannerTitle: folder.bannerTitle,
      bannerDescription: folder.bannerDescription,
      bannerColor: folder.bannerColor,
      tasks: folder.tasks.map((task) => this.mapTask(task)),
    };
  }

  private mapTask(task: WorkspaceTaskRecord) {
    const accountIds =
      task.taskAccounts.length > 0
        ? task.taskAccounts.map((taskAccount) => taskAccount.instagramAccountId)
        : task.instagramAccountId
          ? [task.instagramAccountId]
          : [];

    return {
      id: task.id,
      taskName: task.taskName,
      assignee: task.assignee,
      urgency: task.urgency,
      accountId: accountIds[0] ?? null,
      accountIds,
      status: task.status,
      deadline: toDateTimeLocalValue(task.deadline),
      briefExecution: task.briefExecution,
      notes: task.notes,
      inputFrom: task.inputFrom,
    };
  }
}
