import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ResourceBinding, ResolvedBindings } from '@lados/shared-types';
import { SupabaseService } from '../common/supabase/supabase.service';
import {
  toResourceBinding,
  type ResourceBindingRow,
} from './dto/binding-response.dto';

interface WorkflowAccess {
  workflowId: string;
  projectId: string;
  orgId: string;
}

@Injectable()
export class ResourceBindingsService {
  constructor(private readonly supabase: SupabaseService) {}

  async listBindings(workflowId: string, userId: string): Promise<ResourceBinding[]> {
    await this.assertWorkflowAccess(workflowId, userId);

    const { data, error } = await this.supabase.admin
      .from('resource_bindings')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('node_id', { ascending: true })
      .order('binding_key', { ascending: true });

    if (error) throw new Error(error.message);
    return ((data ?? []) as ResourceBindingRow[]).map(toResourceBinding);
  }

  async upsertBinding(
    workflowId: string,
    nodeId: string,
    bindingKey: string,
    resourceId: string,
    resourceType: string,
    userId: string,
  ): Promise<ResourceBinding> {
    const access = await this.assertWorkflowAccess(workflowId, userId, [
      'owner',
      'admin',
      'member',
    ]);

    const { data, error } = await this.supabase.admin
      .from('resource_bindings')
      .upsert(
        {
          org_id: access.orgId,
          project_id: access.projectId,
          workflow_id: workflowId,
          node_id: nodeId,
          binding_key: bindingKey,
          resource_id: resourceId,
          resource_type: resourceType,
          created_by: userId,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'workflow_id,node_id,binding_key' },
      )
      .select('*')
      .single();

    if (error ?? !data) {
      throw new Error(error?.message ?? 'Failed to upsert resource binding');
    }

    return toResourceBinding(data as ResourceBindingRow);
  }

  async deleteBinding(
    workflowId: string,
    nodeId: string,
    bindingKey: string,
    userId: string,
  ): Promise<void> {
    await this.assertWorkflowAccess(workflowId, userId, ['owner', 'admin', 'member']);

    const { error } = await this.supabase.admin
      .from('resource_bindings')
      .delete()
      .eq('workflow_id', workflowId)
      .eq('node_id', nodeId)
      .eq('binding_key', bindingKey);

    if (error) throw new Error(error.message);
  }

  async resolveBindings(workflowId: string): Promise<ResolvedBindings> {
    const { data, error } = await this.supabase.admin
      .from('resource_bindings')
      .select('node_id, binding_key, resource_id')
      .eq('workflow_id', workflowId);

    if (error) throw new Error(error.message);

    const resolved: ResolvedBindings = {};
    for (const row of (data ?? []) as Array<{
      node_id: string;
      binding_key: string;
      resource_id: string;
    }>) {
      resolved[row.node_id] ??= {};
      resolved[row.node_id][row.binding_key] = row.resource_id;
    }
    return resolved;
  }

  private async assertWorkflowAccess(
    workflowId: string,
    userId: string,
    roles?: string[],
  ): Promise<WorkflowAccess> {
    const { data: workflow, error: workflowError } = await this.supabase.admin
      .from('workflows')
      .select('id, project_id')
      .eq('id', workflowId)
      .single();

    if (workflowError ?? !workflow) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }

    const projectId = workflow.project_id as string;
    const { data: project, error: projectError } = await this.supabase.admin
      .from('projects')
      .select('id, organization_id')
      .eq('id', projectId)
      .single();

    if (projectError ?? !project) {
      throw new NotFoundException(`Project ${projectId} not found`);
    }

    const orgId = project.organization_id as string;
    const { data: membership, error: membershipError } = await this.supabase.admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', userId)
      .maybeSingle();

    if (membershipError) throw new Error(membershipError.message);
    if (!membership) throw new ForbiddenException('No access to workflow');

    const role = membership.role as string;
    if (roles && !roles.includes(role)) {
      throw new ForbiddenException('Insufficient role for resource binding changes');
    }

    return { workflowId, projectId, orgId };
  }
}
