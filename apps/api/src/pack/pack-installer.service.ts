/**
 * PackInstallerService — Phase 8
 *
 * Write-side of the Pack system. Handles:
 *   - syncAll()       — on startup, upserts all compiled-in packs to the DB
 *   - registerPack()  — upsert a single pack manifest to the packs table
 *   - enablePack()    — set is_enabled=true + status='active' on pack + its nodes
 *   - disablePack()   — set is_enabled=false + status='disabled' on pack + its nodes
 *
 * "Compiled-in packs" = TypeScript workspace packages statically linked into
 * this binary. We cannot dynamically load new packs without a rebuild — but
 * admins can enable/disable and the DB stays authoritative for UI display.
 *
 * Node registration (inputs/outputs/config_schema) remains via SQL migrations.
 * PackInstallerService only manages the packs table identity row.
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
import type { PackSyncResult }  from './pack.types';

// ── Import all compiled pack manifests ────────────────────────────────────────
import { manifest as coreManifest }        from '@lados/core-pack';
import { manifest as foundationManifest }  from '@lados/foundation-pack';
import { manifest as contractorManifest }  from '@lados/contractor-pack';
import type { PackResourceDefinition }     from '@lados/pack-sdk';
// Document, QS, Procurement, AI packs may not export a manifest yet — guard with try/catch in sync
// We import them dynamically in syncAll() to tolerate missing exports.

// ── In-memory manifest map ────────────────────────────────────────────────────
//
// Used by getResourceViews() to build the aggregated resource-type view registry.
// Keyed by the canonical DB id of each pack.

const MANIFEST_MAP: Record<string, { resources?: PackResourceDefinition[] }> = {
  'qsos.core-pack':          coreManifest,
  'lados.foundation-pack':   foundationManifest,
  'lados.contractor-pack':   contractorManifest,
};

// ── Compiled pack registry ────────────────────────────────────────────────────
//
// Maps each workspace pack to its canonical DB id.
// The DB id uses dotted-namespace format (lados.*).
// Existing packs that pre-date Phase 8 keep their qsos.* DB IDs.

interface CompiledPackEntry {
  dbId:    string;
  version: string;
  displayName: string;
  description: string;
  author:  string;
  icon?:   string;
  color?:  string;
  isOfficial: boolean;
  dependencies: string[];
}

const COMPILED_PACKS: CompiledPackEntry[] = [
  {
    dbId:        'qsos.core-pack',
    version:     coreManifest.version,
    displayName: coreManifest.displayName,
    description: coreManifest.description ?? 'Fundamental workflow control nodes',
    author:      coreManifest.author ?? 'Lados Platform',
    icon:        'cpu',
    color:       '#6B7280',
    isOfficial:  true,
    dependencies: [],
  },
  {
    dbId:        'lados.foundation-pack',
    version:     foundationManifest.version,
    displayName: foundationManifest.displayName,
    description: foundationManifest.description ?? 'Universal capabilities for every Lados workspace',
    author:      foundationManifest.author ?? 'Lados Platform',
    icon:        'layers',
    color:       '#6366F1',
    isOfficial:  true,
    dependencies: [],
  },
  {
    dbId:        'lados.contractor-pack',
    version:     contractorManifest.version,
    displayName: contractorManifest.displayName,
    description: contractorManifest.description ?? 'Contractor Edition for civil and earth-works contractors',
    author:      contractorManifest.author ?? 'Lados Platform',
    icon:        'truck',
    color:       '#F59E0B',
    isOfficial:  true,
    dependencies: ['lados.foundation-pack'],
  },
  // qsos.qs-pack, qsos.document-pack, qsos.procurement-pack, qsos.ai-pack
  // are seeded by earlier migrations and do not have compiled manifest imports yet.
  // They will appear in getAll() from the DB but are not synced by this service
  // until their packs export a manifest.
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
  }

  // ── Sync ──────────────────────────────────────────────────────────────────

  /**
   * Sync all compiled-in packs to the packs table.
   * Upserts the pack identity row — does NOT touch registered_nodes
   * (node schema registration happens via SQL migrations).
   */
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

  /**
   * Upsert a pack identity row into the packs table.
   * Returns true if the row was inserted or updated, false if already current.
   */
  async registerPack(entry: CompiledPackEntry): Promise<boolean> {
    const { data: existing } = await this.supabase.admin
      .from('packs')
      .select('id, version')
      .eq('id', entry.dbId)
      .maybeSingle();

    if (existing && existing['version'] === entry.version) {
      return false; // already up to date
    }

    const { error } = await this.supabase.admin
      .from('packs')
      .upsert({
        id:           entry.dbId,
        display_name: entry.displayName,
        description:  entry.description,
        author:       entry.author,
        version:      entry.version,
        icon:         entry.icon ?? null,
        color:        entry.color ?? null,
        is_official:  entry.isOfficial,
        is_enabled:   true,
        status:       'active',
        dependencies: entry.dependencies,
        installed_at: existing ? undefined : new Date().toISOString(),
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) throw new Error(error.message);
    return true;
  }

  // ── Enable / Disable ──────────────────────────────────────────────────────

  /**
   * Enable a pack and all its registered nodes.
   * Validates dependencies are satisfied first.
   */
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

    // Re-enable all nodes belonging to this pack
    await this.supabase.admin
      .from('registered_nodes')
      .update({ is_enabled: true, updated_at: new Date().toISOString() })
      .eq('pack_id', id);

    this.logger.log(`Pack enabled: ${id}`);
  }

  /**
   * Disable a pack and all its registered nodes.
   * Validates no active pack depends on this one first.
   */
  async disablePack(id: string): Promise<void> {
    // Cannot disable a pack that doesn't exist
    await this.registry.findById(id); // throws NotFoundException if missing

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

    // Disable all nodes belonging to this pack
    await this.supabase.admin
      .from('registered_nodes')
      .update({ is_enabled: false, updated_at: new Date().toISOString() })
      .eq('pack_id', id);

    this.logger.log(`Pack disabled: ${id}`);
  }

  // ── Resource view registry ────────────────────────────────────────────────

  /**
   * Aggregate resource type view configs from all active, installed packs.
   *
   * The generic /resources page calls this endpoint on mount to know:
   *   - what resource types exist in this workspace
   *   - how each type should be rendered (primaryField, badgeField, etc.)
   *   - which inline actions are available per state
   *
   * Filtered to packs that are both is_enabled=true and status='active' in DB,
   * so enabling/disabling a pack is reflected immediately without a restart.
   *
   * Returns: Record<resourceType, { packId, displayName, icon?, views? }>
   */
  async getResourceViews(): Promise<Record<string, PackResourceDefinition & { packId: string }>> {
    // Fetch active pack IDs from DB
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

  /**
   * Return workflow template declarations from all active packs.
   * Keys are template file paths relative to the pack root.
   * Used by GET /packs/:id/templates to list available templates.
   */
  async getWorkflowTemplates(packId: string): Promise<string[]> {
    const manifest = MANIFEST_MAP[packId];
    if (!manifest) return [];
    return (manifest as { workflowTemplates?: string[] }).workflowTemplates ?? [];
  }
}
