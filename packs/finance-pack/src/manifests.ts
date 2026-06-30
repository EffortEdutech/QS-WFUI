/**
 * @lados/finance-pack — NodeManifestV2 declarations (Phase 9)
 */

import type { NodeManifestV2 } from '@lados/node-sdk';

// ── finance.submit_invoice ────────────────────────────────────────────────────

export const financeSubmitInvoiceManifest: NodeManifestV2 = {
  type:        'finance.submit_invoice',
  name:        'Submit Invoice',
  version:     '1.0.0',
  description: 'Creates a FinanceInvoice (IPC / Final Account) resource and submits it for QS verification. Links to a construction project.',
  category:    'finance',
  packId:      'finance-pack',
  tags:        ['finance', 'invoice', 'payment', 'IPC', 'resource'],
  inputs: [
    { id: 'projectResourceId', name: 'Project Resource ID', dataType: 'string', required: true  },
    { id: 'invoiceAmount',     name: 'Invoice Amount (MYR)', dataType: 'number', required: true  },
    { id: 'invoiceNo',         name: 'Invoice No.',          dataType: 'string', required: false },
    { id: 'invoiceType',       name: 'Invoice Type',         dataType: 'string', required: false },
    { id: 'invoiceDate',       name: 'Invoice Date',         dataType: 'string', required: false },
    { id: 'periodStart',       name: 'Period Start',         dataType: 'string', required: false },
    { id: 'periodEnd',         name: 'Period End',           dataType: 'string', required: false },
    { id: 'currency',          name: 'Currency',             dataType: 'string', required: false },
    { id: 'contractorName',    name: 'Contractor Name',      dataType: 'string', required: false },
    { id: 'description',       name: 'Description',          dataType: 'string', required: false },
    { id: 'projectId',         name: 'Lados Project ID',     dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'invoiceId',     name: 'Invoice Resource ID', dataType: 'string' },
    { id: 'invoiceState',  name: 'Invoice State',       dataType: 'string' },
    { id: 'invoiceNo',     name: 'Invoice No.',         dataType: 'string' },
    { id: 'invoiceAmount', name: 'Invoice Amount',      dataType: 'number' },
  ],
  config: [
    { key: 'invoiceType', label: 'Invoice Type', type: 'select', required: false, defaultValue: 'interim',
      options: [
        { value: 'interim',   label: 'Interim Payment Certificate' },
        { value: 'final',     label: 'Final Account' },
        { value: 'variation', label: 'Variation Order' },
        { value: 'retention', label: 'Retention Release' },
      ],
    },
    { key: 'currency', label: 'Currency', type: 'string', required: false, defaultValue: 'MYR' },
  ],
  resourceRequirements: [
    { type: 'finance_invoice', access: 'create', description: 'Creates a new finance invoice record' },
  ],
};

// ── finance.verify_invoice ────────────────────────────────────────────────────

export const financeVerifyInvoiceManifest: NodeManifestV2 = {
  type:        'finance.verify_invoice',
  name:        'Verify Invoice (QS)',
  version:     '1.0.0',
  description: 'QS assessment and certification of a submitted invoice. Records the verified (certified) amount and advances state to verified.',
  category:    'finance',
  packId:      'finance-pack',
  tags:        ['finance', 'invoice', 'QS', 'verification', 'assessment'],
  inputs: [
    { id: 'invoiceId',         name: 'Invoice Resource ID', dataType: 'string', required: true  },
    { id: 'verifiedAmount',    name: 'Verified Amount (MYR)', dataType: 'number', required: true  },
    { id: 'verificationNotes', name: 'Verification Notes',  dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'invoiceId',      name: 'Invoice Resource ID', dataType: 'string' },
    { id: 'invoiceState',   name: 'Invoice State',       dataType: 'string' },
    { id: 'verifiedAmount', name: 'Verified Amount',     dataType: 'number' },
  ],
  config: [],
  resourceRequirements: [
    { type: 'finance_invoice', access: 'write', description: 'Updates invoice with QS-verified amount' },
  ],
};

// ── finance.approve_invoice ───────────────────────────────────────────────────

export const financeApproveInvoiceManifest: NodeManifestV2 = {
  type:        'finance.approve_invoice',
  name:        'Approve Invoice (PM)',
  version:     '1.0.0',
  description: 'PM / authorised signatory approval of a QS-verified invoice. MUST be downstream of foundation.request_approval — AI cannot approve invoices.',
  category:    'finance',
  packId:      'finance-pack',
  tags:        ['finance', 'invoice', 'approval', 'PM', 'guardrail'],
  inputs: [
    { id: 'invoiceId',        name: 'Invoice Resource ID', dataType: 'string', required: true  },
    { id: 'approvalComments', name: 'Approval Comments',   dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'invoiceId',      name: 'Invoice Resource ID', dataType: 'string' },
    { id: 'invoiceState',   name: 'Invoice State',       dataType: 'string' },
    { id: 'approvedAmount', name: 'Approved Amount',     dataType: 'number' },
  ],
  config: [],
  resourceRequirements: [
    { type: 'finance_invoice', access: 'write', description: 'Approves invoice — human authorisation required upstream' },
  ],
};

