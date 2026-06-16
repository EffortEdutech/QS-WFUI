/**
 * TemplatesService
 *
 * Reads workflow_templates and instantiates them as real workflows.
 * Sprint 10 (S10-001)
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class TemplatesService {
  constructor(private readonly supabase: SupabaseService) {}

  async list() {
    const { data, error } = await this.supabase.admin
      .from('workflow_templates')
      .select('id, slug, name, description, category, tags, icon, color, preview_nodes, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) throw new Error(error.message);
    return { templates: data ?? [] };
  }

  async instantiate(
    templateId: string,
    projectId: string,
    customName?: string,
    userId?: string,
  ) {
    // Load template
    const { data: tpl, error: tplErr } = await this.supabase.admin
      .from('workflow_templates')
      .select('*')
      .or(`id.eq.${templateId},slug.eq.${templateId}`)
      .eq('is_active', true)
      .single();

    if (tplErr ?? !tpl) throw new NotFoundException(`Template "${templateId}" not found`);

    // Verify project exists
    const { data: project } = await this.supabase.admin
      .from('projects')
      .select('id, organization_id, name')
      .eq('id', projectId)
      .single();

    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const name = customName ?? `${tpl.name} — ${project.name}`;

    // Create workflow from template definition
    const { data: workflow, error: wfErr } = await this.supabase.admin
      .from('workflows')
      .insert({
        project_id: projectId,
        organization_id: project.organization_id,
        name,
        description: tpl.description,
        status: 'draft',
        definition: tpl.definition,
        created_by: userId,
      })
      .select('id, name, status, created_at')
      .single();

    if (wfErr ?? !workflow) {
      throw new Error(wfErr?.message ?? 'Failed to create workflow from template');
    }

    // Record audit log
    await this.supabase.admin.from('audit_log').insert({
      organization_id: project.organization_id,
      project_id: projectId,
      actor_id: userId,
      event_type: 'workflow.created_from_template',
      entity_type: 'workflow',
      entity_id: workflow.id,
      summary: `Workflow "${name}" created from template "${tpl.name}"`,
      metadata: { template_id: tpl.id, template_slug: tpl.slug },
    });

    return { workflow };
  }
}
