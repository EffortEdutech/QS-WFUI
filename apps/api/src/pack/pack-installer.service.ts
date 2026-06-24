/**
 * PackInstallerService — Phase 8 / Phase 14 upgrade
 *
 * Write-side of the Pack system. Handles:
 *   - syncAll()          — on startup, upserts all compiled-in packs to the DB
 *   - registerPack()     — upsert a single pack manifest to the packs table
 *   - enablePack()       — set is_enabled=true + status='active' on pack + its nodes
 *   - disablePack()      — set is_enabled=false + status='disabled' on pack + its nodes
 *   - healthCheckAll()   — Phase 14: try to resolve every registered node; log broken ones
 *   - getResourceViews() — aggregate resource view configs from active packs
 *   - getWorkflowTemplates() — list template paths for a pack
 *
 * "Compiled-in packs" = TypeScript workspace packages statically linked into
 * this binary. Dynamic bundle loading (install from URL/upload) is deferred
 * to post-Contractor-Edition deployment.
 */

import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService }      from '../common/supabase/supabase.service';
import { PackRegistryService }  from './pack-registry.service';
import type { PackSyncResult, PackHealth }  from './pack.types';

// ── Import all compiled pack manifests ────────────────────────────────────────
import { manifest as coreManifest }        from '@lados/core-pack';
import { manifest as foundationManifest }  from '@lados/foundation-pack';
import { manifest as contractorManifest }  from '@lados/contractor-pack';
import type { PackResourceDefinition }     from '@lados/pack-sdk';

// ── Known node-type prefixes per compiled pack ────────────────────────────────
//
// Used for startup health check without requiring full service injection.
// A node type is "resolvable" if its prefix matches the pack's known namespace.

const PACK_PREFIXES: Record<string, string[]> = {
  'qsos.core-pack':          ['core.', 'resource.', 'event.', 'state.', 'artifact.', 'control.', 'trigger.', 'http.', 'delay.', 'notification.', 'workflow.', 'project.'],
  'lados.foundation-pack':   ['foundation.'],
  'lados.contractor-pack':   ['contractor.'],
  'qsos.qs-pack':            ['qs.'],
  'qsos.document-pack':      ['document.'],
  'qsos.procurement-pack':   ['procurement.'],
};

// ── In-memory manifest map ────────────────────────────────────────────────────

const MANIFEST_MAP: Record<string, { resources?: PackResourceDefinition[] }> = {
  'qsos.core-pack':          coreManifest,
  'lados.foundation-pack':   foundationManifest,
  'lados.contractor-pack':   contractorManifest,
};

// ── Compiled pack registry ────────────────────────────────────────────────────

interface CompiledPackEntry {
  dbId:         string;
  version:      string;
  displayName:  string;
  description:  string;
  author:       string;
  icon?:        string;
  color?:       string;
  isOfficial:   boolean;
  dependencies: string[];
  installedFrom: string;
}

