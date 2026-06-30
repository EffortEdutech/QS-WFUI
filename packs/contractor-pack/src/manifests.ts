/**
 * @lados/contractor-pack — NodeManifestV2 declarations (Phase 1F)
 *
 * AI guardrails (non-negotiable — applies to ALL contractor nodes):
 *   - AI extraction is advisory only
 *   - No AI output may approve, certify, or commit financial/contractual facts
 *   - Human approval required before any consequential action
 */

import type { NodeManifestV2 } from '@lados/node-sdk';

const PACK_ID = 'contractor-pack';

// ── contractor.create_job ─────────────────────────────────────────────────────

export const contractorCreateJobManifest: NodeManifestV2 = {
  type:        'contractor.create_job',
  name:        'Create Job',
  version:     '1.0.0',
  description: 'Creates a Job resource for a contractor organisation and optionally links it to a Customer.',
  category:    'resource',
  packId:      PACK_ID,
  tags:        ['contractor', 'job', 'create'],
  inputs: [
    { id: 'title',         name: 'Title',          dataType: 'string', required: true  },
    { id: 'customerId',    name: 'Customer ID',    dataType: 'string', required: false },
    { id: 'description',   name: 'Description',    dataType: 'string', required: false },
    { id: 'scheduledDate', name: 'Scheduled Date', dataType: 'string', required: false },
    { id: 'projectId',     name: 'Project ID',     dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'jobId',    name: 'Job ID',    dataType: 'string' },
    { id: 'jobState', name: 'Job State', dataType: 'string' },
  ],
  config: [
    { key: 'title',         label: 'Title',          type: 'string',  required: false },
    { key: 'customerId',    label: 'Customer ID',    type: 'string',  required: false },
    { key: 'description',   label: 'Description',    type: 'textarea', required: false },
    { key: 'scheduledDate', label: 'Scheduled Date', type: 'string',  required: false, description: 'ISO 8601 date.' },
  ],
  resourceRequirements: [{ type: 'job', access: 'create' }],
};

// ── contractor.dispatch_trip ──────────────────────────────────────────────────

export const contractorDispatchTripManifest: NodeManifestV2 = {
  type:        'contractor.dispatch_trip',
  name:        'Dispatch Trip',
  version:     '1.0.0',
  description: 'Creates a Trip resource under a Job and assigns vehicle + driver.',
  category:    'resource',
  packId:      PACK_ID,
  tags:        ['contractor', 'trip', 'dispatch', 'fleet'],
  inputs: [
    { id: 'jobId',         name: 'Job ID',         dataType: 'string', required: true  },
    { id: 'vehicleId',     name: 'Vehicle ID',     dataType: 'string', required: true  },
    { id: 'driverId',      name: 'Driver ID',      dataType: 'string', required: true  },
    { id: 'scheduledDate', name: 'Scheduled Date', dataType: 'string', required: false },
    { id: 'notes',         name: 'Notes',          dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'tripId',    name: 'Trip ID',    dataType: 'string' },
    { id: 'tripState', name: 'Trip State', dataType: 'string' },
  ],
  config: [
    { key: 'jobId',     label: 'Job ID',     type: 'string', required: false },
    { key: 'vehicleId', label: 'Vehicle ID', type: 'string', required: false, ui: { key: 'vehicleId', widget: 'resource-picker', resourceType: 'vehicle' } },
    { key: 'driverId',  label: 'Driver ID',  type: 'string', required: false, ui: { key: 'driverId',  widget: 'resource-picker', resourceType: 'driver'  } },
  ],
  resourceRequirements: [
    { type: 'trip',    access: 'create' },
    { type: 'vehicle', access: 'read'   },
    { type: 'driver',  access: 'read'   },
  ],
  events: [{ eventType: 'trip.dispatched', description: 'Emitted when a trip is successfully created.' }],
};

// ── contractor.complete_trip ──────────────────────────────────────────────────

export const contractorCompleteTripManifest: NodeManifestV2 = {
  type:        'contractor.complete_trip',
  name:        'Complete Trip',
  version:     '1.0.0',
  description: 'Transitions a Trip from in_progress → completed and records odometer/distance.',
  category:    'resource',
  packId:      PACK_ID,
  tags:        ['contractor', 'trip', 'complete', 'fleet'],
  inputs: [
    { id: 'tripId',      name: 'Trip ID',      dataType: 'string', required: true  },
    { id: 'odometerEnd', name: 'Odometer End', dataType: 'number', required: false },
    { id: 'completedKm', name: 'Completed Km', dataType: 'number', required: false },
    { id: 'notes',       name: 'Notes',        dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'tripId',    name: 'Trip ID',    dataType: 'string' },
    { id: 'tripState', name: 'Trip State', dataType: 'string' },
  ],
  config: [
    { key: 'tripId', label: 'Trip ID', type: 'string', required: false },
  ],
  resourceRequirements: [{ type: 'trip', access: 'write' }],
  events: [{ eventType: 'trip.completed', description: 'Emitted when a trip is marked as completed.' }],
};

