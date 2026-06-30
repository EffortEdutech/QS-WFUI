/**
 * Finance Pack — Type Catalogue
 *
 * Canonical resource type names, event types, service interfaces,
 * and data shapes for the Finance Pack (Phase 9).
 *
 * Context: CIPAA / PAM / JKR construction contract financial instruments.
 * These are distinct from contractor-pack's 'invoice'/'payment' types
 * (which track service billing for contractors). Finance-pack handles
 * CONSTRUCTION CONTRACT financial flow:
 *   - Interim Payment Certificates (IPC) / Final Accounts
 *   - Purchase Orders for materials and subcontracted works
 *   - Retention money release at practical completion / DLP end
 *
 * AI guardrails (non-negotiable):
 *   - finance.approve_invoice       → MUST be downstream of foundation.request_approval
 *   - finance.process_payment       → MUST be downstream of foundation.request_approval
 *   - finance.approve_purchase_order → MUST be downstream of foundation.request_approval
 *   - finance.process_retention_release → MUST be downstream of foundation.request_approval
 *   AI cannot approve, certify, or release any financial instrument directly.
 */

// ── Resource types ────────────────────────────────────────────────────────────

export const FINANCE_RESOURCE_TYPES = [
  'finance_invoice',
  'purchase_order',
  'retention_release',
] as const;

export type FinanceResourceType = typeof FINANCE_RESOURCE_TYPES[number];

// ── Event types ───────────────────────────────────────────────────────────────

export const FINANCE_EVENTS = {
  // Finance Invoice (IPC)
  INVOICE_SUBMITTED:    'finance_invoice.submitted',
  INVOICE_VERIFIED:     'finance_invoice.verified',
  INVOICE_APPROVED:     'finance_invoice.approved',
  INVOICE_PAID:         'finance_invoice.paid',
  INVOICE_REJECTED:     'finance_invoice.rejected',

  // Purchase Order
  PO_SUBMITTED:         'purchase_order.submitted',
  PO_APPROVED:          'purchase_order.approved',
  PO_ISSUED:            'purchase_order.issued',
  PO_FULFILLED:         'purchase_order.fulfilled',
  PO_REJECTED:          'purchase_order.rejected',
  PO_CANCELLED:         'purchase_order.cancelled',

  // Retention Release
  RETENTION_CLAIMED:    'retention_release.claimed',
  RETENTION_APPROVED:   'retention_release.approved',
  RETENTION_RELEASED:   'retention_release.released',
  RETENTION_REJECTED:   'retention_release.rejected',
} as const;

export type FinanceEventType = typeof FINANCE_EVENTS[keyof typeof FINANCE_EVENTS];

// ── Service interface ─────────────────────────────────────────────────────────
//
// IFinanceResourceService is satisfied by NestJS ResourceService via
// structural (duck) typing — no NestJS imports in this pack.

export interface IFinanceResource {
  id:         string;
  org_id:     string;
  project_id: string | null;
  type:       string;
  name:       string;
  state:      string;
  data:       Record<string, unknown>;
  parent_id:  string | null;
  created_at: string;
  updated_at: string;
}

export interface IFinanceResourceService {
  create(params: {
    orgId:      string;
    type:       string;
    name:       string;
    data?:      Record<string, unknown>;
    projectId?: string;
    parentId?:  string;
    createdBy?: string;
  }): Promise<IFinanceResource>;

  findById(id: string, orgId: string): Promise<IFinanceResource | null>;

  updateResource(
    id:        string,
    orgId:     string,
    updates:   { name?: string; data?: Record<string, unknown> },
    updatedBy: string,
  ): Promise<IFinanceResource>;

  transitionState(
    id:      string,
    orgId:   string,
    toState: string,
    actorId: string,
  ): Promise<IFinanceResource>;
}

// ── Data shapes (stored in lados_resources.data JSONB) ───────────────────────

// finance_invoice ─────────────────────────────────────────────────────────────

export interface FinanceInvoiceLineItem {
  description:  string;
  quantity?:    number;
  unit?:        string;
  unitRate?:    number;
  amount:       number;
  boqRef?:      string;   // BOQ item reference
}

