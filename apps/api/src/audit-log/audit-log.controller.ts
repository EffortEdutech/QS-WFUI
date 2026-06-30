/**
 * AuditLogController — Phase 11
 *
 * GET  /audit-log        — paginated audit log for an org (org_admin+)
 * GET  /audit-log/export — CSV download (org_admin+)
 *
 * organizationId passed as required query param (matches existing pattern).
 * Role check: requires at least org_admin via SecurityEngineService.
 */

import {
  Controller, Get, Query, Request, Response,
  UseGuards, BadRequestException,
} from '@nestjs/common';
import type { Response as ExpressResponse } from 'express';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { SecurityEngineService } from '../security/security.service';
import { AuditLogService } from './audit-log.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

@UseGuards(SupabaseJwtGuard)
@Controller('audit-log')
export class AuditLogController {
  constructor(
    private readonly auditLog: AuditLogService,
    private readonly security: SecurityEngineService,
  ) {}

  private requireOrg(orgId: string | undefined): string {
    if (!orgId) throw new BadRequestException('organizationId query param is required');
    return orgId;
  }

  // ── GET /audit-log ────────────────────────────────────────────────────────

  @Get()
  async list(
    @Query('organizationId') orgId: string,
    @Query('actorId')        actorId:     string | undefined,
    @Query('eventType')      eventType:   string | undefined,
    @Query('entityType')     entityType:  string | undefined,
    @Query('projectId')      projectId:   string | undefined,
    @Query('from')           from:        string | undefined,
    @Query('to')             to:          string | undefined,
    @Query('limit')          limitStr:    string | undefined,
    @Query('offset')         offsetStr:   string | undefined,
    @Request() req: AuthenticatedRequest,
  ) {
    const oid = this.requireOrg(orgId);

    await this.security.requirePermission(req.user.id, oid, 'audit.view');

    const limit  = limitStr  ? Math.min(parseInt(limitStr,  10), 200) : 50;
    const offset = offsetStr ? Math.max(parseInt(offsetStr, 10), 0)  : 0;

    const { data, total } = await this.auditLog.list({
      organizationId: oid,
      actorId,
      eventType,
      entityType,
      projectId,
      from,
      to,
      limit,
      offset,
    });

    return {
      success: true,
      data,
      meta: { total, limit, offset },
    };
  }

  // ── GET /audit-log/export ─────────────────────────────────────────────────

  @Get('export')
  async exportCsv(
    @Query('organizationId') orgId: string,
    @Query('actorId')        actorId:    string | undefined,
    @Query('eventType')      eventType:  string | undefined,
    @Query('entityType')     entityType: string | undefined,
    @Query('projectId')      projectId:  string | undefined,
    @Query('from')           from:       string | undefined,
    @Query('to')             to:         string | undefined,
    @Request()  req: AuthenticatedRequest,
    @Response() res: ExpressResponse,
  ): Promise<void> {
    const oid = this.requireOrg(orgId);

    await this.security.requirePermission(req.user.id, oid, 'audit.export');

    const csv = await this.auditLog.exportCsv({
      organizationId: oid,
      actorId,
      eventType,
      entityType,
      projectId,
      from,
      to,
    });

    const filename = `audit-log-${oid}-${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
