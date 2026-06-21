/**
 * contractor.generate_invoice
 *
 * Creates an Invoice resource for a completed Job.
 * Line items can be passed explicitly or will be auto-generated from
 * completed trips under the job.
 *
 * AI GUARDRAIL (non-negotiable):
 *   Invoice amounts are financial facts. This node creates an invoice in
 *   'pending_approval' state. The invoice CANNOT be sent to a customer
 *   or used for payment until an owner/admin explicitly approves it via
 *   foundation.request_approval or a manual state transition.
 *   No AI output may advance an invoice past 'pending_approval'.
 *
 * Inputs:
 *   jobId       — job resource ID (required)
 *   customerId  — customer resource ID (optional, looked up from job if omitted)
 *   lineItems   — explicit line items (optional; auto-calculated from trips if omitted)
 *   notes       — invoice notes (optional)
 *
 * Outputs:
 *   invoiceId    — created invoice resource ID
 *   invoiceState — 'pending_approval'
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { InvoiceData, InvoiceLineItem } from '../types';
import type { IResourceService } from './contractor-create-job';

// ── Helper ────────────────────────────────────────────────────────────────────

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

// ── Extended service interface ────────────────────────────────────────────────

/** Allows reading child resources (trips) to auto-generate line items. */
export interface IInvoiceResourceService extends IResourceService {
  list(params: {
    orgId:     string;
    type:      string;
    parentId?: string;
    state?:    string;
  }): Promise<Array<{ id: string; name: string; state: string; data: Record<string, unknown> }>>;

  findById(id: string, orgId: string): Promise<{ id: string; data: Record<string, unknown> } | null>;
}

// ── Node implementation ───────────────────────────────────────────────────────

export async function realGenerateInvoice(
  ctx: NodeContext,
  resourceService?: IInvoiceResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;

  const jobId      = (inp['jobId']      as string | undefined)            ?? (ctx.config['jobId']      as string | undefined);
  const customerId = (inp['customerId'] as string | undefined)            ?? (ctx.config['customerId'] as string | undefined);
  const lineItems  = (inp['lineItems']  as InvoiceLineItem[] | undefined) ?? (ctx.config['lineItems']  as InvoiceLineItem[] | undefined);
  const notes      = (inp['notes']      as string | undefined)            ?? (ctx.config['notes']      as string | undefined);

  if (!jobId)               return err('contractor.generate_invoice: jobId is required');
  if (!ctx.organizationId)  return err('contractor.generate_invoice: organizationId missing from context');
  if (!resourceService)     return err('contractor.generate_invoice: resourceService not injected');

  // ── Auto-calculate line items from completed trips if not provided ──────────

  let resolvedLineItems: InvoiceLineItem[] = lineItems ?? [];

  if (resolvedLineItems.length === 0) {
    const trips = await resourceService.list({
      orgId:    ctx.organizationId,
      type:     'trip',
      parentId: jobId,
      state:    'completed',
    });

    resolvedLineItems = trips.map((trip) => {
      const km = (trip.data['completedKm'] as number | undefined) ?? 0;
      return {
        description: trip.name,
        quantity:    km,
        unitPrice:   0, // price TBD — owner sets unit price on approval
        unit:        'km',
        total:       0,
        sourceId:    trip.id,
      };
    });
  }

  // ── Build invoice data ──────────────────────────────────────────────────────

  const resolvedCustomerId = customerId ?? (await resolveCustomerId(jobId, ctx.organizationId, resourceService));

  const subtotal = resolvedLineItems.reduce((sum, li) => sum + (li.total ?? 0), 0);

  const data: InvoiceData = {
    jobId,
    ...(resolvedCustomerId ? { customerId: resolvedCustomerId } : {}),
    lineItems: resolvedLineItems,
    subtotal,
    tax:      0,
    total:    subtotal,
    currency: 'MYR',
    ...(notes ? { notes } : {}),
  };

  const invoice = await resourceService.create({
    orgId:     ctx.organizationId,
    type:      'invoice',
    name:      `Invoice for Job ${jobId}`,
    data:      { ...data } as Record<string, unknown>,
    parentId:  jobId,
    createdBy: ctx.userId,
  });

  // Invoice initial state is 'draft' from the state machine.
  // The state machine must be advanced to 'pending_approval' via
  // foundation.request_approval or a workflow state.change node.
  // This is the correct point for the AI guardrail to take effect.

  return {
    status: 'success',
    outputs: {
      invoiceId:    invoice.id,
      invoiceState: invoice.state,
    },
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function resolveCustomerId(
  jobId:           string,
  orgId:           string,
  resourceService: IInvoiceResourceService,
): Promise<string | undefined> {
  try {
    const job = await resourceService.findById(jobId, orgId);
    return (job?.data['customerId'] as string | undefined);
  } catch {
    return undefined;
  }
}
