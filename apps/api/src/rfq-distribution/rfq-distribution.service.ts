/**
 * RfqDistributionService
 *
 * Tracks RFQ documents sent to individual suppliers.
 * Sprint 17 (S17-004)
 */
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { SecurityEngineService, OrgRole } from '../security/security.service';
import type {
  CreateRfqDistributionsDto,
  UpdateRfqDistributionDto,
} from './dto/create-rfq-distribution.dto';

@Injectable()
export class RfqDistributionService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly security: SecurityEngineService,
  ) {}

  /** List distributions for an org, optionally filtered by run or trade */
  async findAll(
    organizationId: string,
    userId: string,
    filters?: { run_id?: string; trade?: string; project_id?: string },
  ) {
    await this.assertMembership(organizationId, userId);

    let query = this.supabase.admin
      .from('rfq_distributions')
      .select('*, suppliers(id, name, email, phone)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (filters?.run_id)     query = query.eq('run_id', filters.run_id);
    if (filters?.trade)      query = query.eq('trade', filters.trade);
    if (filters?.project_id) query = query.eq('project_id', filters.project_id);

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  /** Bulk-create distributions from an RFQ generation run */
  async bulkCreate(
    organizationId: string,
    dto: CreateRfqDistributionsDto,
    userId: string,
  ) {
    await this.assertMembership(organizationId, userId, ['owner', 'admin', 'member']);

    const rows = dto.items.map((item) => ({
      organization_id: organizationId,
      project_id:      item.project_id ?? null,
      run_id:          item.run_id ?? null,
      trade:           item.trade,
      storage_path:    item.storage_path,
      supplier_id:     item.supplier_id,
      status:          'pending' as const,
      created_by:      userId,
    }));

    const { data, error } = await this.supabase.admin
      .from('rfq_distributions')
      .insert(rows)
      .select();

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  /** Update a single distribution (mark sent, acknowledged, etc.) */
  async update(
    id: string,
    dto: UpdateRfqDistributionDto,
    userId: string,
  ) {
    const { data: existing } = await this.supabase.admin
      .from('rfq_distributions')
      .select('organization_id')
      .eq('id', id)
      .maybeSingle();

    if (!existing) throw new NotFoundException(`Distribution ${id} not found`);
    await this.assertMembership(existing.organization_id as string, userId, ['owner', 'admin', 'member']);

    const updates: Record<string, unknown> = {};
    if (dto.status       !== undefined) updates['status']       = dto.status;
    if (dto.sent_at      !== undefined) updates['sent_at']      = dto.sent_at;
    if (dto.supplier_ref !== undefined) updates['supplier_ref'] = dto.supplier_ref;
    if (dto.notes        !== undefined) updates['notes']        = dto.notes;
    // Auto-set sent_at when marking as sent
    if (dto.status === 'sent' && !dto.sent_at) updates['sent_at'] = new Date().toISOString();

    const { data, error } = await this.supabase.admin
      .from('rfq_distributions')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  }

  // ── Private ────────────────────────────────────────────────────────────────

  /** Phase 6: delegates to SecurityEngineService — single DB call for role lookup */
  private async assertMembership(orgId: string, userId: string, roles?: OrgRole[]): Promise<void> {
    const userRole = await this.security.getRole(userId, orgId);
    if (!userRole) throw new NotFoundException('Access denied');
    if (roles && !roles.includes(userRole)) {
      throw new ForbiddenException(`Requires role: ${roles.join(' or ')}`);
    }
  }
}
