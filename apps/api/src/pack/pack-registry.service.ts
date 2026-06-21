/**
 * PackRegistryService — Phase 8
 *
 * Read-side of the Pack system.
 * Reads from the `packs` table, exposes pack metadata and lifecycle state,
 * and validates enable/disable operations against dependency constraints.
 *
 * Write operations (enable/disable, sync) live in PackInstallerService.
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import type { PackRecord, PackWithStats } from './pack.types';

@Injectable()
export class PackRegistryService {
  private readonly logger = new Logger(PackRegistryService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ── Read operations ───────────────────────────────────────────────────────

  /** List all packs with node count. */
  async getAll(): Promise<PackWithStats[]> {
    const { data: packs, error } = await this.supabase.admin
      .from('packs')
      .select('id, display_name, description, author, version, icon, color, is_official, is_enabled, status, dependencies, installed_at, created_at, updated_at')
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
    }));
  }

  /** Get a single pack by ID. */
  async findById(id: string): Promise<PackWithStats> {
    const { data, error } = await this.supabase.admin
      .from('packs')
      .select('id, display_name, description, author, version, icon, color, is_official, is_enabled, status, dependencies, installed_at, created_at, updated_at')
      .eq('id', id)
      .single();

    if (error || !data) throw new NotFoundException(`Pack "${id}" not found`);

    const { count } = await this.supabase.admin
      .from('registered_nodes')
      .select('*', { count: 'exact', head: true })
      .eq('pack_id', id);

    return { ...(data as unknown as PackRecord), node_count: count ?? 0 };
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

  /**
   * Check whether a pack can be enabled.
   * All its declared dependencies must be installed and active.
   * Returns { allowed, blockedBy[] }.
   */
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

  /**
   * Check whether a pack can be disabled.
   * No other active pack may list this pack as a dependency.
   * Returns { allowed, dependents[] }.
   */
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
}
