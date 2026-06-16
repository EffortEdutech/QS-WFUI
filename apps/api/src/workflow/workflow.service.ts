import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { validateWorkflow, WorkflowBuilder } from '@qsos/workflow-json';
import type { WorkflowId } from '@qsos/shared-types';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { SaveDefinitionDto } from './dto/save-definition.dto';

@Injectable()
export class WorkflowService {
  constructor(private readonly supabase: SupabaseService) {}

  /** List all workflows in a project */
  async findAllInProject(projectId: string, userId: string) {
    await this.assertProjectAccess(projectId, userId);

    const { data, error } = await this.supabase.admin
      .from('workflows')
      .select('id, name, description, status, version, tags, created_at, updated_at')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  /** Get one workflow with full definition */
  async findOne(id: string, userId: string) {
    const { data, error } = await this.supabase.admin
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single();

    if (error ?? !data) throw new NotFoundException(`Workflow ${id} not found`);
    await this.assertProjectAccess(data.project_id as string, userId);
    return data;
  }

  /** Create a blank workflow (Start → End) */
  async create(projectId: string, dto: CreateWorkflowDto, userId: string) {
    await this.assertProjectAccess(projectId, userId, ['owner', 'admin', 'member']);

    // Generate a temp ID — Supabase will replace with gen_random_uuid()
    const tempId = crypto.randomUUID() as WorkflowId;
    const blankDef = WorkflowBuilder.blank(dto.name, tempId);

    const { data, error } = await this.supabase.admin
      .from('workflows')
      .insert({
        project_id: projectId,
        name: dto.name,
        description: dto.description ?? null,
        tags: dto.tags ?? [],
        definition: blankDef,
        created_by: userId,
      })
      .select()
      .single();

    if (error ?? !data) throw new Error(error?.message ?? 'Failed to create workflow');

    // Audit log (S10-005) — fire-and-forget
    const { data: proj } = await this.supabase.admin
      .from('projects').select('organization_id').eq('id', projectId).maybeSingle();
    if (proj) {
      void this.supabase.admin.from('audit_log').insert({
        organization_id: proj.organization_id,
        project_id:      projectId,
        actor_id:        userId,
        event_type:      'workflow.created',
        entity_type:     'workflow',
        entity_id:       (data as { id: string }).id,
        summary:         `Workflow "${dto.name}" created`,
      });
    }

    return data;
  }

  /** Update workflow metadata (not the definition) */
  async update(id: string, dto: UpdateWorkflowDto, userId: string) {
    const workflow = await this.findOne(id, userId);
    await this.assertProjectAccess(workflow.project_id as string, userId, ['owner', 'admin', 'member']);

    const updates: Record<string, unknown> = {};
    if (dto.name !== undefined) updates['name'] = dto.name;
    if (dto.description !== undefined) updates['description'] = dto.description;
    if (dto.status !== undefined) updates['status'] = dto.status;
    if (dto.tags !== undefined) updates['tags'] = dto.tags;

    const { data, error } = await this.supabase.admin
      .from('workflows')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error ?? !data) throw new Error(error?.message ?? 'Update failed');
    return data;
  }

  /**
   * Save (overwrite) the workflow canvas definition.
   * Validates the Workflow JSON before writing.
   * Called by the canvas on every auto-save.
   */
  async saveDefinition(id: string, dto: SaveDefinitionDto, userId: string) {
    const workflow = await this.findOne(id, userId);
    await this.assertProjectAccess(workflow.project_id as string, userId, ['owner', 'admin', 'member']);

    // Validate the incoming Workflow JSON
    const result = validateWorkflow(dto.definition);
    if (!result.valid) {
      const summary = result.errors.map((e: { field: string; message: string }) => `${e.field}: ${e.message}`).join('; ');
      throw new BadRequestException(`Invalid Workflow JSON — ${summary}`);
    }

    const { data, error } = await this.supabase.admin
      .from('workflows')
      .update({ definition: dto.definition })
      .eq('id', id)
      .select('id, name, status, version, updated_at')
      .single();

    if (error ?? !data) throw new Error(error?.message ?? 'Failed to save definition');
    return data;
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private async assertProjectAccess(
    projectId: string,
    userId: string,
    roles?: string[],
  ) {
    const { data: project } = await this.supabase.admin
      .from('projects')
      .select('organization_id')
      .eq('id', projectId)
      .maybeSingle();

    if (!project) throw new NotFoundException('Project not found');

    const { data: member } = await this.supabase.admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', project.organization_id as string)
      .eq('user_id', userId)
      .maybeSingle();

    if (!member) throw new NotFoundException('Project not found or access denied');
    if (roles && !roles.includes(member.role as string)) {
      throw new ForbiddenException(`Requires role: ${roles.join(' or ')}`);
    }
  }
}
