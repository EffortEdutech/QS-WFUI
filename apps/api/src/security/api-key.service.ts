/**
 * ApiKeyService — Phase 6
 *
 * Create, list, and revoke API keys for programmatic access.
 *
 * Key format:  lados_<64 hex chars>  (32 random bytes → 64 hex = 71 chars total)
 * Stored:      SHA-256 hash of the raw key (never the raw key itself)
 * Key prefix:  first 10 chars of the raw key (for identification without auth)
 *
 * The raw key is returned ONCE at creation and never stored.
 *
 * AI guardrail: This service does not grant or validate approval permissions.
 * Approval actions are constrained to owner|admin roles at the SecurityEngine layer.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { SupabaseService } from '../common/supabase/supabase.service';
import { SecurityEngineService, OrgRole } from './security.service';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateApiKeyDto {
  name: string;
  role?: OrgRole;                // default: 'member'
  scopes?: string[];             // future scope restrictions
  expiresAt?: string;            // ISO 8601, optional
}

export interface ApiKeyRecord {
  id: string;
  org_id: string;
  name: string;
  key_prefix: string;
  role: OrgRole;
  scopes: string[];
  expires_at: string | null;
  last_used_at: string | null;
  active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreatedApiKey extends ApiKeyRecord {
  /** Raw key — shown only once, never stored */
  rawKey: string;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly security: SecurityEngineService,
  ) {}

  // ── Create ─────────────────────────────────────────────────────────────────

  async create(
    orgId: string,
    actorId: string,
    dto: CreateApiKeyDto,
  ): Promise<CreatedApiKey> {
    // Only owner/admin may create API keys
    await this.security.requirePermission(actorId, orgId, 'api_key.create');

    const role: OrgRole = dto.role ?? 'member';

    // Generate key: lados_ + 32 random bytes as hex = 71 chars
    const rawBytes = randomBytes(32).toString('hex');
    const rawKey   = `lados_${rawBytes}`;
    const keyHash  = createHash('sha256').update(rawKey).digest('hex');
    const keyPrefix = rawKey.slice(0, 10);          // 'lados_xxx' (10 chars)

    const { data, error } = await this.supabase.admin
      .from('api_keys')
      .insert({
        org_id:     orgId,
        name:       dto.name,
        key_hash:   keyHash,
        key_prefix: keyPrefix,
        role,
        scopes:     dto.scopes ?? [],
        expires_at: dto.expiresAt ?? null,
        created_by: actorId,
        active:     true,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'Failed to create API key');
    }

    this.logger.log(`API key created: ${keyPrefix}*** for org ${orgId} by ${actorId}`);

    return { ...(data as ApiKeyRecord), rawKey };
  }

  // ── List ───────────────────────────────────────────────────────────────────

  async list(orgId: string, actorId: string): Promise<ApiKeyRecord[]> {
    await this.security.requirePermission(actorId, orgId, 'api_key.list');

    const { data, error } = await this.supabase.admin
      .from('api_keys')
      .select('id, org_id, name, key_prefix, role, scopes, expires_at, last_used_at, active, created_by, created_at, updated_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as ApiKeyRecord[];
  }

  // ── Revoke ─────────────────────────────────────────────────────────────────

  async revoke(keyId: string, orgId: string, actorId: string): Promise<void> {
    await this.security.requirePermission(actorId, orgId, 'api_key.revoke');

    const { data: key } = await this.supabase.admin
      .from('api_keys')
      .select('id, org_id')
      .eq('id', keyId)
      .maybeSingle();

    if (!key) throw new NotFoundException(`API key ${keyId} not found`);
    if (key['org_id'] !== orgId) throw new ForbiddenException('Key does not belong to this organisation');

    const { error } = await this.supabase.admin
      .from('api_keys')
      .update({ active: false })
      .eq('id', keyId);

    if (error) throw new Error(error.message);
    this.logger.log(`API key ${keyId} revoked by ${actorId}`);
  }

  // ── Verify (used by ApiKeyGuard) ───────────────────────────────────────────

  /**
   * Verify a raw API key (from Authorization header).
   * Returns the key record if valid, null if invalid/expired/revoked.
   * Also updates last_used_at in the background (fire-and-forget).
   */
  async verify(rawKey: string): Promise<ApiKeyRecord | null> {
    if (!rawKey.startsWith('lados_')) return null;

    const keyHash = createHash('sha256').update(rawKey).digest('hex');

    const { data } = await this.supabase.admin
      .from('api_keys')
      .select('id, org_id, name, key_prefix, role, scopes, expires_at, last_used_at, active, created_by, created_at, updated_at')
      .eq('key_hash', keyHash)
      .eq('active', true)
      .maybeSingle();

    if (!data) return null;

    const record = data as ApiKeyRecord;

    // Check expiry
    if (record.expires_at && new Date(record.expires_at) < new Date()) {
      return null;
    }

    // Update last_used_at — fire-and-forget
    void this.supabase.admin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', record.id);

    return record;
  }
}
