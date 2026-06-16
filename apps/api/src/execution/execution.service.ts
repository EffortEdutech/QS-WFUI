/**
 * ExecutionService
 *
 * - Triggers workflow runs (in-process, sequential mock)
 * - Persists run + logs to execution_runs / execution_logs tables
 * - Sprint 6 (S6-003)
 *
 * Security note: AI is advisory only. AI must not approve, certify, decide
 * entitlement, or impersonate a registered Professional Quantity Surveyor.
 */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../common/supabase/supabase.service';
import { FileService } from '../file/file.service';
import { LibraryService } from '../library/library.service';
import { buildRealNodeResolver } from './real-nodes';
import { runWorkflow } from '@qsos/execution-engine';
import type { QSWorkflowDefinition } from '@qsos/shared-types';
import type { TriggerRunDto } from './dto/trigger-run.dto';

@Injectable()
export class ExecutionService {
  private readonly nodeResolver: ReturnType<typeof buildRealNodeResolver>;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly fileService: FileService,
    private readonly libraryService: LibraryService,
  ) {
    // Build once — injects services so real nodes can resolve files from uploads or library
    this.nodeResolver = buildRealNodeResolver(this.fileService, this.libraryService);
  }

  // ── Trigger ────────────────────────────────────────────────────────────────

  async triggerRun(workflowId: string, dto: TriggerRunDto, userId: string) {
    // Load workflow + verify access
    const { data: workflow, error: wfErr } = await this.supabase.admin
      .from('workflows')
      .select('id, name, project_id, definition, status')
      .eq('id', workflowId)
      .single();

    if (wfErr ?? !workflow) throw new NotFoundException(`Workflow ${workflowId} not found`);

    const { data: project } = await this.supabase.admin
      .from('projects')
      .select('organization_id')
      .eq('id', workflow.project_id as string)
      .maybeSingle();

    if (!project) throw new NotFoundException('Project not found');

    await this.assertMembership(project.organization_id as string, userId);

    const definition = workflow.definition as QSWorkflowDefinition;
    if (!definition?.nodes?.length) {
      throw new BadRequestException('Workflow has no nodes — add nodes on the canvas first');
    }

    // Create execution_runs row (status = created)
    const { data: run, error: runErr } = await this.supabase.admin
      .from('execution_runs')
      .insert({
        workflow_id: workflowId,
        project_id: workflow.project_id,
        organization_id: project.organization_id,
        workflow_snapshot: definition,
        status: 'running',
        trigger_type: 'manual',
        inputs: dto.inputs ?? {},
        started_by: userId,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (runErr ?? !run) throw new Error(runErr?.message ?? 'Failed to create run record');

    const runId = run.id as string;

    // Execute (in-process, synchronous for Sprint 6)
    let result;
    try {
      result = await runWorkflow({
        workflowId,
        projectId: workflow.project_id as string,
        organizationId: project.organization_id as string,
        userId,
        definition,
        inputs: dto.inputs ?? {},
        variables: dto.variables ?? {},
        nodeResolver: this.nodeResolver,  // Sprint 7: real nodes for read_excel + read_boq
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await this.supabase.admin.from('execution_runs').update({
        status: 'failed',
        error: { code: 'RUNNER_EXCEPTION', message },
        completed_at: new Date().toISOString(),
      }).eq('id', runId);

      throw new Error(`Execution failed: ${message}`);
    }

    // Persist log entries
    if (result.logs.length > 0) {
      const logRows = result.logs.map((log) => ({
        run_id: runId,
        node_id: log.nodeId,
        node_type: log.nodeType,
        node_name: log.nodeName,
        status: log.status,
        inputs: log.inputs ?? null,
        outputs: log.outputs ?? null,
        error: log.error ?? null,
        messages: log.messages ?? [],
        started_at: log.startedAt ?? null,
        completed_at: log.completedAt ?? null,
        duration_ms: log.durationMs ?? null,
      }));

      await this.supabase.admin.from('execution_logs').insert(logRows);
    }

    // Update run record with final status
    await this.supabase.admin.from('execution_runs').update({
      status: result.status,
      outputs: result.outputs ?? null,
      error: result.error ?? null,
      completed_at: result.completedAt,
      duration_ms: result.durationMs,
    }).eq('id', runId);

    return {
      runId,
      status: result.status,
      durationMs: result.durationMs,
      nodeCount: result.logs.filter((l) => l.status !== 'skipped').length,
    };
  }

  // ── Run details ────────────────────────────────────────────────────────────

  async getRun(runId: string, userId: string) {
    const { data: run, error } = await this.supabase.admin
      .from('execution_runs')
      .select('*')
      .eq('id', runId)
      .single();

    if (error ?? !run) throw new NotFoundException(`Run ${runId} not found`);
    await this.assertMembership(run.organization_id as string, userId);
    return run;
  }

  async getRunLogs(runId: string, userId: string) {
    // Verify run access
    await this.getRun(runId, userId);

    const { data: logs, error } = await this.supabase.admin
      .from('execution_logs')
      .select('*')
      .eq('run_id', runId)
      .order('started_at', { ascending: true });

    if (error) throw new Error(error.message);
    return logs ?? [];
  }

  async listRunsForWorkflow(workflowId: string, userId: string) {
    const { data: workflow } = await this.supabase.admin
      .from('workflows')
      .select('project_id')
      .eq('id', workflowId)
      .maybeSingle();

    if (!workflow) throw new NotFoundException('Workflow not found');

    const { data: project } = await this.supabase.admin
      .from('projects')
      .select('organization_id')
      .eq('id', workflow.project_id as string)
      .maybeSingle();

    if (!project) throw new NotFoundException('Project not found');
    await this.assertMembership(project.organization_id as string, userId);

    const { data: runs, error } = await this.supabase.admin
      .from('execution_runs')
      .select('id, status, trigger_type, started_by, started_at, completed_at, duration_ms, error')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);
    return runs ?? [];
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async assertMembership(organizationId: string, userId: string) {
    const { data: member } = await this.supabase.admin
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!member) throw new NotFoundException('Access denied');
  }
}
