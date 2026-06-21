/**
 * ApprovalController — Phase 1
 *
 * GET  /approvals               — list pending approval tasks for current user
 * GET  /approvals/run/:runId    — list all tasks for a specific run
 * GET  /approvals/:taskId       — get a single task with its data snapshot
 * POST /approvals/:taskId/decide — approve or reject; resumes the paused run
 */
import {
  Controller, Get, Post, Param, Body, UseGuards, Request,
} from '@nestjs/common';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { ApprovalService } from './approval.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

class DecideDto {
  @IsIn(['approved', 'rejected'])
  decision!: 'approved' | 'rejected';

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  comments?: string;
}

@UseGuards(SupabaseJwtGuard)
@Controller('approvals')
export class ApprovalController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get()
  listPending(@Request() req: AuthenticatedRequest) {
    return this.approvalService.listPending(req.user.id);
  }

  @Get('run/:runId')
  listForRun(@Param('runId') runId: string, @Request() req: AuthenticatedRequest) {
    return this.approvalService.listForRun(runId, req.user.id);
  }

  @Get(':taskId')
  getTask(@Param('taskId') taskId: string, @Request() req: AuthenticatedRequest) {
    return this.approvalService.getTask(taskId, req.user.id);
  }

  @Post(':taskId/decide')
  decide(
    @Param('taskId') taskId: string,
    @Body() dto: DecideDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.approvalService.decide(
      taskId,
      dto.decision,
      dto.comments ?? '',
      req.user.id,
    );
  }
}
