/**
 * QueueController — Phase 12
 *
 * Ops endpoints for the BullMQ execution queue.
 * Requires owner or admin role (queue visibility is internal ops only).
 *
 * GET  /queue/health       — job counts (waiting/active/completed/failed/delayed/paused)
 * GET  /queue/failed-jobs  — recent failed jobs (dead-letter view)
 */

import {
  Controller, Get, Query, Request,
  UseGuards, BadRequestException,
} from '@nestjs/common';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { SecurityEngineService } from '../security/security.service';
import { ExecutionQueueService } from './execution-queue.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

@UseGuards(SupabaseJwtGuard)
@Controller('queue')
export class QueueController {
  constructor(
    private readonly queueService: ExecutionQueueService,
    private readonly security:     SecurityEngineService,
  ) {}

  private requireOrg(orgId: string | undefined): string {
    if (!orgId) throw new BadRequestException('organizationId query param is required');
    return orgId;
  }

  /**
   * GET /queue/health?organizationId=
   *
   * Returns BullMQ queue counts. When Redis is not configured
   * (dev / in-process fallback), returns { mode: 'in-process' } instead.
   */
  @Get('health')
  async getHealth(
    @Query('organizationId') rawOrgId: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    const orgId = this.requireOrg(rawOrgId);
    await this.security.requirePermission(req.user.id, orgId, 'queue.view');

    const stats = await this.queueService.getStats();
    if (!stats) {
      return {
        success: true,
        data: {
          mode:    'in-process',
          message: 'Redis not configured — BullMQ disabled, using in-process fallback',
        },
      };
    }

    return {
      success: true,
      data: {
        mode:      'bullmq',
        queueName: 'lados-execution',
        counts:    stats,
      },
    };
  }

  /**
   * GET /queue/failed-jobs?organizationId=&limit=20
   *
   * Returns recent failed BullMQ jobs for dead-letter inspection.
   * When Redis is not configured returns an empty list.
   */
  @Get('failed-jobs')
  async getFailedJobs(
    @Query('organizationId') rawOrgId: string | undefined,
    @Query('limit') rawLimit: string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    const orgId = this.requireOrg(rawOrgId);
    await this.security.requirePermission(req.user.id, orgId, 'queue.view');

    const limit = rawLimit ? Math.min(parseInt(rawLimit, 10) || 20, 100) : 20;
    const jobs  = await this.queueService.getFailedJobs(limit);

    return { success: true, data: jobs };
  }
}
