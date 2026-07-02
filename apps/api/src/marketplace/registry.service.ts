import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { SupabaseService } from '../common/supabase/supabase.service';

const BUNDLE_BUCKET = 'lados-pack-bundles';
const MAX_NODE_COUNT = 250;

interface RegistryNodeManifest {
  type: string;
  name?: string;
  description?: string;
  version?: string;
  category?: string;
  tags?: string[];
  inputs?: unknown[];
  outputs?: unknown[];
  config?: unknown[];
  config_schema?: unknown[];
  uiSchema?: Record<string, unknown>;
  ui_schema?: Record<string, unknown>;
  icon?: string;
  color?: string;
  uses_services?: string[];
  data_pack_deps?: string[];
}

interface PackBundleManifest {
  id: string;
  displayName?: string;
  display_name?: string;
  description?: string;
  author?: string;
  version: string;
  tags?: string[];
  icon?: string;
  color?: string;
  isOfficial?: boolean;
  is_official?: boolean;
  dependencies?: string[];
  nodes: RegistryNodeManifest[];
}

export interface RegistryPackListing {
  id: string;
  packId: string;
  displayName: string;
  description: string | null;
  author: string;
  version: string;
  tags: string[];
  icon: string | null;
  color: string | null;
  isOfficial: boolean;
  isVerified: boolean;
  downloads: number;
  checksum: string;
  manifest: PackBundleManifest;
  createdAt: string;
  verifiedAt: string | null;
}

export interface RegistryListOptions {
  q?: string;
  tag?: string;
  official?: boolean;
  verified?: boolean;
  page?: number;
  pageSize?: number;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readUploadBuffer(file: Express.Multer.File): Buffer {
  const maybeBuffer = (file as Express.Multer.File & { buffer?: Buffer }).buffer;
  if (Buffer.isBuffer(maybeBuffer)) return maybeBuffer;

  const maybePath = (file as Express.Multer.File & { path?: string }).path;
  if (maybePath && existsSync(maybePath)) return readFileSync(maybePath);

  throw new BadRequestException('Uploaded bundle is empty or unreadable');
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);
  for (let offset = buffer.length - 22; offset >= minOffset; offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  return -1;
}

function readManifestFromZip(buffer: Buffer): unknown {
  const eocd = findEndOfCentralDirectory(buffer);
  if (eocd < 0) {
    throw new BadRequestException('Pack bundle must be a .ladosPack zip containing manifest.json');
  }

  const entryCount = buffer.readUInt16LE(eocd + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocd + 16);
  let cursor = centralDirectoryOffset;

  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new BadRequestException('Invalid pack bundle central directory');
    }

    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const fileName = buffer
      .subarray(cursor + 46, cursor + 46 + fileNameLength)
      .toString('utf8')
      .replace(/\\/g, '/');

    if (fileName === 'manifest.json' || fileName.endsWith('/manifest.json')) {
      if (buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
        throw new BadRequestException('Invalid manifest.json local header');
      }
      const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      const manifestBytes =
        compressionMethod === 0 ? compressed :
        compressionMethod === 8 ? inflateRawSync(compressed) :
        null;

      if (!manifestBytes) {
        throw new BadRequestException('manifest.json uses an unsupported zip compression method');
      }
      return JSON.parse(manifestBytes.toString('utf8')) as unknown;
    }

    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new BadRequestException('Pack bundle is missing manifest.json');
}

function parseManifestJson(buffer: Buffer): unknown {
  try {
    return JSON.parse(buffer.toString('utf8')) as unknown;
  } catch {
    return readManifestFromZip(buffer);
  }
}

