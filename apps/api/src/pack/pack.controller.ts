/**
 * PackController — Phase 8 / Phase 9 Correction / Phase 14 upgrade
 *
 * GET  /packs                                        — list all packs with node count + status
 * GET  /packs/resource-views                         — aggregated resource type view configs from active packs
 * GET  /packs/:id                                    — single pack detail + its nodes
 * GET  /packs/:id/templates                          — workflow template list for a pack
 * GET  /packs/:id/health                             — Phase 14: pack health check result
 * GET  /packs/:id/node-overrides                     — Phase 14: list org node overrides for a pack
 * PATCH /packs/:id/nodes/:nodeType/enable            — Phase 14: enable a node type for an org
 * PATCH /packs/:id/nodes/:nodeType/disable           — Phase 14: disable a node type for an org
 * POST /packs/sync                                   — trigger syncAll() (owner/admin only)
 * PATCH /packs/:id/enable                            — enable a pack (owner/admin only)
 * PATCH /packs/:id/disable                           — disable a pack (owner/admin only)
 */

import {
  Controller, Get, Post, Patch,
  Param, Query, Request, UseGuards,
  BadRequestException,
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

  // ── Phase 14: health + node overrides ────────────────────────────────────

  /**
   * GET /packs/:id/health
   *
   * Returns a real-time health check for the pack — checks each registered
   * node type against its known prefix. Uses the same prefix-based check
   * as the startup log, so it's fast and safe to call on demand.
   *
   * Response: { packId, status, checkedAt, totalNodes, brokenNodes[] }
   */
  @Get(':id/health')
  async getHealth(@Param('id') id: string) {
    const data = await this.installer.getPackHealthByPrefix(id);
    return { success: true, data };
  }

  /**
   * GET /packs/:id/node-overrides?organizationId=<uuid>
   *
   * Lists all node-level overrides for this pack in the given org.
   * Returns is_enabled per node type so the UI can render the toggle state.
   */
  @Get(':id/node-overrides')
  async getNodeOverrides(
    @Param('id') id: string,
    @Query('organizationId') orgId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!orgId) throw new BadRequestException('organizationId query param is required');
    await this.security.requireMembership(req.user.id, orgId);
    const data = await this.registry.getNodeOverrides(orgId, id);
    return { success: true, data };
  }

  /**
   * PATCH /packs/:id/nodes/:nodeType/enable?organizationId=<uuid>
   *
   * Enable a specific node type for an org (removes the disable override).
   * Requires owner or admin role.
   * nodeType must be URL-encoded if it contains dots (e.g. contractor.dispatch_trip → contractor%2Edispatch_trip).
   */
  @Patch(':id/nodes/:nodeType/enable')
  async enableNode(
    @Param('id') packId: string,
    @Param('nodeType') nodeType: string,
    @Query('organizationId') orgId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!orgId) throw new BadRequestException('organizationId query param is required');
    await this.security.requirePermission(req.user.id, orgId, 'workflow.publish');
    const data = await this.registry.setNodeOverride(orgId, packId, nodeType, true, req.user.id);
    return { success: true, data };
  }

  /**
   * PATCH /packs/:id/nodes/:nodeType/disable?organizationId=<uuid>
   *
   * Disable a specific node type for an org. Disabled nodes are added to
   * skipNodes automatically when a run is enqueued for this org.
   * Requires owner or admin role.
   */
  @Patch(':id/nodes/:nodeType/disable')
  async disableNode(
    @Param('id') packId: string,
    @Param('nodeType') nodeType: string,
    @Query('organizationId') orgId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!orgId) throw new BadRequestException('organizationId query param is required');
    await this.security.requirePermission(req.user.id, orgId, 'workflow.publish');
    const data = await this.registry.setNodeOverride(orgId, packId, nodeType, false, req.user.id);
    return { success: true, data };
  }

  // ── Existing ──────────────────────────────────────────────────────────────

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
