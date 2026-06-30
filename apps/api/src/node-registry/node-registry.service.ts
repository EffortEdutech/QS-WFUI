/**
 * NodeRegistryService -- Phase 1H
 *
 * Returns the full node registry structured for the Workflow Builder canvas
 * (NodePalette component). Unlike NodeService which returns a flat list,
 * NodeRegistryService returns nodes pre-grouped by pack with pack metadata.
 *
 * Uses admin client so the query is not blocked by RLS -- the authenticated
 * guard in NodeRegistryController ensures only valid JWT callers can reach it.
 */

import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { NodeService } from '../node/node.service';
import { PackInstallerService } from '../pack/pack-installer.service';

export interface RegistryPack {
  id:          string;
  displayName: string;
  description: string | null;
  color:       string | null;
  icon:        string | null;
  version:     string;
  nodeCount:   number;
  nodes:       RegistryNode[];
}

export interface RegistryNode {
  type:          string;
  name:          string;
  description:   string;
  category:      string;
  color:         string | null;
  tags:          string[];
  inputs:        unknown[];
  outputs:       unknown[];
  config_schema: unknown[];
  ui_schema:     unknown;
  pack_id:       string;
}

export interface NodeRegistryResponse {
  packs: RegistryPack[];
  meta: {
    totalNodes: number;
    totalPacks: number;
    syncedAt:   string;
  };
}

@Injectable()
export class NodeRegistryService {
  private readonly logger = new Logger(NodeRegistryService.name);

  constructor(
    private readonly supabase:    SupabaseService,
    private readonly nodeService: NodeService,
    private readonly installer:   PackInstallerService,
  ) {}

  /**
   * Returns all enabled nodes grouped by active pack.
   * Optimised for the NodePalette: one call, no client-side grouping needed.
   */
  async getRegistry(): Promise<NodeRegistryResponse> {
    // 1. Fetch all active packs
    const { data: packs, error: packErr } = await this.supabase.admin
      .from('packs')
      .select('id, display_name, description, color, icon, version')
      .eq('is_enabled', true)
      .eq('status', 'active')
      .order('display_name');

    if (packErr) throw new Error(packErr.message);

    // 2. Fetch all enabled nodes (flat)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodes = (await this.nodeService.findAll()) as unknown as RegistryNode[];

    // 3. Group nodes by pack_id
    const nodesByPack = new Map<string, RegistryNode[]>();
    for (const node of nodes) {
      const pid = node.pack_id;
      if (!nodesByPack.has(pid)) nodesByPack.set(pid, []);
      nodesByPack.get(pid)!.push(node);
    }

    // 4. Build structured pack+node list; exclude packs with no nodes
    const registryPacks: RegistryPack[] = (packs ?? [])
      .map((pack) => {
        const packNodes = nodesByPack.get(pack.id) ?? [];
        return {
          id:          pack.id,
          displayName: pack.display_name,
          description: pack.description ?? null,
          color:       pack.color ?? null,
          icon:        pack.icon ?? null,
          version:     pack.version,
          nodeCount:   packNodes.length,
          nodes:       packNodes,
        };
      })
      .filter((p) => p.nodeCount > 0);

    return {
      packs: registryPacks,
      meta: {
        totalNodes: nodes.length,
        totalPacks: registryPacks.length,
        syncedAt:   new Date().toISOString(),
      },
    };
  }

  /**
   * Get a single node definition by type.
   * Delegates to NodeService (same data, validated + typed).
   */
  async getNode(type: string) {
    return this.nodeService.findOne(type);
  }

  /**
   * Called after a new organization is created.
   * Ensures Foundation Pack node manifests are seeded in registered_nodes.
   * Safe to call multiple times (idempotent upsert).
   *
   * This is a lightweight guard: PackInstallerService.onModuleInit() already
   * seeds on startup, but calling here ensures correct state even if this
   * request races against an API cold-start.
   */
  async seedForOrg(orgId: string): Promise<void> {
    const { count } = await this.supabase.admin
      .from('registered_nodes')
      .select('type', { count: 'exact', head: true })
      .eq('pack_id', 'lados.foundation-pack')
      .eq('is_enabled', true);

    if ((count ?? 0) === 0) {
      this.logger.warn(
        `NodeRegistry.seedForOrg: Foundation Pack nodes missing -- triggering sync (orgId=${orgId})`,
      );
      await this.installer.syncNodeManifests();
    } else {
      this.logger.log(
        `NodeRegistry.seedForOrg: ${count} Foundation Pack nodes already seeded (orgId=${orgId})`,
      );
    }
  }
}