function validateManifest(raw: unknown): PackBundleManifest {
  const record = asRecord(raw);
  const id = typeof record['id'] === 'string' ? record['id'].trim() : '';
  const version = typeof record['version'] === 'string' ? record['version'].trim() : '';
  const author = typeof record['author'] === 'string' ? record['author'].trim() : 'Unknown Publisher';
  const nodes = Array.isArray(record['nodes']) ? record['nodes'] : [];

  if (!/^[a-z0-9][a-z0-9._-]*\.[a-z0-9][a-z0-9._-]*$/i.test(id)) {
    throw new BadRequestException('manifest.id must use a namespaced pack id such as vendor.invoice-pack');
  }
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw new BadRequestException('manifest.version must be semver, for example 1.0.0');
  }
  if (nodes.length === 0) throw new BadRequestException('manifest.nodes must contain at least one node');
  if (nodes.length > MAX_NODE_COUNT) {
    throw new BadRequestException(`manifest.nodes exceeds the ${MAX_NODE_COUNT} node limit`);
  }

  const normalizedNodes = nodes.map((node, index) => {
    const item = asRecord(node);
    const type = typeof item['type'] === 'string' ? item['type'].trim() : '';
    if (!/^[a-z0-9][a-z0-9._-]*\.[a-z0-9][a-z0-9._-]*$/i.test(type)) {
      throw new BadRequestException(`manifest.nodes[${index}].type must be namespaced`);
    }
    if (type === 'approval.decide') {
      throw new BadRequestException('Registry packs cannot register approval.decide');
    }
    return item as unknown as RegistryNodeManifest;
  });

  const tags = Array.isArray(record['tags'])
    ? record['tags'].filter((tag): tag is string => typeof tag === 'string').slice(0, 20)
    : [];

  return {
    id,
    version,
    author,
    displayName:
      typeof record['displayName'] === 'string' ? record['displayName'] :
      typeof record['display_name'] === 'string' ? record['display_name'] :
      id,
    description: typeof record['description'] === 'string' ? record['description'] : undefined,
    tags,
    icon: typeof record['icon'] === 'string' ? record['icon'] : undefined,
    color: typeof record['color'] === 'string' ? record['color'] : undefined,
    isOfficial: record['isOfficial'] === true || record['is_official'] === true,
    dependencies: Array.isArray(record['dependencies'])
      ? record['dependencies'].filter((dep): dep is string => typeof dep === 'string')
      : [],
    nodes: normalizedNodes,
  };
}

function mapListing(row: Record<string, unknown>): RegistryPackListing {
  return {
    id: row['id'] as string,
    packId: row['pack_id'] as string,
    displayName: row['display_name'] as string,
    description: (row['description'] as string | null) ?? null,
    author: row['author'] as string,
    version: row['version'] as string,
    tags: (row['tags'] as string[] | null) ?? [],
    icon: (row['icon'] as string | null) ?? null,
    color: (row['color'] as string | null) ?? null,
    isOfficial: row['is_official'] === true,
    isVerified: row['is_verified'] === true,
    downloads: Number(row['downloads'] ?? 0),
    checksum: row['checksum'] as string,
    manifest: row['manifest_json'] as PackBundleManifest,
    createdAt: row['created_at'] as string,
    verifiedAt: (row['verified_at'] as string | null) ?? null,
  };
}

@Injectable()
export class RegistryService {
  constructor(private readonly supabase: SupabaseService) {}

  async submitPack(file: Express.Multer.File, userId: string) {
    if (!file) throw new BadRequestException('Bundle file is required');
    if (!file.originalname.endsWith('.ladosPack')) {
      throw new BadRequestException('Bundle filename must end with .ladosPack');
    }

    const bundle = readUploadBuffer(file);
    const manifest = validateManifest(parseManifestJson(bundle));
    const checksum = createHash('sha256').update(bundle).digest('hex');
    const storagePath = `${manifest.id}/${manifest.version}/${Date.now()}_${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { data: duplicate, error: duplicateError } = await this.supabase.admin
      .from('registry_packs')
      .select('*')
      .eq('pack_id', manifest.id)
      .eq('version', manifest.version)
      .maybeSingle();

    if (duplicateError) {
      throw new BadRequestException(`Registry duplicate check failed: ${duplicateError.message}`);
    }

    if (duplicate) {
      return {
        listing: mapListing(duplicate as Record<string, unknown>),
        status: 'already_submitted',
      };
    }

    const { error: storageErr } = await this.supabase.admin.storage
      .from(BUNDLE_BUCKET)
      .upload(storagePath, bundle, {
        contentType: file.mimetype || 'application/octet-stream',
        upsert: false,
      });

    if (storageErr) throw new BadRequestException(`Storage upload failed: ${storageErr.message}`);

    const { data, error } = await this.supabase.admin
      .from('registry_packs')
      .insert({
        pack_id: manifest.id,
        display_name: manifest.displayName ?? manifest.id,
        description: manifest.description ?? null,
        author: manifest.author,
        version: manifest.version,
        tags: manifest.tags ?? [],
        icon: manifest.icon ?? null,
        color: manifest.color ?? null,
        is_official: manifest.isOfficial === true,
        is_verified: false,
        bundle_url: `${BUNDLE_BUCKET}/${storagePath}`,
        checksum,
        manifest_json: manifest,
        published_by: userId,
      })
      .select('*')
      .single();

    if (error ?? !data) {
      await this.supabase.admin.storage.from(BUNDLE_BUCKET).remove([storagePath]);
      throw new BadRequestException(`Failed to publish registry listing: ${error?.message}`);
    }

    return {
      listing: mapListing(data as Record<string, unknown>),
      status: 'pending_review',
    };
  }

  async listPacks(options: RegistryListOptions): Promise<RegistryPackListing[]> {
    const page = Math.max(1, options.page ?? 1);
    const pageSize = Math.min(50, Math.max(1, options.pageSize ?? 24));
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = this.supabase.admin
      .from('registry_packs')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (options.verified !== false) query = query.eq('is_verified', true);
    if (options.official !== undefined) query = query.eq('is_official', options.official);
    if (options.tag) query = query.contains('tags', [options.tag]);
    if (options.q) {
      const q = options.q.replace(/[%_]/g, '');
      query = query.or(`pack_id.ilike.%${q}%,display_name.ilike.%${q}%,description.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return (data ?? []).map((row) => mapListing(row as Record<string, unknown>));
  }