// ── finance.process_payment ───────────────────────────────────────────────────

export const financeProcessPaymentManifest: NodeManifestV2 = {
  type:        'finance.process_payment',
  name:        'Process Payment',
  version:     '1.0.0',
  description: 'Records payment disbursement against an approved invoice. MUST be downstream of foundation.request_approval — AI cannot release payment.',
  category:    'finance',
  packId:      'finance-pack',
  tags:        ['finance', 'payment', 'invoice', 'disbursement', 'guardrail'],
  inputs: [
    { id: 'invoiceId',     name: 'Invoice Resource ID',  dataType: 'string', required: true  },
    { id: 'paymentAmount', name: 'Payment Amount (MYR)', dataType: 'number', required: true  },
    { id: 'paymentRef',    name: 'Payment Reference',    dataType: 'string', required: false },
    { id: 'paymentDate',   name: 'Payment Date',         dataType: 'string', required: false },
    { id: 'paymentMethod', name: 'Payment Method',       dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'invoiceId',    name: 'Invoice Resource ID', dataType: 'string' },
    { id: 'invoiceState', name: 'Invoice State',       dataType: 'string' },
    { id: 'paidAmount',   name: 'Paid Amount',         dataType: 'number' },
    { id: 'paymentRef',   name: 'Payment Reference',   dataType: 'string' },
  ],
  config: [
    { key: 'paymentMethod', label: 'Payment Method', type: 'select', required: false, defaultValue: 'bank_transfer',
      options: [
        { value: 'bank_transfer', label: 'Bank Transfer' },
        { value: 'cheque',        label: 'Cheque' },
        { value: 'online',        label: 'Online Payment' },
      ],
    },
  ],
  resourceRequirements: [
    { type: 'finance_invoice', access: 'write', description: 'Records payment against invoice — human authorisation required upstream' },
  ],
};

// ── finance.create_purchase_order ─────────────────────────────────────────────

export const financeCreatePurchaseOrderManifest: NodeManifestV2 = {
  type:        'finance.create_purchase_order',
  name:        'Create Purchase Order',
  version:     '1.0.0',
  description: 'Creates a PurchaseOrder resource for materials or subcontracted works and submits it for approval.',
  category:    'finance',
  packId:      'finance-pack',
  tags:        ['finance', 'purchase-order', 'procurement', 'resource'],
  inputs: [
    { id: 'projectResourceId', name: 'Project Resource ID', dataType: 'string', required: true  },
    { id: 'supplierName',      name: 'Supplier Name',       dataType: 'string', required: true  },
    { id: 'description',       name: 'Description',         dataType: 'string', required: true  },
    { id: 'amount',            name: 'PO Amount (MYR)',      dataType: 'number', required: true  },
    { id: 'poNo',              name: 'PO No.',               dataType: 'string', required: false },
    { id: 'currency',          name: 'Currency',             dataType: 'string', required: false },
    { id: 'deliveryDate',      name: 'Delivery Date',        dataType: 'string', required: false },
    { id: 'paymentTerms',      name: 'Payment Terms',        dataType: 'string', required: false },
    { id: 'projectId',         name: 'Lados Project ID',     dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'purchaseOrderId',    name: 'PO Resource ID', dataType: 'string' },
    { id: 'purchaseOrderState', name: 'PO State',       dataType: 'string' },
    { id: 'poNo',               name: 'PO No.',         dataType: 'string' },
    { id: 'amount',             name: 'PO Amount',      dataType: 'number' },
  ],
  config: [
    { key: 'currency', label: 'Currency', type: 'string', required: false, defaultValue: 'MYR' },
  ],
  resourceRequirements: [
    { type: 'purchase_order', access: 'create', description: 'Creates a new purchase order record' },
  ],
};

// ── finance.approve_purchase_order ────────────────────────────────────────────

