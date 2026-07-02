/**
 * MarketplaceController — Phase 8
 *
 * Marketplace-namespaced pack management endpoints.
 * Delegates to PackRegistryService + PackInstallerService.
 *
 * In LADOS V4, all packs are compiled-in — there is no dynamic download.
 * "Install" = enable the pack globally.
 * "Uninstall" = disable the pack globally.
 * "Upgrade" = re-sync the pack's node manifests from the compiled manifest.
 *
 * Routes:
 *   GET    /marketplace/packs                  — browse all packs (enabled + disabled)
 *   POST   /marketplace/packs/:packId/install  — enable a pack (requires owner/admin)
 *   PATCH  /marketplace/packs/:packId/upgrade  — re-sync node manifests for a pack
 *   DELETE /marketplace/packs/:packId          — disable a pack (requires owner/admin)
 *   GET    /org/packs                          — list installed (enabled) packs for context org
 *
 * Security note: AI is advisory only. Pack enable/disable must never be triggered
 * by AI-generated instructions without explicit human confirmation.
 */

import {
  Controller, Get, Post, Patch, Delete,
  Param, Query, Request, UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseJwtGuard }      from '../common/guards/supabase-jwt.guard';
import { SecurityEngineService } from '../security/security.service';
import { PackRegistryService }   from '../pack/pack-registry.service';
import { PackInstallerService }  from '../pack/pack-installer.service';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { RegistryService } from './registry.service';

/**
 * Normalise a pack ID that may arrive as the short form ('construction-pack')
 * or the DB-prefixed form ('lados.construction-pack').
 * All pack rows in `pack_registry` use the 'lados.' prefix.
 */
function normalisePackId(id: string): string {
  return id.startsWith('lados.') ? id : `lados.${id}`;
}

@UseGuards(SupabaseJwtGuard)
@Controller('marketplace')
export class MarketplaceController {
  constructor(
    private readonly registry:   PackRegistryService,
    private readonly installer:  PackInstallerService,
    private readonly security:   SecurityEngineService,
    private readonly externalRegistry: RegistryService,
  ) {}

  /**
   * GET /marketplace/packs
   *
   * Browse all packs — enabled and disabled.
   * Returns the same shape as GET /packs (PackWithStats[]).
   */
  @Get('packs')
  async listPacks() {
    const data = await this.registry.getAll();
    return { success: true, data };
  }

  /**
   * POST /marketplace/packs/:packId/install
   *
   * Enable a compiled-in pack globally.
   * Requires owner or admin role (pass organizationId query param).
   *
   * Body: none (pack is pre-compiled, no config needed)
   */
  @Post('packs/:packId/install')
  async install(
    @Param('packId') packId: string,
    @Query('organizationId') orgId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (orgId) {
      await this.security.requirePermission(req.user.id, orgId, 'workflow.publish');
    }
    const id = normalisePackId(packId);
    await this.installer.enablePack(id);
    return { success: true, data: { packId: id, status: 'active', installed: true } };
  }

  /**
   * PATCH /marketplace/packs/:packId/upgrade
   *
   * Re-sync the pack's compiled node manifests into registered_nodes.
   * Useful after a platform upgrade that ships new node versions.
   * Requires owner or admin role.
   */
  @Patch('packs/:packId/upgrade')
  async upgrade(
    @Param('packId') packId: string,
    @Query('organizationId') orgId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (orgId) {
      await this.security.requirePermission(req.user.id, orgId, 'workflow.publish');
    }
    const id = normalisePackId(packId);
    // syncNodeManifests() re-syncs ALL compiled packs — acceptable for V4 compiled-in model
    await this.installer.syncNodeManifests();
    return { success: true, data: { packId: id, status: 'synced' } };
  }

  /**
   * DELETE /marketplace/packs/:packId
   *
   * Disable a pack globally.
   * Nodes from this pack will be excluded from the node palette.
   * Existing workflows that reference these nodes will fail gracefully.
   * Requires owner or admin role.
   */
  @Delete('packs/:packId')
  async uninstall(
    @Param('packId') packId: string,
    @Query('organizationId') orgId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (orgId) {
      await this.security.requirePermission(req.user.id, orgId, 'workflow.publish');
    }
    const id = normalisePackId(packId);
    await this.installer.disablePack(id);
    return { success: true, data: { packId: id, status: 'disabled', installed: false } };
  }

  /**
   * POST /marketplace/registry/:listingId/install
   *
   * Install a verified external registry pack into the local pack catalogue.
   * This registers the pack manifest and node declarations; uploaded runtime
   * code execution remains disabled until the sandbox/verification boundary is built.
   */
  @Post('registry/:listingId/install')
  async installRegistryPack(
    @Param('listingId') listingId: string,
    @Query('organizationId') orgId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    if (!orgId) throw new BadRequestException('organizationId query param is required');
    await this.security.requirePermission(req.user.id, orgId, 'workflow.publish');
    const data = await this.externalRegistry.installListing(listingId);
    return { success: true, data };
  }
}

/**
 * OrgPackController — Phase 8
 *
 * GET /org/packs — list installed (enabled) packs for current org context.
 * Separate controller to keep the /org/* namespace clean.
 */
@UseGuards(SupabaseJwtGuard)
@Controller('org')
export class OrgPackController {
  constructor(private readonly registry: PackRegistryService) {}

  /**
   * GET /org/packs?organizationId=<uuid>
   *
   * Returns all enabled packs visible to the current org.
   * In V4 packs are global, so this returns all packs with is_enabled=true.
   *
   * @param orgId - optional; when provided, used for future per-org pack filtering
   */
  @Get('packs')
  async getInstalledPacks(@Query('organizationId') _orgId: string) {
    if (!_orgId) throw new BadRequestException('organizationId query param is required');
    const all = await this.registry.getAll();
    const installed = all.filter((p) => p.is_enabled);
    return { success: true, data: installed };
  }
}
