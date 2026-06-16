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
}
