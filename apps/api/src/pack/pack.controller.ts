/**
 * PackController — Phase 8 / Phase 9 Correction
 *
 * GET  /packs                      — list all packs with node count + status
 * GET  /packs/resource-views       — aggregated resource type view configs from active packs
 * GET  /packs/:id                  — single pack detail + its nodes
 * GET  /packs/:id/templates        — workflow template list for a pack
 * POST /packs/sync                 — trigger syncAll() (owner/admin only)
 * PATCH /packs/:id/enable          — enable a pack (owner/admin only)
 * PATCH /packs/:id/disable         — disable a pack (owner/admin only)
 */

import {
  Controller, Get, Post, Patch,
  Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { SupabaseJwtGuard }      from '../common/guards/supabase-jwt.guard';
import { SecurityEngineService } from '../security/security.service';
import { PackRegistryService }   from './pack-registry.service';
import { PackInstallerService }  from './pack-installer.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';

@UseGuards(SupabaseJwtGuard)
@Controller('packs')
export class PackController {
  constructor(
    private readonly registry:   PackRegistryService,
    private readonly installer:  PackInstallerService,
    private readonly security:   SecurityEngineService,
  ) {}

  /** List all packs */
  @Get()
  async getAll() {
    const data = await this.registry.getAll();
    return { success: true, data };
  }

  /**
   * GET /packs/resource-views
   *
   * Returns an aggregated map of resource type → view config from all active packs.
   * The generic /resources page calls this on mount to know how to render each type.
   *
   * Response shape:
   * {
   *   "job":  { type, displayName, icon, views: { list: {...}, inlineActions: [...] }, packId },
   *   "trip": { ... },
   *   ...
   * }
   *
   * NOTE: This route must appear BEFORE ':id' to avoid being shadowed.
   */
  @Get('resource-views')
  async getResourceViews() {
    const data = await this.installer.getResourceViews();
    return { success: true, data };
  }

  /** Get a single pack + its nodes */
  @Get(':id')
  async getOne(@Param('id') id: string) {
    const [pack, nodes] = await Promise.all([
      this.registry.findById(id),
      this.registry.getPackNodes(id),
    ]);
    return { success: true, data: { ...pack, nodes } };
  }

  /**
   * GET /packs/:id/templates
   *
   * Returns the list of workflow template paths registered in a pack manifest.
   * The "Start from Template" modal calls this when a user selects a pack.
   *
   * Response: { packId: string, templates: string[] }
   */
  @Get(':id/templates')
  async getTemplates(@Param('id') id: string) {
    const templates = await this.installer.getWorkflowTemplates(id);
    return { success: true, data: { packId: id, templates } };
  }

  /** Trigger syncAll — admin/owner only */
  @Post('sync')
  async sync(
    @Query('organizationId') orgId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (orgId) {
      await this.security.requirePermission(req.user.id, orgId, 'workflow.publish');
    }
    const data = await this.installer.syncAll();
    return { success: true, data };
  }

  /** Enable a pack */
  @Patch(':id/enable')
  async enable(
    @Param('id') id: string,
    @Query('organizationId') orgId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (orgId) {
      await this.security.requirePermission(req.user.id, orgId, 'workflow.publish');
    }
    await this.installer.enablePack(id);
    return { success: true, data: { id, status: 'active', enabled: true } };
  }

  /** Disable a pack */
  @Patch(':id/disable')
  async disable(
    @Param('id') id: string,
    @Query('organizationId') orgId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (orgId) {
      await this.security.requirePermission(req.user.id, orgId, 'workflow.publish');
    }
    await this.installer.disablePack(id);
    return { success: true, data: { id, status: 'disabled', enabled: false } };
  }
}