const COMPILED_PACKS: CompiledPackEntry[] = [
  {
    dbId:          'qsos.core-pack',
    version:       coreManifest.version,
    displayName:   coreManifest.displayName,
    description:   coreManifest.description ?? 'Fundamental workflow control nodes',
    author:        coreManifest.author ?? 'Lados Platform',
    icon:          'cpu',
    color:         '#6B7280',
    isOfficial:    true,
    dependencies:  [],
    installedFrom: 'startup-sync',
  },
  {
    dbId:          'lados.foundation-pack',
    version:       foundationManifest.version,
    displayName:   foundationManifest.displayName,
    description:   foundationManifest.description ?? 'Universal capabilities for every Lados workspace',
    author:        foundationManifest.author ?? 'Lados Platform',
    icon:          'layers',
    color:         '#6366F1',
    isOfficial:    true,
    dependencies:  [],
    installedFrom: 'startup-sync',
  },
  {
    dbId:          'lados.contractor-pack',
    version:       contractorManifest.version,
    displayName:   contractorManifest.displayName,
    description:   contractorManifest.description ?? 'Contractor Edition for civil and earth-works contractors',
    author:        contractorManifest.author ?? 'Lados Platform',
    icon:          'truck',
    color:         '#F59E0B',
    isOfficial:    true,
    dependencies:  ['lados.foundation-pack'],
    installedFrom: 'startup-sync',
  },
];

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class PackInstallerService implements OnModuleInit {
  private readonly logger = new Logger(PackInstallerService.name);

  constructor(
    private readonly supabase:  SupabaseService,
    private readonly registry:  PackRegistryService,
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  async onModuleInit(): Promise<void> {
    this.logger.log('PackInstaller: syncing compiled packs on startup…');
    try {
      const result = await this.syncAll();
      this.logger.log(
        `PackInstaller: sync complete — synced: [${result.synced.join(', ')}] ` +
        `skipped: [${result.skipped.join(', ')}] errors: [${result.errors.join(', ')}]`,
      );
    } catch (err) {
      this.logger.error(`PackInstaller: startup sync failed — ${String(err)}`);
    }

    // Phase 14 — startup health check (non-blocking)
    void this.healthCheckAll();
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  async syncAll(): Promise<PackSyncResult> {
    const result: PackSyncResult = { synced: [], skipped: [], errors: [] };

    for (const entry of COMPILED_PACKS) {
      try {
        const changed = await this.registerPack(entry);
        if (changed) {
          result.synced.push(entry.dbId);
        } else {
          result.skipped.push(entry.dbId);
        }
      } catch (err) {
        this.logger.error(`PackInstaller: failed to sync ${entry.dbId} — ${String(err)}`);
        result.errors.push(entry.dbId);
      }
    }

    return result;
  }

  async registerPack(entry: CompiledPackEntry): Promise<boolean> {
    const { data: existing } = await this.supabase.admin
      .from('packs')
      .select('id, version')
      .eq('id', entry.dbId)
      .maybeSingle();

    if (existing && existing['version'] === entry.version) {
      return false;
    }

    const { error } = await this.supabase.admin
      .from('packs')
      .upsert({
        id:               entry.dbId,
        display_name:     entry.displayName,
        description:      entry.description,
        author:           entry.author,
        version:          entry.version,
        previous_version: existing ? (existing['version'] as string) : null,
        icon:             entry.icon ?? null,
        color:            entry.color ?? null,
        is_official:      entry.isOfficial,
        is_enabled:       true,
        status:           'active',
        dependencies:     entry.dependencies,
        installed_from:   entry.installedFrom,
        installed_at:     existing ? undefined : new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) throw new Error(error.message);
    return true;
  }

  // ── Enable / Disable ──────────────────────────────────────────────────────

  async enablePack(id: string): Promise<void> {
    const { allowed, blockedBy } = await this.registry.canEnable(id);
    if (!allowed) {
      throw new BadRequestException(
        `Cannot enable pack "${id}": the following dependencies are not active: ${blockedBy.join(', ')}`,
      );
    }

    const { error: packErr } = await this.supabase.admin
      .from('packs')
      .update({ is_enabled: true, status: 'active', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (packErr) throw new Error(packErr.message);

    await this.supabase.admin
      .from('registered_nodes')
      .update({ is_enabled: true, updated_at: new Date().toISOString() })
      .eq('pack_id', id);

    this.logger.log(`Pack enabled: ${id}`);
  }

  async disablePack(id: string): Promise<void> {
    await this.registry.findById(id);

    const { allowed, dependents } = await this.registry.canDisable(id);
    if (!allowed) {
      throw new BadRequestException(
        `Cannot disable pack "${id}": the following active packs depend on it: ${dependents.join(', ')}`,
      );
    }

    const { error: packErr } = await this.supabase.admin
      .from('packs')
      .update({ is_enabled: false, status: 'disabled', updated_at: new Date().toISOString() })
      .eq('id', id);

    if (packErr) throw new Error(packErr.message);

    await this.supabase.admin
      .from('registered_nodes')
      .update({ is_enabled: false, updated_at: new Date().toISOString() })
      .eq('pack_id', id);

    this.logger.log(`Pack disabled: ${id}`);
  }

  // ── Health check (Phase 14) ───────────────────────────────────────────────

  /**
   * Run a startup health check for all active packs.
   * Uses prefix-matching to verify each registered node type belongs to its pack.
   * Logs broken nodes as WARN — does NOT block startup.
   *
   * For on-demand health checks via GET /packs/:id/health,
   * PackController calls registry.getPackHealth() directly.
   */
  async healthCheckAll(): Promise<void> {
    const { data: activePacks } = await this.supabase.admin
      .from('packs')
      .select('id')
      .eq('is_enabled', true)
      .eq('status', 'active');

    for (const pack of activePacks ?? []) {
      const packId = pack['id'] as string;
      try {
        const health = await this.getPackHealthByPrefix(packId);
        if (health.status === 'healthy') {
          this.logger.log(`[HealthCheck] ${packId} — ✅ ${health.totalNodes} nodes healthy`);
        } else if (health.status === 'degraded') {
          this.logger.warn(
            `[HealthCheck] ${packId} — ⚠️ ${health.brokenNodes.length}/${health.totalNodes} nodes unrecognised: ` +
            health.brokenNodes.map((n) => n.nodeType).join(', '),
          );
        } else {
          this.logger.warn(`[HealthCheck] ${packId} — ❌ no registered nodes`);
        }
      } catch (err) {
        this.logger.warn(`[HealthCheck] ${packId} — error: ${String(err)}`);
      }
    }
  }

  /**
   * Prefix-based health check: a node is "resolvable" if its type starts with
   * one of the known prefixes for its pack. This avoids needing full service
   * injection into the pack layer at startup.
   */
  async getPackHealthByPrefix(packId: string): Promise<PackHealth> {
    const nodes = await this.registry.getPackNodes(packId);
    const prefixes = PACK_PREFIXES[packId] ?? [];

    const brokenNodes = nodes
      .filter((n) => {
        const nodeType = n['type'] as string;
        // If no prefixes configured for this pack, assume healthy (external / legacy pack)
        if (prefixes.length === 0) return false;
        return !prefixes.some((p) => nodeType.startsWith(p));
      })
      .map((n) => ({
        nodeType:   n['type'] as string,
        resolvable: false,
        error:      'Node type prefix does not match any known resolver for this pack',
      }));

    let status: PackHealth['status'];
    if (nodes.length === 0) {
      status = 'broken';
    } else if (brokenNodes.length === 0) {
      status = 'healthy';
    } else if (brokenNodes.length < nodes.length) {
      status = 'degraded';
    } else {
      status = 'broken';
    }

    return {
      packId,
      status,
      checkedAt:   new Date().toISOString(),
      totalNodes:  nodes.length,
      brokenNodes,
    };
  }

  // ── Resource view registry ────────────────────────────────────────────────

  async getResourceViews(): Promise<Record<string, PackResourceDefinition & { packId: string }>> {
    const { data: activePacks } = await this.supabase.admin
      .from('packs')
      .select('id')
      .eq('is_enabled', true)
      .eq('status', 'active');

    const activeIds = new Set((activePacks ?? []).map((p) => p['id'] as string));

    const result: Record<string, PackResourceDefinition & { packId: string }> = {};

    for (const [packId, manifest] of Object.entries(MANIFEST_MAP)) {
      if (!activeIds.has(packId)) continue;
      for (const resource of manifest.resources ?? []) {
        result[resource.type] = { ...resource, packId };
      }
    }

    return result;
  }

  async getWorkflowTemplates(packId: string): Promise<string[]> {
    const manifest = MANIFEST_MAP[packId];
    if (!manifest) return [];
    return (manifest as { workflowTemplates?: string[] }).workflowTemplates ?? [];
  }
}
