/**
 * contractor.approve_payroll  (M4 — HR / Payroll)
 *
 * Transitions a PayrollRun to 'approved'.
 *
 * AI guardrail (non-negotiable):
 *   Only owner/admin may approve payroll. System never initiates salary payment.
 *   Owner must perform the actual bank transfer independently, then mark as paid
 *   via the /resources UI or the payroll.approve-and-pay workflow.
 *
 *   This node MUST be placed downstream of a foundation.request_approval node
 *   in any automated payroll workflow.
 *
 * Inputs:
 *   payrollRunId — payroll run resource ID (required)
 *   notes        — approval notes (optional)
 *
 * Outputs:
 *   payrollRunId    — the payroll run resource ID
 *   payrollRunState — 'approved'
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export interface IPayrollApprovalService {
  updateResource(
    id:         string,
    orgId:      string,
    updates:    { data?: Record<string, unknown> },
    updatedBy?: string,
  ): Promise<{ id: string }>;

  transitionState(
    id:       string,
    orgId:    string,
    toState:  string,
    actorId?: string,
  ): Promise<{ id: string; state: string }>;
}

export async function realApprovePayroll(
  ctx: NodeContext,
  resourceService?: IPayrollApprovalService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;

  const payrollRunId = (inp['payrollRunId'] as string | undefined) ?? (ctx.config['payrollRunId'] as string | undefined);
  const notes        = (inp['notes']        as string | undefined) ?? (ctx.config['notes']        as string | undefined);

  if (!payrollRunId)       return err('contractor.approve_payroll: payrollRunId is required');
  if (!ctx.organizationId) return err('contractor.approve_payroll: organizationId missing from context');
  if (!resourceService)    return err('contractor.approve_payroll: resourceService not injected');

  // 1. Stamp approval metadata
  await resourceService.updateResource(
    payrollRunId,
    ctx.organizationId,
    {
      data: {
        approvedBy: ctx.userId,
        approvedAt: new Date().toISOString(),
        ...(notes ? { approvalNotes: notes } : {}),
      },
    },
    ctx.userId,
  );

  // 2. Transition payroll_run → approved
  const updated = await resourceService.transitionState(
    payrollRunId,
    ctx.organizationId,
    'approved',
    ctx.userId,
  );

  return {
    status: 'success',
    outputs: {
      payrollRunId:    updated.id,
      payrollRunState: updated.state,
    },
  };
}
