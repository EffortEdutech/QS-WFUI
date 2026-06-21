/**
 * SupplierService
 *
 * CRUD for supplier/contractor records scoped to an organization.
 * Sprint 17 (S17-002)
 *
 * Security: suppliers are scoped by organization_id; membership checked on every operation.
 */
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { SecurityEngineService, OrgRole } from '../security/security.service';
import type { CreateSupplierDto } from './dto/create-supplier.dto';
import type { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SupplierService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly security: SecurityEngineService,
  ) {}

  // ── List ───────────────────────────────────────────────────────────────────

  async findAll(
    organizationId: string,
    userId: string,
    filters?: { trade?: string; status?: string },
  ) {
    await this.assertMembership(organizationId, userId);

    let query = this.supabase.admin
      .from('suppliers')
      .select('*')
      .eq('organization_id', organizationId)
      .order('name', { ascending: true });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.trade) {
      // trades is a TEXT[] — use @> (contains) operator
      query = query.contains('trades', [filters.trade]);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  // ── Get one ────────────────────────────────────────────────────────────────

  async findOne(id: string, userId: string) {
    const { data, error } = await this.supabase.admin
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();

    if (error ?? !data) throw new NotFoundException(`Supplier ${id} not found`);
    await this.assertMembership(data.organization_id as string, userId);
    return data;
  }

  // ── Create ─────────────────────────────────────────────────────────────────

  async create(organizationId: string, dto: CreateSupplierDto, userId: string) {
    await this.assertMembership(organizationId, userId, ['owner', 'admin', 'member']);

    const { data, error } = await this.supabase.admin
      .from('suppliers')
      .insert({
        organization_id: organizationId,
        name:            dto.name,
        email:           dto.email ?? null,
        phone:           dto.phone ?? null,
        address:         dto.address ?? null,
        trades:          dto.trades ?? [],
        cidb_grade:      dto.cidb_grade ?? null,
        registration_no: dto.registration_no ?? null,
        notes:           dto.notes ?? null,
        created_by:      userId,
      })
      .select()
      .single();

    if (error ?? !data) throw new Error(error?.message ?? 'Failed to create supplier');
    return data;
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateSupplierDto, userId: string) {
    const supplier = await this.findOne(id, userId);
    await this.assertMembership(supplier.organization_id as string, userId, ['owner', 'admin', 'member']);

    const updates: Record<string, unknown> = {};
    if (dto.name            !== undefined) updates['name']            = dto.name;
    if (dto.email           !== undefined) updates['email']           = dto.email;
    if (dto.phone           !== undefined) updates['phone']           = dto.phone;
    if (dto.address         !== undefined) updates['address']         = dto.address;
    if (dto.trades          !== undefined) updates['trades']          = dto.trades;
    if (dto.cidb_grade      !== undefined) updates['cidb_grade']      = dto.cidb_grade;
    if (dto.registration_no !== undefined) updates['registration_no'] = dto.registration_no;
    if (dto.notes           !== undefined) updates['notes']           = dto.notes;
    if (dto.status          !== undefined) updates['status']          = dto.status;

    const { data, error } = await this.supabase.admin
      .from('suppliers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error ?? !data) throw new Error(error?.message ?? 'Update failed');
    return data;
  }

  // ── Soft-delete (set inactive) ─────────────────────────────────────────────

  async deactivate(id: string, userId: string) {
    const supplier = await this.findOne(id, userId);
    await this.assertMembership(supplier.organization_id as string, userId, ['owner', 'admin']);
    return this.update(id, { status: 'inactive' }, userId);
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Phase 6: delegates to SecurityEngineService — single DB call for role lookup */
  private async assertMembership(
    organizationId: string,
    userId: string,
    roles?: OrgRole[],
  ): Promise<void> {
    const userRole = await this.security.getRole(userId, organizationId);
    if (!userRole) throw new NotFoundException('Organization not found or access denied');
    if (roles && !roles.includes(userRole)) {
      throw new ForbiddenException(`Requires role: ${roles.join(' or ')}`);
    }
  }
}
