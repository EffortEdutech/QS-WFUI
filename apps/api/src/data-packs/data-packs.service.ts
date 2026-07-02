import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { SecurityEngineService } from '../security/security.service';
import type { QSWorkflowDefinition } from '@lados/shared-types';

type JsonRecord = Record<string, unknown>;

interface DataPackRow {
  id: string;
  slug: string;
  display_name: string;
  description: string | null;
  version: string;
  provider?: string | null;
  publisher?: string | null;
  region: string | null;
  domain?: string | null;
  category?: string | null;
  is_official: boolean;
  is_enabled: boolean;
  status?: string | null;
  icon?: string | null;
  metadata?: JsonRecord | null;
}

interface DataPackVersionRow {
  id: string;
  data_pack_id: string;
  version: string;
  source_summary: string | null;
  effective_from: string | null;
  effective_to: string | null;
  region: string | null;
  currency: string | null;
  unit_system: string | null;
  checksum: string | null;
  manifest_json: JsonRecord;
  published_at: string;
}

interface DataPackCollectionRow {
  id: string;
  version_id: string;
  key: string;
  display_name: string;
  description: string | null;
  schema_json: JsonRecord;
  item_count: number;
}

interface DataPackItemRow {
  id: string;
  collection_id: string;
  item_key: string;
  title: string;
  description: string | null;
  unit: string | null;
  value_json: JsonRecord;
  tags: string[];
  source_name: string;
  source_url: string | null;
  source_date: string | null;
  region: string | null;
  effective_from: string | null;
  effective_to: string | null;
  classification: string | null;
  applicability_notes: string | null;
  assumptions: string | null;
  advisory_status: string;
}

interface InstallRow {
  id: string;
  organization_id: string;
  data_pack_id: string;
  version_id: string;
  installed_by: string | null;
  status: string;
  installed_at: string;
  updated_at: string;
}

export interface DataPackRuntimeUsage {
  itemId: string;
  itemKey: string;
  title: string;
  unit: string | null;
  packSlug: string;
  packName: string;
  version: string;
  collectionKey: string;
  collectionName: string;
  sourceName: string;
  sourceUrl: string | null;
  sourceDate: string | null;
  region: string | null;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  classification: string | null;
  advisoryStatus: string;
  applicabilityNotes: string | null;
  assumptions: string | null;
}