// ── contractor.upload_fuel_receipt ────────────────────────────────────────────

export const contractorUploadFuelReceiptManifest: NodeManifestV2 = {
  type:        'contractor.upload_fuel_receipt',
  name:        'Upload Fuel Receipt',
  version:     '1.0.0',
  description: 'Creates a FuelReceipt resource from an uploaded file URL. Lands in pending_review state. AI extraction advisory only — human approval required before any financial posting.',
  category:    'resource',
  packId:      PACK_ID,
  tags:        ['contractor', 'fuel', 'receipt', 'upload'],
  inputs: [
    { id: 'vehicleId',   name: 'Vehicle ID',   dataType: 'string', required: true  },
    { id: 'fileUrl',     name: 'File URL',     dataType: 'string', required: true  },
    { id: 'amount',      name: 'Amount',       dataType: 'number', required: false },
    { id: 'liters',      name: 'Liters',       dataType: 'number', required: false },
    { id: 'stationName', name: 'Station Name', dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'receiptId',    name: 'Receipt ID',    dataType: 'string' },
    { id: 'receiptState', name: 'Receipt State', dataType: 'string' },
  ],
  config: [
    { key: 'vehicleId', label: 'Vehicle ID', type: 'string', required: false, ui: { key: 'vehicleId', widget: 'resource-picker', resourceType: 'vehicle' } },
  ],
  resourceRequirements: [{ type: 'fuel_receipt', access: 'create' }],
  events: [{ eventType: 'fuel_receipt.uploaded', description: 'Emitted when a fuel receipt is uploaded.' }],
};

// ── contractor.generate_invoice ───────────────────────────────────────────────

export const contractorGenerateInvoiceManifest: NodeManifestV2 = {
  type:        'contractor.generate_invoice',
  name:        'Generate Invoice',
  version:     '1.0.0',
  description: 'Creates an Invoice resource for a completed Job in pending_approval state. Invoice cannot be sent until owner/admin explicitly approves it.',
  category:    'finance',
  packId:      PACK_ID,
  tags:        ['contractor', 'invoice', 'finance'],
  inputs: [
    { id: 'jobId',      name: 'Job ID',      dataType: 'string', required: true  },
    { id: 'customerId', name: 'Customer ID', dataType: 'string', required: false },
    { id: 'lineItems',  name: 'Line Items',  dataType: 'array',  required: false },
    { id: 'notes',      name: 'Notes',       dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'invoiceId',    name: 'Invoice ID',    dataType: 'string' },
    { id: 'invoiceState', name: 'Invoice State', dataType: 'string' },
  ],
  config: [
    { key: 'jobId', label: 'Job ID', type: 'string', required: false, ui: { key: 'jobId', widget: 'resource-picker', resourceType: 'job' } },
  ],
  resourceRequirements: [
    { type: 'invoice', access: 'create' },
    { type: 'job',     access: 'read'   },
  ],
};

// ── contractor.record_payment ─────────────────────────────────────────────────

export const contractorRecordPaymentManifest: NodeManifestV2 = {
  type:        'contractor.record_payment',
  name:        'Record Payment',
  version:     '1.0.0',
  description: 'Records a payment received against an Invoice. System never initiates bank transfer — owner records what was received.',
  category:    'finance',
  packId:      PACK_ID,
  tags:        ['contractor', 'payment', 'finance', 'invoice'],
  inputs: [
    { id: 'invoiceId', name: 'Invoice ID', dataType: 'string', required: true  },
    { id: 'amount',    name: 'Amount',     dataType: 'number', required: true  },
    { id: 'method',    name: 'Method',     dataType: 'string', required: false },
    { id: 'reference', name: 'Reference',  dataType: 'string', required: false },
    { id: 'notes',     name: 'Notes',      dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'paymentId',    name: 'Payment ID',    dataType: 'string' },
    { id: 'paymentState', name: 'Payment State', dataType: 'string' },
    { id: 'invoiceState', name: 'Invoice State', dataType: 'string' },
  ],
  config: [
    { key: 'invoiceId', label: 'Invoice ID', type: 'string', required: false },
    { key: 'method',    label: 'Method',     type: 'select', required: false, defaultValue: 'bank_transfer',
      options: [
        { value: 'bank_transfer', label: 'Bank Transfer' },
        { value: 'cash',          label: 'Cash' },
        { value: 'cheque',        label: 'Cheque' },
        { value: 'online',        label: 'Online' },
      ] },
  ],
  resourceRequirements: [
    { type: 'payment', access: 'create' },
    { type: 'invoice', access: 'write'  },
  ],
};

