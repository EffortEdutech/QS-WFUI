/**
 * NodeRegistryController — Phase 1H
 *
 * GET /api/v1/node-registry        — full registry grouped by pack (NodePalette)
 * GET /api/v1/node-registry/:type  — single node definition
 *
 * Requires a valid Supabase JWT. Uses admin client internally so RLS does not
 * block reads — the JWT guard is the auth boundary.
 */

import {
  Controller,
  Get,
  Param,
  UseGuards,
} from '@nestjs/common';
import { SupabaseJwtGuard } from '../common/guards/supabase-jwt.guard';
import { NodeRegistryService } from './node-registry.service';

@Controller('node-registry')
@UseGuards(SupabaseJwtGuard)
export class NodeRegistryController {
  constructor(private readonly nodeRegistry: NodeRegistryService) {}

  /**
   * GET /api/v1/node-registry
   *
   * Returns all enabled nodes pre-grouped by active pack.
   * Designed for the Workflow Builder NodePalette — one call replaces
   * the old pattern of GET /nodes + GET /nodes/packs + client-side grouping.
   *
   * Response shape:
   * {
   *   success: true,
   *   data: {
   *     packs: [{ id, displayName, description, color, icon, version, nodeCount, nodes }],
   *     meta:  { totalNodes, totalPacks, syncedAt }
   *   }
   * }
   */
  @Get()
  async getRegistry() {
    const data = await this.nodeRegistry.getRegistry();
    return { success: true, data, error: null };
  }

  /**
   * GET /api/v1/node-registry/:type
   * Returns a single node definition (same data as GET /nodes/:type).
   */
  @Get(':type')
  async getNode(@Param('type') type: string) {
    const data = await this.nodeRegistry.getNode(type);
    return { success: true, data, error: null };
  }
}
