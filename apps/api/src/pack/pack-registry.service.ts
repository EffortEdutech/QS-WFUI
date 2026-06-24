/**
 * PackRegistryService — Phase 8 / Phase 14 upgrade
 *
 * Read-side of the Pack system.
 * Phase 8: list, findById, canEnable, canDisable, getPackNodes.
 * Phase 14: getPackHealth(), setNodeOverride(), getNodeOverrides(),
 *           getDisabledNodeTypes() — used by ExecutionService to populate skipNodes.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import type {
  PackRecord,
  PackWithStats,
  PackHealth,
  NodeHealthResult,
  HealthStatus,
  PackNodeOverride,
} from './pack.types';

@Injectable()
export class PackRegistryService {
  private readonly logger = new Logger(PackRegistryService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ── Read operations ───────────────────────────────────────────────────────

  /** List all packs with node count. */
  async getAll(): Promise<PackWithStats[]> {
    const { data: packs, error } = await this.supabase.admin
      .from('packs')
      .select('id, display_name, description, author, version, previous_version, icon, color, is_official, is_enabled, status, dependencies, installed_from, checksum, installed_at, created_at, updated_at')
      .order('is_official', { ascending: false })
      .order('display_name');

    if (error) throw new Error(error.message);

    const { data: nodes } = await this.supabase.admin
      .from('registered_nodes')
      .select('pack_id');

    const countMap: Record<string, number> = {};
    for (const n of nodes ?? []) {
      countMap[n.pack_id as string] = (countMap[n.pack_id as string] ?? 0) + 1;
    }

    return (packs ?? []).map((p) => ({
      ...(p as unknown as PackRecord),
      node_count: countMap[p.id] ?? 0,
      health:     null, // loaded separately to keep getAll() fast
    }));
  }

  /** Get a single pack by ID. */
  async findById(id: string): Promise<PackWithStats> {
    const { data, error } = await this.supabase.admin
      .from('packs')
      .select('id, display_name, description, author, version, previous_version, icon, color, is_official, is_enabled, status, dependencies, installed_from, checksum, installed_at, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException(`Pack "${id}" not found`);

    const { count } = await this.supabase.admin
      .from('registered_nodes')
      .select('*', { count: 'exact', head: true })
      .eq('pack_id', id);

    return { ...(data as unknown as PackRecord), node_count: count ?? 0, health: null };
  }

  /** Return true if a pack is installed and active. */
  async isActive(id: string): Promise<boolean> {
    const { data } = await this.supabase.admin
      .from('packs')
      .select('is_enabled, status')
      .eq('id', id)
      .maybeSingle();

    return !!(data && data['is_enabled'] && data['status'] === 'active');
  }

  // ── Dependency validation ─────────────────────────────────────────────────

  async canEnable(id: string): Promise<{ allowed: boolean; blockedBy: string[] }> {
    const pack = await this.findById(id);
    const deps = (pack.dependencies ?? []) as string[];
    if (deps.length === 0) return { allowed: true, blockedBy: [] };

    const blockedBy: string[] = [];
    for (const depId of deps) {
      const active = await this.isActive(depId);
      if (!active) blockedBy.push(depId);
    }

    return { allowed: blockedBy.length === 0, blockedBy };
  }

  async canDisable(id: string): Promise<{ allowed: boolean; dependents: string[] }> {
    const { data: packs } = await this.supabase.admin
      .from('packs')
      .select('id, dependencies')
      .eq('is_enabled', true)
      .neq('id', id);

    const dependents: string[] = [];
    for (const p of packs ?? []) {
      const deps = (p['dependencies'] as string[] | null) ?? [];
      if (deps.includes(id)) dependents.push(p['id'] as string);
    }

    return { allowed: dependents.length === 0, dependents };
  }

  /** Get all nodes for a specific pack. */
  async getPackNodes(packId: string) {
    const { data, error } = await this.supabase.admin
      .from('registered_nodes')
      .select('type, name, description, version, category, icon, color, tags, inputs, outputs, config_schema, ui_schema, is_enabled, uses_services, data_pack_deps')
      .eq('pack_id', packId)
      .order('category')
      .order('name');

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  // ── Health check (Phase 14) ───────────────────────────────────────────────

  /**
   * Check all registered nodes for a pack are resolvable by the real-node resolver.
   * Accepts a resolverFn injected by PackInstallerService to avoid a circular dep.
   *
   * Status:
   *   healthy  — all nodes resolve
   *   degraded — some nodes broken
   *   broken   — no nodes resolve (or pack has 0 nodes)
   */
  async getPackHealth(
    packId: string,
    resolverFn: (nodeType: string) => unknown,
  ): Promise<PackHealth> {
    const nodes = await this.getPackNodes(packId);
    const results: NodeHealthResult[] = [];

    for (const node of nodes) {
      const nodeType = node['type'] as string;
      try {
        const handler = resolverFn(nodeType);
        results.push({ nodeType, resolvable: !!handler });
      } catch (err: unknown) {
        results.push({
          nodeType,
          resolvable: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const brokenNodes = results.filter((r) => !r.resolvable);
    let status: HealthStatus;
    if (nodes.length === 0 || brokenNodes.length === nodes.length) {
      status = 'broken';
    } else if (brokenNodes.length > 0) {
      status = 'degraded';
    } else {
      status = 'healthy';
    }

    return {
      packId,
      status,
      checkedAt:   new Date().toISOString(),
      totalNodes:  nodes.length,
      brokenNodes,
    };
  }

  // ── Node overrides (Phase 14) ─────────────────────────────────────────────

  /**
   * Set a per-org node enable/disable override.
   * Upserts — calling again with is_enabled=true removes the disable.
   */
  async setNodeOverride(
    orgId:     string,
    packId:    string,
    nodeType:  string,
    isEnabled: boolean,
    userId:    string,
  ): Promise<PackNodeOverride> {
    const { data, error } = await this.supabase.admin
      .from('pack_node_overrides')
      .upsert(
        {
          org_id:        orgId,
          pack_id:       packId,
          node_type:     nodeType,
          is_enabled:    isEnabled,
          overridden_by: userId,
          overridden_at: new Date().toISOString(),
        },
        { onConflict: 'org_id,pack_id,node_type' },
      )
      .select()
      .single();

    if (error) throw new Error(error.message);
    this.logger.log(
      `Node override: org=${orgId} pack=${packId} node=${nodeType} enabled=${isEnabled} by=${userId}`,
    );
    return data as unknown as PackNodeOverride;
  }

  /**
   * Get all node overrides for an org (optionally filtered to one pack).
   */
  async getNodeOverrides(orgId: string, packId?: string): Promise<PackNodeOverride[]> {
    let query = this.supabase.admin
      .from('pack_node_overrides')
      .select('*')
      .eq('org_id', orgId);

    if (packId) query = query.eq('pack_id', packId);

    const { data, error } = await query.order('overridden_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as PackNodeOverride[];
  }

  /**
   * Return the set of node types that are explicitly DISABLED for an org.
   * Called by ExecutionService to populate skipNodes before enqueuing a run.
   */
  async getDisabledNodeTypes(orgId: string): Promise<Set<string>> {
    const { data, error } = await this.supabase.admin
      .from('pack_node_overrides')
      .select('node_type')
      .eq('org_id', orgId)
      .eq('is_enabled', false);

    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((r) => r['node_type'] as string));
  }
}
