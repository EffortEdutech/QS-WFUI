/**
 * state.change node — Phase 5 (State Engine)
 *
 * Transitions a resource from its current state to a new state.
 * Enforces transition guards configured in the state machine definition:
 *
 *   requires_role      → blocked immediately if actor lacks the role
 *   requires_approval  → workflow execution pauses; resumes after human approval
 *
 * After approval is granted (execution resumes), ApprovalService.decide()
 * calls StateEngineService.applyTransition() before resuming the workflow,
 * so the resource state is already updated when downstream nodes run.
 *
 * Node config:
 *   resourceId   string   — ID of the resource to transition (or use inputs.resourceId)
 *   toState      string   — target state
 *   approvalTitle  string  — (optional) override title for the approval task
 *
 * Node inputs (override config if set):
 *   resourceId   string
 *   toState      string
 *
 * Node outputs (success):
 *   transitioned      boolean
 *   newState          string
 *   approvalTaskId    string | null   — set when requires_approval guard fires
 *   approvalRequired  boolean
 *
 * Node outputs (failure):
 *   transitioned  false
 *   reason        string
 *
 * AI guardrail: this node may not be called with AI-generated toState values
 * to certify, release payment, or create final commercial facts.
 * Approval-required transitions always route to a human reviewer.
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

export interface IStateEngineService {
  executeTransition(params: {
    resourceId:   string;
    orgId:        string;
    fromState:    string;
    resourceType: string;
    toState:      string;
    actorId:      string;
    actorRole?:   string;
    executionId?:  string;
    workflowId?:   string;
    projectId?:    string;
  }): Promise<
    | { status: 'completed';         newState: string }
    | { status: 'approval_required'; approvalTaskId: string; pendingToState: string }
    | { status: 'blocked';           reason: string }
  >;
}

interface ResourceRow {
  state: string;
  type:  string;
}

export async function realStateChange(
  ctx: NodeContext,
  stateEngine: IStateEngineService,
): Promise<NodeExecuteResult> {
  // Prefer inputs (from upstream nodes) over static config
  const resourceId = (ctx.inputs['resourceId'] ?? ctx.config['resourceId']) as string | undefined;
  const toState    = (ctx.inputs['toState']    ?? ctx.config['toState'])    as string | undefined;

  if (!resourceId || !toState) {
    return {
      status:  'failure',
      outputs: { transitioned: false, reason: 'resourceId and toState are required' },
      error:   { code: 'MISSING_INPUT', message: 'resourceId and toState are required' },
    };
  }

  ctx.logger.info(`state.change: resource ${resourceId} → "${toState}"`);

  // Fetch current resource state and type from Supabase.
  // We access Supabase directly (same pattern as core.human_approval) because
  // the pack cannot inject NestJS services — it receives the StateEngineService
  // interface instead.
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];

  if (!supabaseUrl || !supabaseKey) {
    return {
      status:  'failure',
      outputs: { transitioned: false, reason: 'Supabase credentials not configured' },
      error:   { code: 'CONFIG_ERROR', message: 'SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set' },
    };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: resource, error: resErr } = await supabase
    .from('lados_resources')
    .select('state, type')
    .eq('id', resourceId)
    .eq('org_id', ctx.organizationId)
    .single();

  if (resErr || !resource) {
    return {
      status:  'failure',
      outputs: { transitioned: false, reason: `Resource ${resourceId} not found` },
      error:   { code: 'RESOURCE_NOT_FOUND', message: resErr?.message ?? 'not found' },
    };
  }

  const row = resource as ResourceRow;

  const result = await stateEngine.executeTransition({
    resourceId,
    orgId:        ctx.organizationId,
    fromState:    row.state,
    resourceType: row.type,
    toState,
    actorId:      ctx.userId,
    executionId:  ctx.executionId,
    workflowId:   ctx.workflowId,
    projectId:    ctx.projectId,
  });

  if (result.status === 'blocked') {
    ctx.logger.warn(`state.change: transition blocked — ${result.reason}`);
    return {
      status:  'failure',
      outputs: { transitioned: false, reason: result.reason, approvalRequired: false },
      error:   { code: 'TRANSITION_BLOCKED', message: result.reason },
    };
  }

  if (result.status === 'approval_required') {
    ctx.logger.info(
      `state.change: approval required — task ${result.approvalTaskId}. Workflow pausing.`,
    );
    // Signal the WorkflowRunner to pause execution here.
    // ApprovalService.decide() will call StateEngine.applyTransition() and
    // then resume the workflow. Downstream nodes receive { approved, rejected, ... }.
    return {
      status:  'paused',
      outputs: {
        transitioned:    false,
        approvalRequired: true,
        approvalTaskId:  result.approvalTaskId,
        pendingToState:  result.pendingToState,
        resourceId,
      },
      summary: `Waiting for approval to transition resource to "${result.pendingToState}"`,
    };
  }

  // status === 'completed'
  ctx.logger.info(`state.change: transitioned ${row.state} → ${result.newState}`);
  return {
    status:  'success',
    outputs: {
      transitioned:    true,
      newState:        result.newState,
      approvalRequired: false,
      approvalTaskId:  null,
      resourceId,
    },
    summary: `Resource transitioned to "${result.newState}"`,
  };
}
