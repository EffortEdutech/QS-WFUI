/**
 * ApprovalTaskCreator — Phase 7
 *
 * Thin service that creates approval_task rows in Supabase.
 * Extracted from ApprovalService to avoid the circular dependency:
 *
 *   ApprovalService → ExecutionService (resumeRun)
 *   ExecutionService → ApprovalService (createTask) ← would be circular
 *
 * Solution: ApprovalTaskCreator has no ExecutionService dependency.
 * Both ApprovalService and buildRealNodeResolver inject this instead.
 *
 * This is the NestJS concrete implementation of IApprovalTaskService
 * defined in @lados/foundation-pack.
 */

import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';

@Injectable()
export class ApprovalTaskCreator {
  constructor(private readonly supabase: SupabaseService) {}

  async createTask(params: {
    executionId:   string;
    workflowId:    string;
    projectId:     string;
    nodeId:        string;
    nodeName?:     string;
    orgId:         string;
    title:         string;
    description?:  string;
    assigneeRole?: string;
    data?:         Record<string, unknown>;
  }): Promise<{ taskId: string }> {
    const { data: task, error } = await this.supabase.admin
      .from('approval_tasks')
      .insert({
        execution_id:  params.executionId,
        workflow_id:   params.workflowId,
        project_id:    params.projectId || null,
        node_id:       params.nodeId,
        node_name:     params.nodeName ?? params.title,
        title:         params.title,
        description:   params.description ?? `Review required by ${params.assigneeRole ?? 'owner'}`,
        data:          params.data ?? {},
        status:        'pending',
        assignee_role: params.assigneeRole ?? 'owner',
      })
      .select('id')
      .single();

    if (error || !task) {
      throw new Error(error?.message ?? 'Failed to create approval task');
    }

    return { taskId: task['id'] as string };
  }
}
