/**
 * SecurityController — Phase 6
 *
 * GET  /security/permissions              — permission matrix (admin use)
 * GET  /security/permissions/:action      — allowed roles for one action
 * GET  /security/my-permissions           — caller's allowed actions in an org
 */
import {
  Controller, Get, Param, Query, UseGuards, Request, ForbiddenException,
} from '@nestjs/common';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { SecurityEngineService } from './security.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

@UseGuards(SupabaseJwtGuard)
@Controller('security')
export class SecurityController {
  constructor(private readonly security: SecurityEngineService) {}

  @Get('permissions')
  getMatrix() {
    return this.security.getMatrix();
  }

  @Get('permissions/:action')
  getAllowedRoles(@Param('action') action: string) {
    return { action, allowedRoles: this.security.getAllowedRoles(action) };
  }

  @Get('my-permissions')
  async getMyPermissions(
    @Query('organizationId') orgId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!orgId) throw new ForbiddenException('organizationId is required');
    const role = await this.security.getRole(req.user.id, orgId);
    if (!role) return { role: null, permissions: [] };
    return {
      role,
      permissions: this.security.getPermissionsForRole(role),
    };
  }
}