@Injectable()
export class DataPacksService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly security: SecurityEngineService,
  ) {}

  async listDataPacks(userId: string, organizationId?: string) {
    if (organizationId) await this.security.requireMembership(userId, organizationId);

    const { data, error } = await this.supabase.admin
      .from('data_packs')
      .select('*')
      .eq('is_enabled', true)
      .order('is_official', { ascending: false })
      .order('display_name', { ascending: true });

    if (error) throw new Error(error.message);

    const packs = (data ?? []) as DataPackRow[];
    const installMap = organizationId
      ? await this.getInstallMap(organizationId)
      : new Map<string, InstallRow>();

    return packs.map((pack) => this.packSummary(pack, installMap.get(pack.id)));
  }

  async getDataPack(slug: string, userId: string, organizationId?: string) {
    if (organizationId) await this.security.requireMembership(userId, organizationId);

    const pack = await this.findPackBySlug(slug);
    const versions = await this.listVersions(pack.id);
    const latest = this.pickLatestVersion(versions);
    const install = organizationId ? (await this.getInstallMap(organizationId)).get(pack.id) : undefined;
    const collections = latest ? await this.listCollections(latest.id) : [];

    return {
      ...this.packSummary(pack, install),
      versions: versions.map((version) => this.versionSummary(version)),
      latestVersion: latest ? this.versionSummary(latest) : null,
      collections: collections.map((collection) => this.collectionSummary(collection)),
    };
  }

  async getVersion(slug: string, version: string, userId: string, organizationId?: string) {
    if (organizationId) await this.security.requireMembership(userId, organizationId);

    const pack = await this.findPackBySlug(slug);
    const versionRow = await this.findVersion(pack.id, version);
    const collections = await this.listCollections(versionRow.id);
    const collectionIds = collections.map((collection) => collection.id);
    const items = collectionIds.length > 0 ? await this.listItemsForCollections(collectionIds, 250) : [];

    return {
      pack: this.packSummary(pack),
      version: this.versionSummary(versionRow),
      collections: collections.map((collection) => ({
        ...this.collectionSummary(collection),
        items: items
          .filter((item) => item.collection_id === collection.id)
          .map((item) => this.itemSummary(item, collection, versionRow, pack)),
      })),
    };
  }

  async installDataPack(slug: string, organizationId: string, userId: string, version?: string) {
    if (!organizationId) throw new BadRequestException('organizationId query param is required');
    await this.security.requirePermission(userId, organizationId, 'data_pack.manage');

    const pack = await this.findPackBySlug(slug);
    const versionRow = version
      ? await this.findVersion(pack.id, version)
      : this.pickLatestVersion(await this.listVersions(pack.id));

    if (!versionRow) throw new NotFoundException(`No version found for Data Pack ${slug}`);

    const { data, error } = await this.supabase.admin
      .from('org_data_pack_installs')
      .upsert(
        {
          organization_id: organizationId,
          data_pack_id: pack.id,
          version_id: versionRow.id,
          installed_by: userId,
          status: 'active',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,data_pack_id' },
      )
      .select('*')
      .single();

    if (error ?? !data) throw new Error(error?.message ?? 'Failed to install Data Pack');

    return {
      ...this.packSummary(pack, data as InstallRow),
      installedVersion: this.versionSummary(versionRow),
    };
  }

  async uninstallDataPack(slug: string, organizationId: string, userId: string) {
    if (!organizationId) throw new BadRequestException('organizationId query param is required');
    await this.security.requirePermission(userId, organizationId, 'data_pack.manage');

    const pack = await this.findPackBySlug(slug);
    const { data, error } = await this.supabase.admin
      .from('org_data_pack_installs')
      .update({ status: 'disabled', updated_at: new Date().toISOString() })
      .eq('organization_id', organizationId)
      .eq('data_pack_id', pack.id)
      .select('*')
      .maybeSingle();

    if (error) throw new Error(error.message);
    return { ...this.packSummary(pack, data as InstallRow | undefined), installed: false };
  }

  async listInstalledDataPacks(organizationId: string, userId: string) {
    if (!organizationId) throw new BadRequestException('organizationId query param is required');
    await this.security.requireMembership(userId, organizationId);

    const installs = await this.listInstalls(organizationId, true);
    if (installs.length === 0) return [];

    const packIds = installs.map((install) => install.data_pack_id);
    const versionIds = installs.map((install) => install.version_id);
    const [packs, versions] = await Promise.all([
      this.findPacksByIds(packIds),
      this.findVersionsByIds(versionIds),
    ]);

    return installs.map((install) => {
      const pack = packs.find((item) => item.id === install.data_pack_id);
      const version = versions.find((item) => item.id === install.version_id);
      if (!pack) return null;
      return {
        ...this.packSummary(pack, install),
        installedVersion: version ? this.versionSummary(version) : null,
      };
    }).filter(Boolean);
  }

  async searchItems(params: {
    organizationId: string;
    userId: string;
    q?: string;
    collection?: string;
    packSlug?: string;
    region?: string;
    tag?: string;
    limit?: number;
  }) {
    const { organizationId, userId } = params;
    if (!organizationId) throw new BadRequestException('organizationId query param is required');
    await this.security.requireMembership(userId, organizationId);

    const installs = await this.listInstalls(organizationId, true);
    if (installs.length === 0) return [];

    const packIds = installs.map((install) => install.data_pack_id);
    const versionIds = installs.map((install) => install.version_id);
    const [packs, versions, collections] = await Promise.all([
      this.findPacksByIds(packIds),
      this.findVersionsByIds(versionIds),
      this.listCollectionsForVersions(versionIds),
    ]);

    const allowedPackIds = params.packSlug
      ? new Set(packs.filter((pack) => pack.slug === params.packSlug).map((pack) => pack.id))
      : new Set(packIds);
    const allowedVersionIds = versions
      .filter((version) => allowedPackIds.has(version.data_pack_id))
      .map((version) => version.id);
    const collectionIds = collections
      .filter((collection) => allowedVersionIds.includes(collection.version_id))
      .filter((collection) => !params.collection || collection.key === params.collection)
      .map((collection) => collection.id);

    if (collectionIds.length === 0) return [];

    let query = this.supabase.admin
      .from('data_pack_items')
      .select('*')
      .in('collection_id', collectionIds)
      .order('title', { ascending: true })
      .limit(Math.min(Math.max(params.limit ?? 50, 1), 100));

    if (params.q?.trim()) {
      const q = params.q.trim().replace(/[%(),]/g, '');
      query = query.or(`title.ilike.%${q}%,description.ilike.%${q}%,item_key.ilike.%${q}%`);
    }
    if (params.region?.trim()) query = query.eq('region', params.region.trim());
    if (params.tag?.trim()) query = query.contains('tags', [params.tag.trim()]);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return ((data ?? []) as DataPackItemRow[]).map((item) => {
      const collection = collections.find((entry) => entry.id === item.collection_id);
      const version = collection ? versions.find((entry) => entry.id === collection.version_id) : undefined;
      const pack = version ? packs.find((entry) => entry.id === version.data_pack_id) : undefined;
      return this.itemSummary(item, collection, version, pack);
    });
  }

  async getItem(itemId: string, userId: string, organizationId?: string) {
    const { data, error } = await this.supabase.admin
      .from('data_pack_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (error ?? !data) throw new NotFoundException(`Data Pack item ${itemId} not found`);

    const item = data as DataPackItemRow;
    const collection = await this.findCollection(item.collection_id);
    const version = await this.findVersionById(collection.version_id);
    const pack = await this.findPackById(version.data_pack_id);

    if (organizationId) {
      await this.security.requireMembership(userId, organizationId);
      const installs = await this.listInstalls(organizationId, true);
      if (!installs.some((install) => install.data_pack_id === pack.id && install.version_id === version.id)) {
        throw new NotFoundException('Data Pack item is not installed for this organization');
      }
    }

    return this.itemSummary(item, collection, version, pack, true);
  }

  async resolveRuntimeUsagesForDefinition(
    definition: QSWorkflowDefinition,
  ): Promise<Map<string, DataPackRuntimeUsage[]>> {
    const nodeItemIds = new Map<string, string[]>();
    const allIds = new Set<string>();

    for (const node of definition.nodes ?? []) {
      const ids = this.extractUuidStrings((node.config ?? {}) as Record<string, unknown>);
      if (ids.length === 0) continue;
      nodeItemIds.set(node.id as string, ids);
      ids.forEach((id) => allIds.add(id));
    }

    if (allIds.size === 0) return new Map();

    const usages = await this.resolveRuntimeUsages([...allIds]);
    const usageById = new Map(usages.map((usage) => [usage.itemId, usage]));

    const byNode = new Map<string, DataPackRuntimeUsage[]>();
    for (const [nodeId, ids] of nodeItemIds.entries()) {
      const nodeUsages = ids
        .map((id) => usageById.get(id))
        .filter((usage): usage is DataPackRuntimeUsage => Boolean(usage));
      if (nodeUsages.length > 0) byNode.set(nodeId, nodeUsages);
    }
    return byNode;
  }

  private extractUuidStrings(value: unknown): string[] {
    const seen = new Set<string>();
    const visit = (candidate: unknown) => {
      if (typeof candidate === 'string' && this.looksLikeUuid(candidate)) {
        seen.add(candidate);
        return;
      }
      if (Array.isArray(candidate)) {
        candidate.forEach(visit);
        return;
      }
      if (candidate && typeof candidate === 'object') {
        Object.values(candidate as Record<string, unknown>).forEach(visit);
      }
    };
    visit(value);
    return [...seen];
  }

  private looksLikeUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
  }

  private async resolveRuntimeUsages(itemIds: string[]): Promise<DataPackRuntimeUsage[]> {
    if (itemIds.length === 0) return [];

    const { data: items, error } = await this.supabase.admin
      .from('data_pack_items')
      .select('*')
      .in('id', itemIds);
    if (error) throw new Error(error.message);

    const itemRows = (items ?? []) as DataPackItemRow[];
    if (itemRows.length === 0) return [];

    const collections = await Promise.all(
      [...new Set(itemRows.map((item) => item.collection_id))]
        .map((collectionId) => this.findCollection(collectionId)),
    );
    const versions = await Promise.all(
      [...new Set(collections.map((collection) => collection.version_id))]
        .map((versionId) => this.findVersionById(versionId)),
    );
    const packs = await Promise.all(
      [...new Set(versions.map((version) => version.data_pack_id))]
        .map((packId) => this.findPackById(packId)),
    );

    return itemRows.map((item) => {
      const collection = collections.find((entry) => entry.id === item.collection_id);
      const version = collection ? versions.find((entry) => entry.id === collection.version_id) : undefined;
      const pack = version ? packs.find((entry) => entry.id === version.data_pack_id) : undefined;

      return {
        itemId: item.id,
        itemKey: item.item_key,
        title: item.title,
        unit: item.unit,
        packSlug: pack?.slug ?? 'unknown',
        packName: pack?.display_name ?? 'Unknown Data Pack',
        version: version?.version ?? 'unknown',
        collectionKey: collection?.key ?? 'unknown',
        collectionName: collection?.display_name ?? 'Unknown Collection',
        sourceName: item.source_name,
        sourceUrl: item.source_url,
        sourceDate: item.source_date,
        region: item.region,
        effectiveFrom: item.effective_from,
        effectiveTo: item.effective_to,
        classification: item.classification,
        advisoryStatus: item.advisory_status,
        applicabilityNotes: item.applicability_notes,
        assumptions: item.assumptions,
      };
    });
  }

  private async findPackBySlug(slug: string): Promise<DataPackRow> {
    const { data, error } = await this.supabase.admin
      .from('data_packs')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new NotFoundException(`Data Pack ${slug} not found`);
    return data as DataPackRow;
  }

  private async findPackById(id: string): Promise<DataPackRow> {
    const { data, error } = await this.supabase.admin.from('data_packs').select('*').eq('id', id).single();
    if (error ?? !data) throw new NotFoundException(`Data Pack ${id} not found`);
    return data as DataPackRow;
  }

  private async findPacksByIds(ids: string[]): Promise<DataPackRow[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.supabase.admin.from('data_packs').select('*').in('id', ids);
    if (error) throw new Error(error.message);
    return (data ?? []) as DataPackRow[];
  }

  private async listVersions(packId: string): Promise<DataPackVersionRow[]> {
    const { data, error } = await this.supabase.admin
      .from('data_pack_versions')
      .select('*')
      .eq('data_pack_id', packId)
      .order('published_at', { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as DataPackVersionRow[];
  }

  private async findVersion(packId: string, version: string): Promise<DataPackVersionRow> {
    const { data, error } = await this.supabase.admin
      .from('data_pack_versions')
      .select('*')
      .eq('data_pack_id', packId)
      .eq('version', version)
      .single();
    if (error ?? !data) throw new NotFoundException(`Data Pack version ${version} not found`);
    return data as DataPackVersionRow;
  }

  private async findVersionById(id: string): Promise<DataPackVersionRow> {
    const { data, error } = await this.supabase.admin.from('data_pack_versions').select('*').eq('id', id).single();
    if (error ?? !data) throw new NotFoundException(`Data Pack version ${id} not found`);
    return data as DataPackVersionRow;
  }

  private async findVersionsByIds(ids: string[]): Promise<DataPackVersionRow[]> {
    if (ids.length === 0) return [];
    const { data, error } = await this.supabase.admin.from('data_pack_versions').select('*').in('id', ids);
    if (error) throw new Error(error.message);
    return (data ?? []) as DataPackVersionRow[];
  }

  private pickLatestVersion(versions: DataPackVersionRow[]): DataPackVersionRow | null {
    return versions[0] ?? null;
  }

  private async listCollections(versionId: string): Promise<DataPackCollectionRow[]> {
    const { data, error } = await this.supabase.admin
      .from('data_pack_collections')
      .select('*')
      .eq('version_id', versionId)
      .order('display_name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as DataPackCollectionRow[];
  }

  private async listCollectionsForVersions(versionIds: string[]): Promise<DataPackCollectionRow[]> {
    if (versionIds.length === 0) return [];
    const { data, error } = await this.supabase.admin
      .from('data_pack_collections')
      .select('*')
      .in('version_id', versionIds)
      .order('display_name', { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as DataPackCollectionRow[];
  }

  private async findCollection(id: string): Promise<DataPackCollectionRow> {
    const { data, error } = await this.supabase.admin.from('data_pack_collections').select('*').eq('id', id).single();
    if (error ?? !data) throw new NotFoundException(`Data Pack collection ${id} not found`);
    return data as DataPackCollectionRow;
  }

  private async listItemsForCollections(collectionIds: string[], limit: number): Promise<DataPackItemRow[]> {
    const { data, error } = await this.supabase.admin
      .from('data_pack_items')
      .select('*')
      .in('collection_id', collectionIds)
      .order('title', { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as DataPackItemRow[];
  }

  private async listInstalls(organizationId: string, activeOnly: boolean): Promise<InstallRow[]> {
    let query = this.supabase.admin
      .from('org_data_pack_installs')
      .select('*')
      .eq('organization_id', organizationId)
      .order('installed_at', { ascending: false });
    if (activeOnly) query = query.eq('status', 'active');
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []) as InstallRow[];
  }

  private async getInstallMap(organizationId: string): Promise<Map<string, InstallRow>> {
    const installs = await this.listInstalls(organizationId, false);
    return new Map(installs.map((install) => [install.data_pack_id, install]));
  }

  private packSummary(pack: DataPackRow, install?: InstallRow) {
    const installed = install?.status === 'active';
    return {
      id: pack.id,
      slug: pack.slug,
      displayName: pack.display_name,
      description: pack.description,
      version: pack.version,
      publisher: pack.publisher ?? pack.provider ?? 'Lados',
      region: pack.region,
      domain: pack.domain ?? null,
      category: pack.category ?? null,
      isOfficial: pack.is_official,
      status: pack.status ?? 'active',
      icon: pack.icon ?? null,
      metadata: pack.metadata ?? {},
      installed,
      installStatus: install?.status ?? null,
      installedAt: install?.installed_at ?? null,
    };
  }

  private versionSummary(version: DataPackVersionRow) {
    return {
      id: version.id,
      version: version.version,
      sourceSummary: version.source_summary,
      effectiveFrom: version.effective_from,
      effectiveTo: version.effective_to,
      region: version.region,
      currency: version.currency,
      unitSystem: version.unit_system,
      checksum: version.checksum,
      manifest: version.manifest_json,
      publishedAt: version.published_at,
    };
  }

  private collectionSummary(collection: DataPackCollectionRow) {
    return {
      id: collection.id,
      key: collection.key,
      displayName: collection.display_name,
      description: collection.description,
      schema: collection.schema_json,
      itemCount: collection.item_count,
    };
  }

  private itemSummary(
    item: DataPackItemRow,
    collection?: DataPackCollectionRow,
    version?: DataPackVersionRow,
    pack?: DataPackRow,
    includeValue = false,
  ) {
    return {
      id: item.id,
      itemKey: item.item_key,
      title: item.title,
      description: item.description,
      unit: item.unit,
      value: includeValue ? item.value_json : undefined,
      tags: item.tags ?? [],
      sourceName: item.source_name,
      sourceUrl: item.source_url,
      sourceDate: item.source_date,
      region: item.region,
      effectiveFrom: item.effective_from,
      effectiveTo: item.effective_to,
      classification: item.classification,
      applicabilityNotes: item.applicability_notes,
      assumptions: item.assumptions,
      advisoryStatus: item.advisory_status,
      collection: collection ? this.collectionSummary(collection) : null,
      version: version ? this.versionSummary(version) : null,
      pack: pack ? this.packSummary(pack) : null,
    };
  }
}