// ── contractor.approve_expense ────────────────────────────────────────────────

export const contractorApproveExpenseManifest: NodeManifestV2 = {
  type:        'contractor.approve_expense',
  name:        'Approve Expense',
  version:     '1.0.0',
  description: 'Transitions an Expense to approved. Must appear downstream of foundation.request_approval. AI cannot approve expenses.',
  category:    'finance',
  packId:      PACK_ID,
  tags:        ['contractor', 'expense', 'approve', 'finance'],
  inputs: [
    { id: 'expenseId', name: 'Expense ID', dataType: 'string', required: true  },
    { id: 'notes',     name: 'Notes',      dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'expenseId',    name: 'Expense ID',    dataType: 'string' },
    { id: 'expenseState', name: 'Expense State', dataType: 'string' },
  ],
  config: [
    { key: 'expenseId', label: 'Expense ID', type: 'string', required: false },
  ],
  resourceRequirements: [{ type: 'expense', access: 'write' }],
};

// ── contractor.create_maintenance_record ──────────────────────────────────────

export const contractorCreateMaintenanceRecordManifest: NodeManifestV2 = {
  type:        'contractor.create_maintenance_record',
  name:        'Create Maintenance Record',
  version:     '1.0.0',
  description: 'Creates a MaintenanceRecord for a vehicle or equipment asset and transitions the asset to maintenance state.',
  category:    'resource',
  packId:      PACK_ID,
  tags:        ['contractor', 'maintenance', 'fleet', 'create'],
  inputs: [
    { id: 'assetId',       name: 'Asset ID',       dataType: 'string', required: true  },
    { id: 'assetType',     name: 'Asset Type',     dataType: 'string', required: true  },
    { id: 'description',   name: 'Description',    dataType: 'string', required: true  },
    { id: 'scheduledDate', name: 'Scheduled Date', dataType: 'string', required: false },
    { id: 'workshop',      name: 'Workshop',       dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'maintenanceRecordId', name: 'Maintenance Record ID', dataType: 'string' },
    { id: 'maintenanceState',    name: 'Maintenance State',     dataType: 'string' },
    { id: 'assetState',          name: 'Asset State',           dataType: 'string' },
  ],
  config: [
    { key: 'assetId',   label: 'Asset ID',   type: 'string', required: false },
    { key: 'assetType', label: 'Asset Type', type: 'select', required: false,
      options: [{ value: 'vehicle', label: 'Vehicle' }, { value: 'equipment', label: 'Equipment' }] },
  ],
  resourceRequirements: [
    { type: 'maintenance_record', access: 'create' },
    { type: 'vehicle',            access: 'write'  },
    { type: 'equipment',          access: 'write'  },
  ],
};

// ── contractor.clear_maintenance ──────────────────────────────────────────────

export const contractorClearMaintenanceManifest: NodeManifestV2 = {
  type:        'contractor.clear_maintenance',
  name:        'Clear Maintenance',
  version:     '1.0.0',
  description: 'Marks a MaintenanceRecord as completed and returns the asset to available state.',
  category:    'resource',
  packId:      PACK_ID,
  tags:        ['contractor', 'maintenance', 'fleet', 'complete'],
  inputs: [
    { id: 'maintenanceRecordId', name: 'Maintenance Record ID', dataType: 'string', required: true  },
    { id: 'completionNotes',     name: 'Completion Notes',      dataType: 'string', required: false },
    { id: 'cost',                name: 'Cost',                  dataType: 'number', required: false },
  ],
  outputs: [
    { id: 'maintenanceRecordId', name: 'Maintenance Record ID', dataType: 'string' },
    { id: 'maintenanceState',    name: 'Maintenance State',     dataType: 'string' },
    { id: 'assetId',             name: 'Asset ID',              dataType: 'string' },
    { id: 'assetState',          name: 'Asset State',           dataType: 'string' },
  ],
  config: [
    { key: 'maintenanceRecordId', label: 'Maintenance Record ID', type: 'string', required: false },
  ],
  resourceRequirements: [
    { type: 'maintenance_record', access: 'write' },
    { type: 'vehicle',            access: 'write' },
    { type: 'equipment',          access: 'write' },
  ],
};

// ── contractor.prepare_payroll_run ────────────────────────────────────────────