  async getPackVersions(packId: string): Promise<RegistryPackListing[]> {
    const { data, error } = await this.supabase.admin
      .from('registry_packs')
      .select('*')
      .eq('pack_id', packId)
      .order('created_at', { ascending: false });

    if (error) throw new BadRequestException(error.message);
    if (!data?.length) throw new NotFoundException(`Registry pack ${packId} not found`);
    return data.map((row) => mapListing(row as Record<string, unknown>));
  }

  async getPackVersion(packId: string, version: string): Promise<RegistryPackListing> {
    const { data, error } = await this.supabase.admin
      .from('registry_packs')
      .select('*')
      .eq('pack_id', packId)
      .eq('version', version)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Registry pack ${packId} v${version} not found`);
    return mapListing(data as Record<string, unknown>);
  }

  async getListing(listingId: string): Promise<RegistryPackListing> {
    const { data, error } = await this.supabase.admin
      .from('registry_packs')
      .select('*')
      .eq('id', listingId)
      .maybeSingle();

    if (error) throw new BadRequestException(error.message);
    if (!data) throw new NotFoundException(`Registry listing ${listingId} not found`);
    return mapListing(data as Record<string, unknown>);
  }

  async verifyListing(listingId: string, approved: boolean, userId: string, note?: string) {
    const { data, error } = await this.supabase.admin
      .from('registry_packs')
      .update({
        is_verified: approved,
        verified_by: approved ? userId : null,
        verified_at: approved ? new Date().toISOString() : null,
        deprecation_note: note ?? null,
      })
      .eq('id', listingId)
      .select('*')
      .single();

    if (error ?? !data) throw new BadRequestException(`Failed to verify listing: ${error?.message}`);
    return mapListing(data as Record<string, unknown>);
  }

  async installListing(listingId: string) {
    const listing = await this.getListing(listingId);
    if (!listing.isVerified) {
      throw new BadRequestException('Only verified registry packs can be installed');
    }

    const { data: existing } = await this.supabase.admin
      .from('packs')
      .select('version')
      .eq('id', listing.packId)
      .maybeSingle();

    const manifest = listing.manifest;
    const { error: packError } = await this.supabase.admin
      .from('packs')
      .upsert({
        id: listing.packId,
        display_name: listing.displayName,
        description: listing.description,
        author: listing.author,
        version: listing.version,
        previous_version: existing ? existing['version'] as string : null,
        icon: listing.icon,
        color: listing.color,
        is_official: listing.isOfficial,
        is_enabled: true,
        status: 'active',
        dependencies: manifest.dependencies ?? [],
        installed_from: 'registry',
        checksum: listing.checksum,
        installed_at: existing ? undefined : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (packError) throw new BadRequestException(packError.message);

    const nodeRows = manifest.nodes.map((node) => ({
      type: node.type,
      pack_id: listing.packId,
      name: node.name ?? node.type,
      description: node.description ?? `Registry node from ${listing.displayName}`,
      version: node.version ?? listing.version,
      category: node.category ?? 'registry',
      tags: node.tags ?? listing.tags,
      inputs: node.inputs ?? [],
      outputs: node.outputs ?? [],
      config_schema: node.config ?? node.config_schema ?? [],
      ui_schema: node.uiSchema ?? node.ui_schema ?? {},
      is_enabled: true,
      icon: node.icon ?? listing.icon,
      uses_services: node.uses_services ?? [],
      data_pack_deps: node.data_pack_deps ?? [],
      color: node.color ?? listing.color ?? '#64748B',
      updated_at: new Date().toISOString(),
    }));

    const { error: nodesError } = await this.supabase.admin
      .from('registered_nodes')
      .upsert(nodeRows, { onConflict: 'type' });

    if (nodesError) throw new BadRequestException(nodesError.message);

    await this.supabase.admin
      .from('registry_packs')
      .update({ downloads: listing.downloads + 1 })
      .eq('id', listing.id);

    return {
      packId: listing.packId,
      version: listing.version,
      nodeCount: nodeRows.length,
      status: 'installed',
    };
  }
}
