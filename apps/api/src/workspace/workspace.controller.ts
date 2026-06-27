import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import type { AuthedRequest } from '../auth/auth.types.js';
import {
  CreateWorkspaceFolderDto,
  UpdateWorkspaceFolderDto,
} from './dto/workspace-folder.dto.js';
import {
  CreateWorkspaceTaskDto,
  UpdateWorkspaceTaskDto,
} from './dto/workspace-task.dto.js';
import { WorkspaceService } from './workspace.service.js';

@UseGuards(JwtAuthGuard)
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Get('workplaces')
  listWorkplaces(@Request() req: AuthedRequest) {
    return this.workspaceService.listWorkplaces(
      req.user.userId,
      req.user.email,
    );
  }

  @Post('workplaces')
  createWorkplace(
    @Request() req: AuthedRequest,
    @Body() body: CreateWorkspaceFolderDto,
  ) {
    return this.workspaceService.createWorkplace(
      req.user.userId,
      req.user.email,
      body,
    );
  }

  @Patch('workplaces/:workplaceId')
  updateWorkplace(
    @Request() req: AuthedRequest,
    @Param('workplaceId', new ParseUUIDPipe()) workplaceId: string,
    @Body() body: UpdateWorkspaceFolderDto,
  ) {
    return this.workspaceService.updateWorkplace(
      req.user.userId,
      req.user.email,
      workplaceId,
      body,
    );
  }

  @Delete('workplaces/:workplaceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteWorkplace(
    @Request() req: AuthedRequest,
    @Param('workplaceId', new ParseUUIDPipe()) workplaceId: string,
  ) {
    return this.workspaceService.deleteWorkplace(req.user.userId, workplaceId);
  }

  @Post('workplaces/:workplaceId/tasks')
  createWorkplaceTask(
    @Request() req: AuthedRequest,
    @Param('workplaceId', new ParseUUIDPipe()) workplaceId: string,
    @Body() body: CreateWorkspaceTaskDto,
  ) {
    return this.workspaceService.createTask(req.user.userId, workplaceId, body);
  }

  @Get('folders')
  listFolders(@Request() req: AuthedRequest) {
    return this.workspaceService.listFolders(req.user.userId, req.user.email);
  }

  @Post('folders')
  createFolder(
    @Request() req: AuthedRequest,
    @Body() body: CreateWorkspaceFolderDto,
  ) {
    return this.workspaceService.createFolder(
      req.user.userId,
      req.user.email,
      body,
    );
  }

  @Patch('folders/:folderId')
  updateFolder(
    @Request() req: AuthedRequest,
    @Param('folderId', new ParseUUIDPipe()) folderId: string,
    @Body() body: UpdateWorkspaceFolderDto,
  ) {
    return this.workspaceService.updateFolder(
      req.user.userId,
      req.user.email,
      folderId,
      body,
    );
  }

  @Delete('folders/:folderId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFolder(
    @Request() req: AuthedRequest,
    @Param('folderId', new ParseUUIDPipe()) folderId: string,
  ) {
    return this.workspaceService.deleteFolder(req.user.userId, folderId);
  }

  @Post('folders/:folderId/tasks')
  createTask(
    @Request() req: AuthedRequest,
    @Param('folderId', new ParseUUIDPipe()) folderId: string,
    @Body() body: CreateWorkspaceTaskDto,
  ) {
    return this.workspaceService.createTask(req.user.userId, folderId, body);
  }

  @Patch('tasks/:taskId')
  updateTask(
    @Request() req: AuthedRequest,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
    @Body() body: UpdateWorkspaceTaskDto,
  ) {
    return this.workspaceService.updateTask(req.user.userId, taskId, body);
  }

  @Delete('tasks/:taskId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTask(
    @Request() req: AuthedRequest,
    @Param('taskId', new ParseUUIDPipe()) taskId: string,
  ) {
    return this.workspaceService.deleteTask(req.user.userId, taskId);
  }
}
