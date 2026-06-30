import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService }       from '../common/supabase/supabase.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { NodeRegistryService }   from '../node-registry/node-registry.service';

@Injectable()
export class OrganizationService {
  private readonly logger = new Logger(OrganizationService.name);

  constructor(
    private readonly supabase:     SupabaseService,
    private readonly nodeRegistry: NodeRegistryService,  // Phase 1H
  ) {}

  /** List all organizations the user is a member of */
  async findAllForUser(userId: string) {
    const { data, error } = await this.supabase.admin
      .from('organization_members')
      .select('role, joined_at, organizations(*)')
      .eq('user_id', userId);

    if (error) throw new Error(error.message);

    return (data ?? []).map((row) => ({
      ...(row.organizations as unknown as Record<string, unknown>),
      membership: { role: row.role, joinedAt: row.joined_at },
    }));
  }

  /** Get a single organization -- only if user is a member */
  async findOne(id: string, userId: string) {
    const { data, error } = await this.supabase.admin
      .from('organization_members')
      .select('role, joined_at, organizations(*)')
      .eq('user_id', userId)
      .eq('organization_id', id)
      .single();

    if (error ?? !data) {
      throw new NotFoundException(`Organization ${id} not found or access denied`);
    }

    return {
      ...(data.organizations as unknown as Record<string, unknown>),
      membership: { role: data.role, joinedAt: data.joined_at },
    };
  }

  /** Create an organization and add the creator as owner */
  async create(dto: CreateOrganizationDto, userId: string) {
    // Check slug uniqueness
    const { data: existing } = await this.supabase.admin
      .from('organizations')
      .select('id')
      .eq('slug', dto.slug)
      .maybeSingle();

    if (existing) {
      throw new ConflictException(`Slug "${dto.slug}" is already taken`);
    }

    const { data: org, error: orgError } = await this.supabase.admin
      .from('organizations')
      .insert({ name: dto.name, slug: dto.slug, logo_url: dto.logoUrl ?? null })
      .select()
      .single();

    if (orgError ?? !org) throw new Error(orgError?.message ?? 'Failed to create organization');

    // Add creator as owner
    const { error: memberError } = await this.supabase.admin
      .from('organization_members')
      .insert({ organization_id: org.id, user_id: userId, role: 'owner' });

    if (memberError) throw new Error(memberError.message);

    // Phase 1H -- ensure Foundation Pack node manifests are seeded for this org
    // (non-blocking: PackInstallerService.onModuleInit() seeds globally on startup,
    //  but this guard handles cold-start races on first-ever org creation)
    void this.nodeRegistry.seedForOrg(org.id).catch((err) => {
      this.logger.warn(`seedForOrg failed for org ${org.id}: ${String(err)}`);
    });

    return org;
  }

  /** Update an organization -- caller must be owner or admin */
  async update(id: string, dto: UpdateOrganizationDto, userId: string) {
    await this.assertRole(id, userId, ['owner', 'admin']);

    const updates: Record<string, unknown> = {};
    if (dto.name !== undefined) updates['name'] = dto.name;
    if (dto.logoUrl !== undefined) updates['logo_url'] = dto.logoUrl;

    const { data, error } = await this.supabase.admin
      .from('organizations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error ?? !data) throw new Error(error?.message ?? 'Update failed');
    return data;
  }

  // -- Helpers --

  private async assertRole(orgId: string, userId: string, roles: string[]) {
    const { data } = await this.supabase.admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!data) throw new NotFoundException('Organization not found or access denied');
    if (!roles.includes(data.role as string)) {
      throw new ForbiddenException(`Requires role: ${roles.join(' or ')}`);
    }
  }
}
