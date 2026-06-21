/**
 * contractor.approve_expense  (M2 — Finance)
 *
 * Transitions an Expense resource to 'approved'.
 *
 * AI guardrail (non-negotiable):
 *   AI cannot approve expenses. This node must be called by an authenticated
 *   owner/admin user. The execution engine enforces this via role-based
 *   approval gating — this node MUST appear downstream of a
 *   foundation.request_approval node in any workflow that automates expense approval.
 *
 * Inputs:
 *   expenseId — expense resource ID (required)
 *   notes     — approval notes (optional)
 *
 * Outputs:
 *   expenseId    — the expense resource ID
 *   expenseState — 'approved'
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export interface IExpenseApprovalService {
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

export async function realApproveExpense(
  ctx: NodeContext,
  resourceService?: IExpenseApprovalService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;

  const expenseId = (inp['expenseId'] as string | undefined) ?? (ctx.config['expenseId'] as string | undefined);
  const notes     = (inp['notes']     as string | undefined) ?? (ctx.config['notes']     as string | undefined);

  if (!expenseId)          return err('contractor.approve_expense: expenseId is required');
  if (!ctx.organizationId) return err('contractor.approve_expense: organizationId missing from context');
  if (!resourceService)    return err('contractor.approve_expense: resourceService not injected');

  // 1. Stamp approved metadata onto the expense record
  await resourceService.updateResource(
    expenseId,
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

  // 2. Transition expense → approved
  const updated = await resourceService.transitionState(
    expenseId,
    ctx.organizationId,
    'approved',
    ctx.userId,
  );

  return {
    status: 'success',
    outputs: {
      expenseId:    updated.id,
      expenseState: updated.state,
    },
  };
}
