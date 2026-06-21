import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { validateWorkflow, WorkflowBuilder } from '@lados/workflow-json';
import type { WorkflowId } from '@lados/shared-types';
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

  /**
   * Export workflow as a portable JSON bundle.
   * Sprint 16 (S16-004).
   * Returns name, description, tags, and the full definition.
   * No run history or project-specific IDs are included — safe to share.
   */
  async exportWorkflow(id: string, userId: string) {
    const workflow = await this.findOne(id, userId);
    return {
      _export_version: '1.0',
      _exported_at:    new Date().toISOString(),
      name:            workflow.name,
      description:     workflow.description ?? '',
      tags:            workflow.tags ?? [],
      definition:      workflow.definition,
    };
  }

  /**
   * Import a workflow JSON bundle into a project.
   * Sprint 16 (S16-004).
   * Creates a new workflow; never overwrites an existing one.
   */
  async importWorkflow(
    projectId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bundle: Record<string, any>,
    userId: string,
  ) {
    await this.assertProjectAccess(projectId, userId, ['owner', 'admin', 'member']);

    const name       = (bundle['name'] as string | undefined) ?? 'Imported Workflow';
    const description = bundle['description'] as string | undefined;
    const tags        = (bundle['tags'] as string[] | undefined) ?? [];
    const definition  = bundle['definition'];

    if (!definition) throw new BadRequestException('Bundle missing "definition" key');

    const result = validateWorkflow(definition);
    if (!result.valid) {
      const summary = result.errors
        .map((e: { field: string; message: string }) => `${e.field}: ${e.message}`)
        .join('; ');
      throw new BadRequestException(`Invalid Workflow JSON in bundle — ${summary}`);
    }

    const dto: CreateWorkflowDto = { name: `${name} (imported)`, description, tags };
    const created = await this.create(projectId, dto, userId);

    // Overwrite the blank definition with the imported one
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saveDto: SaveDefinitionDto = { definition } as any;
    await this.saveDefinition((created as { id: string }).id, saveDto, userId);

    return created;
  }

  // ── S18-002: Versioning ────────────────────────────────────────────────────

  /**
   * Snapshot the current definition as a new version.
   * version_number = MAX(existing) + 1, or 1 if none yet.
   */
  async snapshotVersion(workflowId: string, userId: string, label?: string) {
    const workflow = await this.findOne(workflowId, userId);
    await this.assertProjectAccess(workflow.project_id as string, userId, ['owner', 'admin', 'member']);

    // Compute next version number
    const { data: latest } = await this.supabase.admin
      .from('workflow_versions')
      .select('version_number')
      .eq('workflow_id', workflowId)
      .order('version_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextVersion = ((latest?.version_number as number | null) ?? 0) + 1;

    const { data, error } = await this.supabase.admin
      .from('workflow_versions')
      .insert({
        workflow_id:    workflowId,
        version_number: nextVersion,
        definition:     workflow.definition,
        label:          label ?? null,
        created_by:     userId,
      })
      .select()
      .single();

    if (error ?? !data) throw new Error(error?.message ?? 'Failed to create version');
    return data;
  }

  /** List all versions of a workflow, newest first */
  async listVersions(workflowId: string, userId: string) {
    const workflow = await this.findOne(workflowId, userId);
    await this.assertProjectAccess(workflow.project_id as string, userId);

    const { data, error } = await this.supabase.admin
      .from('workflow_versions')
      .select('id, version_number, label, created_by, created_at')
      .eq('workflow_id', workflowId)
      .order('version_number', { ascending: false });

    if (error) throw new Error(error.message);
    return data ?? [];
  }

  /**
   * Publish the current workflow definition.
   *
   * 1. Snapshots the live definition into workflow_versions (labelled "Published vN").
   * 2. Sets published_version_id / published_at / published_by on the workflow row.
   *
   * Executions triggered after this point will use the published snapshot, not the
   * live draft — see ExecutionService.triggerRun().
   */
  async publish(workflowId: string, userId: string) {
    const workflow = await this.findOne(workflowId, userId);
    await this.assertProjectAccess(workflow.project_id as string, userId, ['owner', 'admin', 'member']);

    if (!workflow.definition || !(workflow.definition as { nodes?: unknown[] }).nodes?.length) {
      throw new Error('Cannot publish a workflow with no nodes');
    }

    // Snapshot the current definition
    const version = await this.snapshotVersion(
      workflowId,
      userId,
      `Published v${(workflow as { version?: number }).version ?? 1}`,
    );

    // Mark the workflow as published
    const { data, error } = await this.supabase.admin
      .from('workflows')
      .update({
        published_version_id: version.id,
        published_at:         new Date().toISOString(),
        published_by:         userId,
        status:               'active',
      })
      .eq('id', workflowId)
      .select('id, name, status, published_version_id, published_at')
      .single();

    if (error ?? !data) throw new Error(error?.message ?? 'Publish failed');

    await this.supabase.admin.from('audit_log').insert({
      organization_id: null,   // filled by DB via project lookup if needed
      project_id:      workflow.project_id,
      actor_id:        userId,
      event_type:      'workflow.published',
      entity_type:     'workflow',
      entity_id:       workflowId,
      summary:         `Workflow "${workflow.name as string}" published (version ${version.version_number as number})`,
      metadata:        { version_id: version.id, version_number: version.version_number },
    });

    return { published: true, version_id: version.id, version_number: version.version_number, workflow: data };
  }

  /** Restore the workflow definition to a specific version snapshot */
  async restoreVersion(workflowId: string, versionId: string, userId: string) {
    const workflow = await this.findOne(workflowId, userId);
    await this.assertProjectAccess(workflow.project_id as string, userId, ['owner', 'admin', 'member']);

    const { data: version, error: vErr } = await this.supabase.admin
      .from('workflow_versions')
      .select('definition, version_number')
      .eq('id', versionId)
      .eq('workflow_id', workflowId)
      .maybeSingle();

    if (vErr ?? !version) throw new NotFoundException(`Version ${versionId} not found`);

    // Snapshot current state before overwriting (so user can undo the restore)
    await this.snapshotVersion(workflowId, userId, `Auto-save before restore to v${version.version_number as number}`);

    // Overwrite live definition
    const { data, error } = await this.supabase.admin
      .from('workflows')
      .update({ definition: version.definition })
      .eq('id', workflowId)
      .select('id, name, updated_at')
      .single();

    if (error ?? !data) throw new Error(error?.message ?? 'Restore failed');
    return { restored: true, version_number: version.version_number, workflow: data };
  }

  /** Delete a workflow (owner/admin only) */
  async delete(id: string, userId: string) {
    const workflow = await this.findOne(id, userId);
    await this.assertProjectAccess(workflow.project_id as string, userId, ['owner', 'admin', 'member']);

    const { error } = await this.supabase.admin
      .from('workflows')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    // Audit log — fire-and-forget
    const { data: proj } = await this.supabase.admin
      .from('projects').select('organization_id').eq('id', workflow.project_id as string).maybeSingle();
    if (proj) {
      void this.supabase.admin.from('audit_log').insert({
        organization_id: proj.organization_id,
        project_id:      workflow.project_id,
        actor_id:        userId,
        event_type:      'workflow.deleted',
        entity_type:     'workflow',
        entity_id:       id,
        summary:         `Workflow "${workflow.name as string}" deleted`,
      });
    }

    return { deleted: true };
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
