/**
 * finance.submit_invoice
 *
 * Creates a FinanceInvoice resource (type: finance_invoice) and submits it
 * for QS verification. Represents an Interim Payment Certificate (IPC) or
 * Final Account submission in the PAM/JKR construction contract context.
 *
 * Inputs:
 *   projectResourceId — parent construction_project resource ID (required)
 *   invoiceNo         — reference e.g. "IPC-003" (optional)
 *   invoiceType       — interim | final | variation | retention (optional)
 *   invoiceDate       — ISO 8601 date (optional, defaults to today)
 *   periodStart       — billing period start ISO 8601 (optional)
 *   periodEnd         — billing period end ISO 8601 (optional)
 *   invoiceAmount     — total claimed amount MYR (required)
 *   currency          — default MYR (optional)
 *   contractorName    — submitting contractor (optional)
 *   description       — scope/reference summary (optional)
 *   projectId         — Lados project to attach to (optional)
 *
 * Outputs:
 *   invoiceId     — created resource ID
 *   invoiceState  — 'submitted'
 *   invoiceNo     — invoice reference number
 *   invoiceAmount — claimed amount
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { IFinanceResourceService, FinanceInvoiceData } from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realSubmitInvoice(
  ctx: NodeContext,
  resourceService?: IFinanceResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const projectResourceId = (inp['projectResourceId'] ?? cfg['projectResourceId']) as string | undefined;
  const invoiceNo         = (inp['invoiceNo']         ?? cfg['invoiceNo'])         as string | undefined;
  const invoiceType       = (inp['invoiceType']       ?? cfg['invoiceType'])       as string | undefined ?? 'interim';
  const invoiceDate       = (inp['invoiceDate']       ?? cfg['invoiceDate'])       as string | undefined ?? new Date().toISOString().split('T')[0];
  const periodStart       = (inp['periodStart']       ?? cfg['periodStart'])       as string | undefined;
  const periodEnd         = (inp['periodEnd']         ?? cfg['periodEnd'])         as string | undefined;
  const invoiceAmount     = (inp['invoiceAmount']     ?? cfg['invoiceAmount'])     as number | undefined;
  const currency          = (inp['currency']          ?? cfg['currency'])          as string | undefined ?? 'MYR';
  const contractorName    = (inp['contractorName']    ?? cfg['contractorName'])    as string | undefined;
  const description       = (inp['description']       ?? cfg['description'])       as string | undefined;
  const projectId         = (inp['projectId']         ?? cfg['projectId'])         as string | undefined;

  if (!projectResourceId) return err('finance.submit_invoice: projectResourceId is required');
  if (invoiceAmount === undefined || invoiceAmount === null)
    return err('finance.submit_invoice: invoiceAmount is required');
  if (!ctx.organizationId) return err('finance.submit_invoice: organizationId missing from context');
  if (!resourceService)    return err('finance.submit_invoice: resourceService not injected');

  const now = new Date().toISOString();
  const data: FinanceInvoiceData = {
    projectResourceId,
    invoiceType,
    invoiceDate,
    invoiceAmount,
    currency,
    submittedBy:  ctx.userId,
    submittedAt:  now,
    ...(invoiceNo      ? { invoiceNo }      : {}),
    ...(periodStart    ? { periodStart }    : {}),
    ...(periodEnd      ? { periodEnd }      : {}),
    ...(contractorName ? { contractorName } : {}),
    ...(description    ? { description }    : {}),
  };

  const name = invoiceNo
    ? `${invoiceNo} — ${contractorName ?? 'Invoice'}`
    : `Finance Invoice — ${invoiceDate}`;

  // Create in draft, then submit
  const resource = await resourceService.create({
    orgId:     ctx.organizationId,
    type:      'finance_invoice',
    name,
    data:      data as unknown as Record<string, unknown>,
    parentId:  projectResourceId,
    ...(projectId ? { projectId } : {}),
    createdBy: ctx.userId,
  });

  const submitted = await resourceService.transitionState(
    resource.id,
    ctx.organizationId,
    'submitted',
    ctx.userId ?? 'system',
  );

  ctx.logger.info(
    `[finance.submit_invoice] Created invoice "${name}" (id=${resource.id}, state=${submitted.state}, amount=${invoiceAmount} ${currency})`,
  );

  return {
    status: 'success',
    outputs: {
      invoiceId:     resource.id,
      invoiceState:  submitted.state,
      invoiceNo:     invoiceNo ?? '',
      invoiceAmount,
    },
  };
}
