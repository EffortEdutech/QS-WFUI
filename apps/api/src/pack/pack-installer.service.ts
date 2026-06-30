/**
 * PackInstallerService - Phase 8 / Phase 14 upgrade
 *
 * Write-side of the Pack system. Handles:
 *   - syncAll()           - on startup, upserts all compiled-in packs to the DB
 *   - registerPack()      - upsert a single pack manifest to the packs table
 *   - enablePack()        - set is_enabled=true + status='active' on pack + its nodes
 *   - disablePack()       - set is_enabled=false + status='disabled' on pack + its nodes
 *   - healthCheckAll()    - Phase 14: try to resolve every registered node; log broken ones
 *   - getResourceViews()  - aggregate resource view configs from active packs
 *   - getWorkflowTemplates() - list template paths for a pack
 *   - syncNodeManifests() - Phase 1G: upsert NodeManifestV2 declarations to registered_nodes
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
import { SupabaseService }     from '../common/supabase/supabase.service';
import { PackRegistryService } from './pack-registry.service';
import type { PackSyncResult, PackHealth } from './pack.types';

// -- Pack-level manifests (PackManifest) -----------------------------------------
import { manifest as coreManifest }         from '@lados/core-pack';
import { manifest as foundationManifest }   from '@lados/foundation-pack';
import { manifest as contractorManifest }   from '@lados/contractor-pack';
import { manifest as qsManifest }           from '@lados/qs-pack';
import { manifest as documentManifest }     from '@lados/document-pack';
import { manifest as procurementManifest }  from '@lados/procurement-pack';
import { manifest as constructionManifest }    from '@lados/construction-pack';     // Phase 7
import { manifest as financeManifest }         from '@lados/finance-pack';            // Phase 9
import { manifest as notificationsManifest }   from '@lados/notifications-pack';      // Phase 10
import type { PackResourceDefinition }      from '@lados/pack-sdk';

// -- Node-level manifests (NodeManifestV2) — Phase 1G ----------------------------
import type { NodeManifestV2 }                            from '@lados/node-sdk';
import { nodeManifests as coreNodeManifests }             from '@lados/core-pack';
import { nodeManifests as foundationNodeManifests }       from '@lados/foundation-pack';
import { nodeManifests as contractorNodeManifests }       from '@lados/contractor-pack';
import { nodeManifests as qsNodeManifests }               from '@lados/qs-pack';
import { nodeManifests as documentNodeManifests }         from '@lados/document-pack';
import { nodeManifests as procurementNodeManifests }      from '@lados/procurement-pack';
import { nodeManifests as constructionNodeManifests }     from '@lados/construction-pack';     // Phase 7
import { nodeManifests as financeNodeManifests }         from '@lados/finance-pack';            // Phase 9
import { nodeManifests as notificationsNodeManifests }   from '@lados/notifications-pack';      // Phase 10

// -- Known node-type prefixes per compiled pack ------------------------------------
//
// Used for startup health check without requiring full service injection.
// A node type is "resolvable" if its prefix matches the pack's known namespace.

const PACK_PREFIXES: Record<string, string[]> = {
  'lados.core-pack':          ['core.', 'resource.', 'event.', 'state.', 'artifact.', 'control.', 'trigger.', 'http.', 'delay.', 'notification.', 'workflow.', 'project.'],  // 'workflow.' kept for backward-compat alias
  'lados.foundation-pack':    ['foundation.'],
  'lados.contractor-pack':    ['contractor.'],
  'lados.qs-pack':            ['qs.'],
  'lados.document-pack':      ['document.'],
  'lados.procurement-pack':   ['procurement.'],
  'lados.construction-pack':  ['construction.'],  // Phase 7
  'lados.finance-pack':         ['finance.'],          // Phase 9
  'lados.notifications-pack':  ['notification.send_email', 'notification.send_sms', 'notification.send_in_app'],  // Phase 10
};

// -- In-memory manifest map -------------------------------------------------------

const MANIFEST_MAP: Record<string, { resources?: PackResourceDefinition[] }> = {
  'lados.core-pack':         coreManifest,
  'lados.foundation-pack':   foundationManifest,
  'lados.contractor-pack':   contractorManifest,
  'lados.qs-pack':           qsManifest,
  'lados.document-pack':     documentManifest,
  'lados.procurement-pack':  procurementManifest,
  'lados.construction-pack': constructionManifest,  // Phase 7
  'lados.finance-pack':         financeManifest,         // Phase 9
  'lados.notifications-pack':  notificationsManifest,   // Phase 10
};

// -- Node manifest registry (Phase 1G) --------------------------------------------
//
// Maps manifest.packId (short form in pack source) to DB packs.id (lados. prefixed).
// All packs now use short-form packId in their manifests (e.g. 'contractor-pack', 'core-pack').

const MANIFEST_TO_DB_PACK_ID: Record<string, string> = {
  'core-pack':              'lados.core-pack',
  'foundation-pack':        'lados.foundation-pack',
  'qs-pack':                'lados.qs-pack',
  'document-pack':          'lados.document-pack',
  'procurement-pack':       'lados.procurement-pack',
  'contractor-pack':        'lados.contractor-pack',
  'construction-pack':      'lados.construction-pack',  // Phase 7
  'finance-pack':           'lados.finance-pack',          // Phase 9
  'notifications-pack':     'lados.notifications-pack',   // Phase 10
};

const CATEGORY_COLOR: Record<string, string> = {
  core:         '#6B7280',
  resource:     '#8B5CF6',
  event:        '#EAB308',
  document:     '#F59E0B',
  ai:           '#10B981',
  procurement:  '#3B82F6',
  qs:           '#6366F1',
  fleet:        '#F59E0B',
  finance:      '#059669',
  integration:  '#8B5CF6',
  notification: '#6366F1',
  scheduler:    '#6B7280',
  utility:      '#9CA3AF',
  construction: '#F97316',  // Phase 7 — orange
};

const ALL_NODE_MANIFESTS: NodeManifestV2[] = [
  ...coreNodeManifests,
  ...foundationNodeManifests,
  ...qsNodeManifests,
  ...documentNodeManifests,
  ...procurementNodeManifests,
  ...contractorNodeManifests,
  ...constructionNodeManifests,  // Phase 7
  ...financeNodeManifests,          // Phase 9
  ...notificationsNodeManifests,    // Phase 10
];

// -- Compiled pack registry -------------------------------------------------------

interface CompiledPackEntry {
  dbId:          string;
  version:       string;
  displayName:   string;
  description:   string;
  author:        string;
  icon?:         string;
  color?:        string;
  isOfficial:    boolean;
  dependencies:  string[];
  installedFrom: string;
}

const COMPILED_PACKS: CompiledPackEntry[] = [
  {
    dbId:          'lados.core-pack',
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
    dbId:          'lados.qs-pack',
    version:       qsManifest.version,
    displayName:   qsManifest.displayName,
    description:   qsManifest.description ?? 'Quantity Surveying - BOQ reading, trade classification, cost plans',
    author:        qsManifest.author ?? 'Lados Platform',
    icon:          'bar-chart-2',
    color:         '#6366F1',
    isOfficial:    true,
    dependencies:  ['lados.foundation-pack'],
    installedFrom: 'startup-sync',
  },
  {
    dbId:          'lados.document-pack',
    version:       documentManifest.version,
    displayName:   documentManifest.displayName,
    description:   documentManifest.description ?? 'Document business capabilities - Excel reading, file upload',
    author:        documentManifest.author ?? 'Lados Platform',
    icon:          'file-text',
    color:         '#F59E0B',
    isOfficial:    true,
    dependencies:  ['lados.foundation-pack'],
    installedFrom: 'startup-sync',
  },
  {
    dbId:          'lados.procurement-pack',
    version:       procurementManifest.version,
    displayName:   procurementManifest.displayName,
    description:   procurementManifest.description ?? 'Procurement capabilities - RFQ generation, Purchase Orders',
    author:        procurementManifest.author ?? 'Lados Platform',
    icon:          'shopping-cart',
    color:         '#3B82F6',
    isOfficial:    true,
    dependencies:  ['lados.foundation-pack'],
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
  // Phase 7 — Construction Pack
  {
    dbId:          'lados.construction-pack',
    version:       constructionManifest.version,
    displayName:   constructionManifest.displayName,
    description:   constructionManifest.description ?? 'Construction domain nodes — Projects, Claims, Variations, Defects, BOQ, Inspections',
    author:        constructionManifest.author ?? 'Lados Platform',
    icon:          'hard-hat',
    color:         '#F97316',
    isOfficial:    true,
    dependencies:  ['lados.foundation-pack'],
    installedFrom: 'startup-sync',
  },
  // Phase 9 — Finance Pack
  {
    dbId:          'lados.finance-pack',
    version:       financeManifest.version,
    displayName:   financeManifest.displayName,
    description:   financeManifest.description ?? 'Finance domain nodes — Invoice, Purchase Orders, Retention Release for CIPAA / PAM / JKR contracts',
    author:        financeManifest.author ?? 'Lados Platform',
    icon:          'banknote',
    color:         '#059669',
    isOfficial:    true,
    dependencies:  ['lados.foundation-pack', 'lados.construction-pack'],
    installedFrom: 'startup-sync',
  },
  // Phase 10 — Notifications Pack
  {
    dbId:          'lados.notifications-pack',
    version:       notificationsManifest.version,
    displayName:   notificationsManifest.displayName,
    description:   notificationsManifest.description ?? 'Notification channel nodes — email, SMS, and in-app notifications',
    author:        notificationsManifest.author ?? 'Lados Platform',
    icon:          'bell',
    color:         '#6366F1',
    isOfficial:    true,
    dependencies:  [],
    installedFrom: 'startup-sync',
  },
];

// -- Service ----------------------------------------------------------------------

@Injectable()
export class PackInstallerService implements OnModuleInit {
  private readonly logger = new Logger(PackInstallerService.name);

  constructor(
    private readonly supabase:  SupabaseService,
    private readonly registry:  PackRegistryService,
  ) {}

  // -- Lifecycle -----------------------------------------------------------------

  async onModuleInit(): Promise<void> {
    this.logger.log('PackInstaller: syncing compiled packs on startup...');
    try {
      const result = await this.syncAll();
      this.logger.log(
        `PackInstaller: sync complete - synced: [${result.synced.join(', ')}] ` +
        `skipped: [${result.skipped.join(', ')}] errors: [${result.errors.join(', ')}]`,
      );
    } catch (err) {
      this.logger.error(`PackInstaller: startup sync failed - ${String(err)}`);
    }

    // Phase 14 - startup health check (non-blocking)
    void this.healthCheckAll();
  }

  // -- Sync ----------------------------------------------------------------------

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
        this.logger.error(`PackInstaller: failed to sync ${entry.dbId} - ${String(err)}`);
        result.errors.push(entry.dbId);
      }
    }

    // Phase 1G - sync all NodeManifestV2 declarations to registered_nodes
    try {
      const nodeResult = await this.syncNodeManifests();
      this.logger.log(
        `PackInstaller: node manifests synced - upserted: ${nodeResult.upserted}` +
        (nodeResult.errors.length ? ` errors: [${nodeResult.errors.join(', ')}]` : ''),
      );
      if (nodeResult.errors.length) {
        result.errors.push(...nodeResult.errors.map((e) => `node:${e}`));
      }
    } catch (err) {
      this.logger.error(`PackInstaller: node manifest sync failed - ${String(err)}`);
      result.errors.push('node-manifest-sync');
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

  // -- Node manifest sync (Phase 1G) -----------------------------------------------

  /**
   * Upserts all NodeManifestV2 declarations from compiled packs into registered_nodes.
   * Makes code the single source of truth - eliminates per-node SQL seed migrations.
   * Safe to re-run on every startup (idempotent upsert on primary key 'type').
   * Requires all pack rows to already exist in packs table (syncAll runs first).
   */
  async syncNodeManifests(): Promise<{ upserted: number; errors: string[] }> {
    const errors: string[] = [];
    let upserted = 0;

    for (const manifest of ALL_NODE_MANIFESTS) {
      try {
        const dbPackId = MANIFEST_TO_DB_PACK_ID[manifest.packId];
        if (!dbPackId) {
          errors.push(`${manifest.type}: unknown packId '${manifest.packId}'`);
          continue;
        }

        const { error } = await this.supabase.admin
          .from('registered_nodes')
          .upsert(
            {
              type:           manifest.type,
              pack_id:        dbPackId,
              name:           manifest.name,
              description:    manifest.description,
              version:        manifest.version,
              category:       manifest.category,
              tags:           manifest.tags ?? [],
              inputs:         manifest.inputs,
              outputs:        manifest.outputs,
              config_schema:  manifest.config,
              ui_schema:      {},
              is_enabled:     true,
              icon:           (manifest as NodeManifestV2 & { icon?: string }).icon ?? null,
              uses_services:  (manifest as NodeManifestV2 & { uses_services?: string[] }).uses_services ?? [],
              data_pack_deps: (manifest as NodeManifestV2 & { data_pack_deps?: string[] }).data_pack_deps ?? [],
              color:          CATEGORY_COLOR[manifest.category] ?? '#6B7280',
              updated_at:     new Date().toISOString(),
            },
            { onConflict: 'type' },
          );

        if (error) {
          errors.push(`${manifest.type}: ${error.message}`);
        } else {
          upserted++;
        }
      } catch (err) {
        errors.push(`${manifest.type}: ${String(err)}`);
      }
    }

    return { upserted, errors };
  }

  // -- Enable / Disable ----------------------------------------------------------

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

  // -- Health check (Phase 14) ---------------------------------------------------

  /**
   * Run a startup health check for all active packs.
   * Uses prefix-matching to verify each registered node type belongs to its pack.
   * Logs broken nodes as WARN - does NOT block startup.
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
          this.logger.log(`[HealthCheck] ${packId} - OK ${health.totalNodes} nodes healthy`);
        } else if (health.status === 'degraded') {
          this.logger.warn(
            `[HealthCheck] ${packId} - WARN ${health.brokenNodes.length}/${health.totalNodes} nodes unrecognised: ` +
            health.brokenNodes.map((n) => n.nodeType).join(', '),
          );
        } else {
          this.logger.warn(`[HealthCheck] ${packId} - ERR no registered nodes`);
        }
      } catch (err) {
        this.logger.warn(`[HealthCheck] ${packId} - error: ${String(err)}`);
      }
    }
  }

  /**
   * Prefix-based health check: a node is "resolvable" if its type starts with
   * one of the known prefixes for its pack.
   */
  async getPackHealthByPrefix(packId: string): Promise<PackHealth> {
    const nodes = await this.registry.getPackNodes(packId);
    const prefixes = PACK_PREFIXES[packId] ?? [];

    const brokenNodes = nodes
      .filter((n) => {
        const nodeType = n['type'] as string;
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
      checkedAt:  new Date().toISOString(),
      totalNodes: nodes.length,
      brokenNodes,
    };
  }

  // -- Resource view registry ----------------------------------------------------

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