export interface FinanceInvoiceData {
  projectResourceId:  string;     // parent construction_project resource ID
  invoiceNo?:         string;     // e.g. "IPC-003" / "FA-001"
  invoiceType?:       string;     // 'interim' | 'final' | 'variation' | 'retention'
  invoiceDate?:       string;     // ISO 8601
  periodStart?:       string;     // ISO 8601 — billing period start
  periodEnd?:         string;     // ISO 8601 — billing period end
  invoiceAmount:      number;     // MYR — total claimed amount
  currency?:          string;     // default 'MYR'
  contractorName?:    string;
  description?:       string;     // scope or reference summary
  lineItems?:         FinanceInvoiceLineItem[];
  supportingDocs?:    string[];   // file URLs
  submittedBy?:       string;     // user ID
  submittedAt?:       string;     // ISO 8601
  // QS Verification fields
  verifiedAmount?:    number;     // MYR — QS-certified amount
  verificationNotes?: string;
  verifiedBy?:        string;     // user ID
  verifiedAt?:        string;     // ISO 8601
  // PM Approval fields (human-only — AI guardrail)
  approvedAmount?:    number;     // MYR
  approvalComments?:  string;
  approvedBy?:        string;     // user ID — must be human
  approvedAt?:        string;     // ISO 8601
  // Payment fields (human-only — AI guardrail)
  paidAmount?:        number;     // MYR
  paymentRef?:        string;     // payment reference / cheque no
  paymentDate?:       string;     // ISO 8601
  paymentMethod?:     string;     // 'bank_transfer' | 'cheque' | 'online'
  paidBy?:            string;     // user ID
}

// purchase_order ──────────────────────────────────────────────────────────────

export interface PurchaseOrderLineItem {
  description:  string;
  quantity:     number;
  unit?:        string;
  unitRate:     number;
  amount:       number;
  boqRef?:      string;
}

export interface PurchaseOrderData {
  projectResourceId:  string;     // parent construction_project resource ID
  poNo?:              string;     // e.g. "PO-2024-001"
  supplierName:       string;
  supplierCode?:      string;
  description:        string;     // brief scope
  amount:             number;     // MYR — total PO value
  currency?:          string;     // default 'MYR'
  issueDate?:         string;     // ISO 8601
  deliveryDate?:      string;     // ISO 8601 — expected delivery / completion
  paymentTerms?:      string;     // e.g. "30 days net"
  lineItems?:         PurchaseOrderLineItem[];
  attachments?:       string[];   // file URLs
  submittedBy?:       string;     // user ID
  submittedAt?:       string;     // ISO 8601
  // Approval fields (human-only — AI guardrail)
  approvedBy?:        string;     // user ID — must be human
  approvedAt?:        string;     // ISO 8601
  approvalComments?:  string;
  // Issue / Fulfillment fields
  issuedAt?:          string;     // ISO 8601
  fulfilledAt?:       string;     // ISO 8601
  fulfillmentNotes?:  string;
}

// retention_release ───────────────────────────────────────────────────────────

export interface RetentionReleaseData {
  projectResourceId:          string;     // parent construction_project resource ID
  retentionType?:             string;     // 'half_release' | 'final_release'
  retentionAmount:            number;     // MYR — retention sum being claimed
  currency?:                  string;     // default 'MYR'
  claimBasis?:                string;     // 'practical_completion' | 'dlp_expiry' | 'other'
  projectCompletionDate?:     string;     // ISO 8601 — CPC date
  defectsLiabilityPeriodEnd?: string;     // ISO 8601 — DLP end date
  description?:               string;
  supportingDocs?:            string[];   // file URLs
  claimedBy?:                 string;     // user ID
  claimedAt?:                 string;     // ISO 8601
  // Approval fields (human-only — AI guardrail)
  approvedBy?:                string;     // user ID — must be human
  approvedAt?:                string;     // ISO 8601
  approvedAmount?:            number;     // MYR — may differ from claimed
  approvalComments?:          string;
  // Release / Payment fields
  releaseAmount?:             number;     // MYR
  releaseRef?:                string;     // payment reference
  releaseDate?:               string;     // ISO 8601
  releasedBy?:                string;     // user ID
}