export const contractorPreparePayrollRunManifest: NodeManifestV2 = {
  type:        'contractor.prepare_payroll_run',
  name:        'Prepare Payroll Run',
  version:     '1.0.0',
  description: 'Creates a PayrollRun resource in draft state. Computes gross pay per employee. Must be reviewed and approved by owner before any payment action.',
  category:    'finance',
  packId:      PACK_ID,
  tags:        ['contractor', 'payroll', 'hr', 'finance'],
  inputs: [
    { id: 'periodStart', name: 'Period Start', dataType: 'string', required: true  },
    { id: 'periodEnd',   name: 'Period End',   dataType: 'string', required: true  },
    { id: 'employees',   name: 'Employees',    dataType: 'array',  required: true  },
    { id: 'notes',       name: 'Notes',        dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'payrollRunId',    name: 'Payroll Run ID',    dataType: 'string' },
    { id: 'payrollRunState', name: 'Payroll Run State', dataType: 'string' },
    { id: 'totalGross',      name: 'Total Gross',       dataType: 'number' },
    { id: 'employeeCount',   name: 'Employee Count',    dataType: 'number' },
  ],
  config: [
    { key: 'periodStart', label: 'Period Start', type: 'string', required: false, description: 'ISO 8601 date.' },
    { key: 'periodEnd',   label: 'Period End',   type: 'string', required: false, description: 'ISO 8601 date.' },
  ],
  resourceRequirements: [{ type: 'payroll_run', access: 'create' }],
};

// ── contractor.approve_payroll ────────────────────────────────────────────────

export const contractorApprovePayrollManifest: NodeManifestV2 = {
  type:        'contractor.approve_payroll',
  name:        'Approve Payroll',
  version:     '1.0.0',
  description: 'Transitions a PayrollRun to approved. Must appear downstream of foundation.request_approval. System never initiates bank transfer.',
  category:    'finance',
  packId:      PACK_ID,
  tags:        ['contractor', 'payroll', 'approve', 'hr'],
  inputs: [
    { id: 'payrollRunId', name: 'Payroll Run ID', dataType: 'string', required: true  },
    { id: 'notes',        name: 'Notes',          dataType: 'string', required: false },
  ],
  outputs: [
    { id: 'payrollRunId',    name: 'Payroll Run ID',    dataType: 'string' },
    { id: 'payrollRunState', name: 'Payroll Run State', dataType: 'string' },
  ],
  config: [
    { key: 'payrollRunId', label: 'Payroll Run ID', type: 'string', required: false },
  ],
  resourceRequirements: [{ type: 'payroll_run', access: 'write' }],
};

// ── contractor.extract_fuel_data ──────────────────────────────────────────────

export const contractorExtractFuelDataManifest: NodeManifestV2 = {
  type:        'contractor.extract_fuel_data',
  name:        'Extract Fuel Data',
  version:     '1.0.0',
  description: 'Uses GPT-4o vision to extract data from a fuel receipt image. All values are ADVISORY ONLY — human approval required before any financial posting.',
  category:    'ai',
  packId:      PACK_ID,
  tags:        ['contractor', 'fuel', 'ai', 'vision', 'extract'],
  inputs: [
    { id: 'receiptId', name: 'Receipt ID', dataType: 'string', required: true },
  ],
  outputs: [
    { id: 'receiptId',   name: 'Receipt ID',   dataType: 'string' },
    { id: 'amount',      name: 'Amount',       dataType: 'number' },
    { id: 'liters',      name: 'Liters',       dataType: 'number' },
    { id: 'fuelType',    name: 'Fuel Type',    dataType: 'string' },
    { id: 'stationName', name: 'Station Name', dataType: 'string' },
    { id: 'receiptDate', name: 'Receipt Date', dataType: 'string' },
    { id: 'vehicleReg',  name: 'Vehicle Reg',  dataType: 'string' },
    { id: 'confidence',  name: 'Confidence',   dataType: 'number' },
    { id: 'aiExtracted', name: 'AI Extracted', dataType: 'object' },
    { id: 'warning',     name: 'Warning',      dataType: 'string' },
  ],
  config: [],
  resourceRequirements: [
    { type: 'fuel_receipt', access: 'write', description: 'Writes aiExtracted advisory fields to the receipt resource.' },
  ],
};

// ── Collected manifest array ──────────────────────────────────────────────────

export const nodeManifests: NodeManifestV2[] = [
  contractorCreateJobManifest,
  contractorDispatchTripManifest,
  contractorCompleteTripManifest,
  contractorUploadFuelReceiptManifest,
  contractorGenerateInvoiceManifest,
  contractorRecordPaymentManifest,
  contractorApproveExpenseManifest,
  contractorCreateMaintenanceRecordManifest,
  contractorClearMaintenanceManifest,
  contractorPreparePayrollRunManifest,
  contractorApprovePayrollManifest,
  contractorExtractFuelDataManifest,
];