export const financeApprovePurchaseOrderManifest: NodeManifestV2 = {
  type:        'finance.approve_purchase_order',
  name:        'Approve Purchase Order',
  version:     '1.0.0',
  description: 'Approves a submitted PO for issue to supplier. MUST be downstream of foundation.request_approval — AI cannot commit funds.',
  category:    'finance',
  packId:      'finance-pack',
  tags:        ['finance', 'purchase-order', 'approval', 'guardrail'],
  inputs: [
    { id: 'purchaseOrderId',  name: 'PO Resource ID',    dataType: 'string', required: true  },
    { id: 'approvalComments', name: 'Approval Comments', dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'purchaseOrderId',    name: 'PO Resource ID', dataType: 'string' },
    { id: 'purchaseOrderState', name: 'PO State',       dataType: 'string' },
    { id: 'amount',             name: 'PO Amount',      dataType: 'number' },
  ],
  config: [],
  resourceRequirements: [
    { type: 'purchase_order', access: 'write', description: 'Approves PO — human authorisation required upstream' },
  ],
};

// ── finance.claim_retention_release ──────────────────────────────────────────

export const financeClaimRetentionReleaseManifest: NodeManifestV2 = {
  type:        'finance.claim_retention_release',
  name:        'Claim Retention Release',
  version:     '1.0.0',
  description: 'Creates a RetentionRelease claim at Practical Completion or DLP expiry. Submits the claim for authoriser approval.',
  category:    'finance',
  packId:      'finance-pack',
  tags:        ['finance', 'retention', 'release', 'PAM', 'JKR', 'resource'],
  inputs: [
    { id: 'projectResourceId',          name: 'Project Resource ID',     dataType: 'string', required: true  },
    { id: 'retentionAmount',            name: 'Retention Amount (MYR)',   dataType: 'number', required: true  },
    { id: 'retentionType',              name: 'Retention Type',           dataType: 'string', required: false },
    { id: 'claimBasis',                 name: 'Claim Basis',              dataType: 'string', required: false },
    { id: 'projectCompletionDate',      name: 'CPC Date',                 dataType: 'string', required: false },
    { id: 'defectsLiabilityPeriodEnd',  name: 'DLP End Date',             dataType: 'string', required: false },
    { id: 'description',                name: 'Description',              dataType: 'string', required: false },
    { id: 'currency',                   name: 'Currency',                 dataType: 'string', required: false },
    { id: 'projectId',                  name: 'Lados Project ID',         dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'retentionId',     name: 'Retention Resource ID', dataType: 'string' },
    { id: 'retentionState',  name: 'Retention State',       dataType: 'string' },
    { id: 'retentionAmount', name: 'Retention Amount',      dataType: 'number' },
  ],
  config: [
    { key: 'retentionType', label: 'Retention Type', type: 'select', required: false, defaultValue: 'half_release',
      options: [
        { value: 'half_release',  label: 'Half Release (at CPC)' },
        { value: 'final_release', label: 'Final Release (at DLP end)' },
      ],
    },
    { key: 'currency', label: 'Currency', type: 'string', required: false, defaultValue: 'MYR' },
  ],
  resourceRequirements: [
    { type: 'retention_release', access: 'create', description: 'Creates a retention release claim record' },
  ],
};

// ── finance.process_retention_release ────────────────────────────────────────

export const financeProcessRetentionReleaseManifest: NodeManifestV2 = {
  type:        'finance.process_retention_release',
  name:        'Process Retention Release',
  version:     '1.0.0',
  description: 'Records disbursement of approved retention monies. MUST be downstream of foundation.request_approval — AI cannot release retention funds.',
  category:    'finance',
  packId:      'finance-pack',
  tags:        ['finance', 'retention', 'release', 'payment', 'guardrail'],
  inputs: [
    { id: 'retentionId',   name: 'Retention Resource ID', dataType: 'string', required: true  },
    { id: 'releaseAmount', name: 'Release Amount (MYR)',  dataType: 'number', required: true  },
    { id: 'releaseRef',    name: 'Payment Reference',     dataType: 'string', required: false },
    { id: 'releaseDate',   name: 'Release Date',          dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'retentionId',    name: 'Retention Resource ID', dataType: 'string' },
    { id: 'retentionState', name: 'Retention State',       dataType: 'string' },
    { id: 'releaseAmount',  name: 'Released Amount',       dataType: 'number' },
    { id: 'releaseRef',     name: 'Payment Reference',     dataType: 'string' },
  ],
  config: [],
  resourceRequirements: [
    { type: 'retention_release', access: 'write', description: 'Records retention disbursement — human authorisation required upstream' },
  ],
};

// ── Aggregated export ─────────────────────────────────────────────────────────

export const nodeManifests: NodeManifestV2[] = [
  financeSubmitInvoiceManifest,
  financeVerifyInvoiceManifest,
  financeApproveInvoiceManifest,
  financeProcessPaymentManifest,
  financeCreatePurchaseOrderManifest,
  financeApprovePurchaseOrderManifest,
  financeClaimRetentionReleaseManifest,
  financeProcessRetentionReleaseManifest,
];
