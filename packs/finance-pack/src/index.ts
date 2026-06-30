/**
 * @lados/finance-pack
 *
 * Finance domain nodes for Lados — Invoice submission / verification / approval,
 * Purchase Orders, and Retention Release for CIPAA / PAM / JKR contracts.
 *
 * Phase 9: Full financial lifecycle for construction contracts.
 *
 * AI guardrails (non-negotiable):
 *   - finance.approve_invoice          → MUST be downstream of foundation.request_approval
 *   - finance.process_payment          → MUST be downstream of foundation.request_approval
 *   - finance.approve_purchase_order   → MUST be downstream of foundation.request_approval
 *   - finance.process_retention_release → MUST be downstream of foundation.request_approval
 *
 * Depends on: @lados/foundation-pack (must be active)
 */

import type { PackManifest } from '@lados/pack-sdk';
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

import { realSubmitInvoice }             from './nodes/finance-submit-invoice';
import { realVerifyInvoice }             from './nodes/finance-verify-invoice';
import { realApproveInvoice }            from './nodes/finance-approve-invoice';
import { realProcessPayment }            from './nodes/finance-process-payment';
import { realCreatePurchaseOrder }       from './nodes/finance-create-purchase-order';
import { realApprovePurchaseOrder }      from './nodes/finance-approve-purchase-order';
import { realClaimRetentionRelease }     from './nodes/finance-claim-retention-release';
import { realProcessRetentionRelease }   from './nodes/finance-process-retention-release';

// ── Re-export types ───────────────────────────────────────────────────────────

export {
  FINANCE_RESOURCE_TYPES,
  FINANCE_EVENTS,
  type FinanceResourceType,
  type FinanceEventType,
  type IFinanceResourceService,
  type IFinanceResource,
  type FinanceInvoiceData,
  type FinanceInvoiceLineItem,
  type PurchaseOrderData,
  type PurchaseOrderLineItem,
  type RetentionReleaseData,
} from './types';

export { nodeManifests } from './manifests';

export const PACK_ID      = 'finance-pack' as const;
export const PACK_VERSION = '0.1.0' as const;

export const manifest: PackManifest = {
  id:          PACK_ID,
  version:     PACK_VERSION,
  displayName: 'Finance Pack',
  description: 'Finance domain nodes — Invoice submission / QS verification / PM approval, Purchase Orders, and Retention Release for CIPAA / PAM / JKR construction contracts.',
  author:      'Lados Platform',
  nodes: [
    'finance.submit_invoice',
    'finance.verify_invoice',
    'finance.approve_invoice',
    'finance.process_payment',
    'finance.create_purchase_order',
    'finance.approve_purchase_order',
    'finance.claim_retention_release',
    'finance.process_retention_release',
  ],
};

export interface FinancePackServices {
  resourceService?: import('./types').IFinanceResourceService;
}

type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

const noService = (code: string, msg: string): NodeExecuteResult =>
  ({ status: 'failure', outputs: {}, error: { code, message: msg } });

/**
 * Returns the real executor for a finance-pack node type, or null if unknown.
 */
export function resolveNode(
  services: FinancePackServices = {},
): (nodeType: string) => NodeExecutor | null {
  const { resourceService } = services;

  const nodes: Record<string, NodeExecutor> = {
    'finance.submit_invoice':
      (ctx) => resourceService
        ? realSubmitInvoice(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'FinanceResourceService not injected')),

    'finance.verify_invoice':
      (ctx) => resourceService
        ? realVerifyInvoice(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'FinanceResourceService not injected')),

    'finance.approve_invoice':
      (ctx) => resourceService
        ? realApproveInvoice(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'FinanceResourceService not injected')),

    'finance.process_payment':
      (ctx) => resourceService
        ? realProcessPayment(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'FinanceResourceService not injected')),

    'finance.create_purchase_order':
      (ctx) => resourceService
        ? realCreatePurchaseOrder(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'FinanceResourceService not injected')),

    'finance.approve_purchase_order':
      (ctx) => resourceService
        ? realApprovePurchaseOrder(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'FinanceResourceService not injected')),

    'finance.claim_retention_release':
      (ctx) => resourceService
        ? realClaimRetentionRelease(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'FinanceResourceService not injected')),

    'finance.process_retention_release':
      (ctx) => resourceService
        ? realProcessRetentionRelease(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'FinanceResourceService not injected')),
  };

  return (nodeType: string) => nodes[nodeType] ?? null;
}
