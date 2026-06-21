/**
 * @lados/contractor-pack
 *
 * Contractor Edition nodes for Lados — jobs, trips, fleet, fuel, invoices,
 * payments, expenses, maintenance, operators, and payroll.
 *
 * Phase 9 M1: create_job, dispatch_trip, complete_trip, upload_fuel_receipt, generate_invoice
 * Phase 9 M2: record_payment, approve_expense
 * Phase 9 M3: create_maintenance_record, clear_maintenance
 * Phase 9 M4: prepare_payroll_run, approve_payroll
 *
 * AI guardrails (non-negotiable):
 *   - contractor.upload_fuel_receipt:  AI extraction advisory only. Costs may not be
 *     posted to finance without owner/admin human approval.
 *   - contractor.generate_invoice:     Invoice must reach 'pending_approval' and be
 *     reviewed by owner/admin before sending. No AI output may advance past 'pending_approval'.
 *   - contractor.approve_expense:      Must appear downstream of foundation.request_approval.
 *     AI cannot approve expenses.
 *   - contractor.approve_payroll:      Must appear downstream of foundation.request_approval.
 *     System never initiates bank transfer. Owner marks as paid after performing transfer.
 *
 * Depends on: @lados/foundation-pack (must be active)
 */

import type { PackManifest } from '@lados/pack-sdk';
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

// ── M1 — Core Operations ──────────────────────────────────────────────────────
import { realCreateJob }                   from './nodes/contractor-create-job';
import { realDispatchTrip }                from './nodes/contractor-dispatch-trip';
import { realCompleteTrip }                from './nodes/contractor-complete-trip';
import { realUploadFuelReceipt }           from './nodes/contractor-upload-fuel-receipt';
import { realGenerateInvoice }             from './nodes/contractor-generate-invoice';

// ── M2 — Finance ─────────────────────────────────────────────────────────────
import { realRecordPayment }               from './nodes/contractor-record-payment';
import { realApproveExpense }              from './nodes/contractor-approve-expense';

// ── M3 — Fleet Maintenance ────────────────────────────────────────────────────
import { realCreateMaintenanceRecord }     from './nodes/contractor-create-maintenance-record';
import { realClearMaintenance }            from './nodes/contractor-clear-maintenance';

// ── M4 — HR / Payroll ─────────────────────────────────────────────────────────
import { realPreparePayrollRun }           from './nodes/contractor-prepare-payroll-run';
import { realApprovePayroll }              from './nodes/contractor-approve-payroll';

// ── Re-export service interfaces ──────────────────────────────────────────────
export { type IResourceService }               from './nodes/contractor-create-job';
export { type IResourceUpdateService }         from './nodes/contractor-complete-trip';
export { type IInvoiceResourceService }        from './nodes/contractor-generate-invoice';
export { type IPaymentResourceService }        from './nodes/contractor-record-payment';
export { type IExpenseApprovalService }        from './nodes/contractor-approve-expense';
export { type IMaintenanceCreateService }      from './nodes/contractor-create-maintenance-record';
export { type IMaintenanceClearService }       from './nodes/contractor-clear-maintenance';
export { type IPayrollCreateService }          from './nodes/contractor-prepare-payroll-run';
export { type IPayrollApprovalService }        from './nodes/contractor-approve-payroll';

// ── Re-export type catalogue ──────────────────────────────────────────────────
export {
  CONTRACTOR_RESOURCE_TYPES,
  CONTRACTOR_EVENTS,
  type ContractorResourceType,
  type ContractorEventType,
  type JobData,
  type TripData,
  type FuelReceiptData,
  type MaintenanceRecordData,
  type InvoiceData,
  type InvoiceLineItem,
  type PaymentData,
  type ExpenseData,
  type PayrollRunEmployee,
  type PayrollRunData,
} from './types';

// ── Pack identity ─────────────────────────────────────────────────────────────

export const PACK_ID      = 'contractor-pack' as const;
export const PACK_VERSION = '0.3.0' as const;

export const manifest: PackManifest = {
  id:          'lados.contractor-pack',
  version:     PACK_VERSION,
  displayName: 'Contractor Edition',
  description: 'Job, trip, fleet, fuel, invoicing, payments, expenses, maintenance, and payroll for civil and earth-works contractors.',
  author:      'Lados Platform',
  dependencies: ['lados.foundation-pack'],

  nodes: [
    // M1 — Core Operations
    'contractor.create_job',
    'contractor.dispatch_trip',
    'contractor.complete_trip',
    'contractor.upload_fuel_receipt',
    'contractor.generate_invoice',
    // M2 — Finance
    'contractor.record_payment',
    'contractor.approve_expense',
    // M3 — Fleet Maintenance
    'contractor.create_maintenance_record',
    'contractor.clear_maintenance',
    // M4 — HR / Payroll
    'contractor.prepare_payroll_run',
    'contractor.approve_payroll',
  ],

  // ── Resource type definitions with type-aware view configs ────────────────
  resources: [

    // ── M1 — Operations ────────────────────────────────────────────────────

    {
      type:              'job',
      displayName:       'Job',
      displayNamePlural: 'Jobs',
      icon:              '💼',
      views: {
        list: {
          primaryField:   'name',
          secondaryField: 'data.scheduledDate',
          badgeField:     'state',
          counterField:   'data.tripCount',
          mobileLayout:   'card',
        },
        inlineActions: [
          { label: 'Dispatch Trip',    node: 'contractor.dispatch_trip',    visibleInStates: ['active'],               icon: '🚛' },
          { label: 'Generate Invoice', node: 'contractor.generate_invoice', visibleInStates: ['active', 'completed'],  icon: '🧾', requiresConfirm: true },
        ],
      },
    },

    {
      type:              'trip',
      displayName:       'Trip',
      displayNamePlural: 'Trips',
      icon:              '🚛',
      views: {
        list: {
          primaryField:   'name',
          secondaryField: 'data.driverId',
          badgeField:     'state',
          mobileLayout:   'card',
        },
        inlineActions: [
          { label: 'Mark Complete', node: 'contractor.complete_trip', visibleInStates: ['pending', 'in_progress'], icon: '✅' },
        ],
      },
    },

    {
      type:              'fuel_receipt',
      displayName:       'Fuel Receipt',
      displayNamePlural: 'Fuel Receipts',
      icon:              '⛽',
      views: {
        list: {
          primaryField:   'name',
          secondaryField: 'data.stationName',
          badgeField:     'state',
          mobileLayout:   'card',
        },
        inlineActions: [
          { label: 'Approve', node: 'state.change', visibleInStates: ['pending_review'], icon: '✅', requiresConfirm: true },
          { label: 'Reject',  node: 'state.change', visibleInStates: ['pending_review'], icon: '❌', requiresConfirm: true },
        ],
      },
    },

    {
      type:              'customer',
      displayName:       'Customer',
      displayNamePlural: 'Customers',
      icon:              '🏢',
      views: {
        list: {
          primaryField:   'name',
          secondaryField: 'data.contactPhone',
          badgeField:     'state',
          mobileLayout:   'card',
        },
      },
    },

    {
      type:              'vehicle',
      displayName:       'Vehicle',
      displayNamePlural: 'Vehicles',
      icon:              '🚛',
      views: {
        list: {
          primaryField:   'name',
          secondaryField: 'data.plateNumber',
          badgeField:     'state',
          mobileLayout:   'card',
        },
        inlineActions: [
          { label: 'Send for Service', node: 'contractor.create_maintenance_record', visibleInStates: ['available', 'deployed'], icon: '🔧' },
        ],
      },
    },

    {
      type:              'driver',
      displayName:       'Driver',
      displayNamePlural: 'Drivers',
      icon:              '👤',
      views: {
        list: {
          primaryField:   'name',
          secondaryField: 'data.licenseNumber',
          badgeField:     'state',
          mobileLayout:   'card',
        },
      },
    },

    {
      type:              'equipment',
      displayName:       'Equipment',
      displayNamePlural: 'Equipment',
      icon:              '🏗️',
      views: {
        list: {
          primaryField:   'name',
          secondaryField: 'data.serialNumber',
          badgeField:     'state',
          mobileLayout:   'card',
        },
        inlineActions: [
          { label: 'Send for Service', node: 'contractor.create_maintenance_record', visibleInStates: ['available', 'deployed'], icon: '🔧' },
        ],
      },
    },

    {
      type:              'operator',
      displayName:       'Operator',
      displayNamePlural: 'Operators',
      icon:              '⛑️',
      views: {
        list: {
          primaryField:   'name',
          secondaryField: 'data.licenseClass',
          badgeField:     'state',
          mobileLayout:   'card',
        },
      },
    },

    // ── M2 — Finance ───────────────────────────────────────────────────────

    {
      type:              'invoice',
      displayName:       'Invoice',
      displayNamePlural: 'Invoices',
      icon:              '🧾',
      views: {
        list: {
          primaryField:   'name',
          secondaryField: 'data.total',
          badgeField:     'state',
          mobileLayout:   'card',
        },
        inlineActions: [
          { label: 'Submit for Approval', node: 'state.change',              visibleInStates: ['draft'],     icon: '📤' },
          { label: 'Record Payment',      node: 'contractor.record_payment', visibleInStates: ['approved'],  icon: '💳', requiresConfirm: true },
        ],
      },
    },

    {
      type:              'payment',
      displayName:       'Payment',
      displayNamePlural: 'Payments',
      icon:              '💳',
      views: {
        list: {
          primaryField:   'name',
          secondaryField: 'data.amount',
          badgeField:     'state',
          mobileLayout:   'card',
        },
        inlineActions: [
          { label: 'Reconcile', node: 'state.change', visibleInStates: ['recorded'], icon: '✅', requiresConfirm: true },
        ],
      },
    },

    {
      type:              'expense',
      displayName:       'Expense',
      displayNamePlural: 'Expenses',
      icon:              '💸',
      views: {
        list: {
          primaryField:   'name',
          secondaryField: 'data.amount',
          badgeField:     'state',
          mobileLayout:   'card',
        },
        inlineActions: [
          { label: 'Submit',  node: 'state.change',               visibleInStates: ['draft'],            icon: '📤' },
          { label: 'Approve', node: 'contractor.approve_expense',  visibleInStates: ['pending_approval'], icon: '✅', requiresConfirm: true },
          { label: 'Reject',  node: 'state.change',               visibleInStates: ['pending_approval'], icon: '❌', requiresConfirm: true },
        ],
      },
    },

    // ── M3 — Maintenance ───────────────────────────────────────────────────

    {
      type:              'maintenance_record',
      displayName:       'Maintenance Record',
      displayNamePlural: 'Maintenance Records',
      icon:              '🔧',
      views: {
        list: {
          primaryField:   'name',
          secondaryField: 'data.workshop',
          badgeField:     'state',
          mobileLayout:   'card',
        },
        inlineActions: [
          { label: 'Start Service',    node: 'state.change',                visibleInStates: ['scheduled'],   icon: '▶️' },
          { label: 'Complete Service', node: 'contractor.clear_maintenance', visibleInStates: ['in_progress'], icon: '✅', requiresConfirm: true },
        ],
      },
    },

    // ── M4 — HR / Payroll ─────────────────────────────────────────────────

    {
      type:              'payroll_run',
      displayName:       'Payroll Run',
      displayNamePlural: 'Payroll Runs',
      icon:              '👥',
      views: {
        list: {
          primaryField:   'name',
          secondaryField: 'data.totalGross',
          badgeField:     'state',
          counterField:   'data.employees.length',
          mobileLayout:   'card',
        },
        inlineActions: [
          { label: 'Submit for Review', node: 'state.change',               visibleInStates: ['draft'],          icon: '📤' },
          { label: 'Approve',           node: 'contractor.approve_payroll',  visibleInStates: ['pending_review'], icon: '✅', requiresConfirm: true },
          { label: 'Mark as Paid',      node: 'state.change',               visibleInStates: ['approved'],       icon: '💰', requiresConfirm: true },
        ],
      },
    },
  ],

  // ── Workflow templates ────────────────────────────────────────────────────
  workflowTemplates: [
    // M1
    'workflow_templates/job-creation.json',
    'workflow_templates/trip-dispatch.json',
    'workflow_templates/invoice-generation.json',
    // M2
    'workflow_templates/finance.record-payment.json',
    'workflow_templates/finance.approve-expense.json',
    // M3
    'workflow_templates/fleet.request-maintenance.json',
    'workflow_templates/fleet.complete-maintenance.json',
    // M4
    'workflow_templates/payroll.prepare-run.json',
    'workflow_templates/payroll.approve-and-pay.json',
  ],
};

// ── Service bag ───────────────────────────────────────────────────────────────

export interface ContractorPackServices {
  resourceService?: import('./nodes/contractor-create-job').IResourceService
                  & import('./nodes/contractor-complete-trip').IResourceUpdateService
                  & import('./nodes/contractor-generate-invoice').IInvoiceResourceService
                  & import('./nodes/contractor-record-payment').IPaymentResourceService
                  & import('./nodes/contractor-approve-expense').IExpenseApprovalService
                  & import('./nodes/contractor-create-maintenance-record').IMaintenanceCreateService
                  & import('./nodes/contractor-clear-maintenance').IMaintenanceClearService
                  & import('./nodes/contractor-prepare-payroll-run').IPayrollCreateService
                  & import('./nodes/contractor-approve-payroll').IPayrollApprovalService;
}

// ── Node resolver ─────────────────────────────────────────────────────────────

type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

const NO_SERVICE = (code: string, message: string): NodeExecuteResult => ({
  status:  'failure',
  outputs: {},
  error:   { code, message },
});

export function resolveNode(
  services: ContractorPackServices = {},
): (nodeType: string) => NodeExecutor | null {
  const { resourceService } = services;

  const nodes: Record<string, NodeExecutor> = {

    // M1 — Core Operations
    'contractor.create_job': (ctx) =>
      resourceService
        ? realCreateJob(ctx, resourceService)
        : Promise.resolve(NO_SERVICE('NO_SERVICE', 'ResourceService not injected')),

    'contractor.dispatch_trip': (ctx) =>
      resourceService
        ? realDispatchTrip(ctx, resourceService)
        : Promise.resolve(NO_SERVICE('NO_SERVICE', 'ResourceService not injected')),

    'contractor.complete_trip': (ctx) =>
      resourceService
        ? realCompleteTrip(ctx, resourceService)
        : Promise.resolve(NO_SERVICE('NO_SERVICE', 'ResourceService not injected')),

    'contractor.upload_fuel_receipt': (ctx) =>
      resourceService
        ? realUploadFuelReceipt(ctx, resourceService)
        : Promise.resolve(NO_SERVICE('NO_SERVICE', 'ResourceService not injected')),

    'contractor.generate_invoice': (ctx) =>
      resourceService
        ? realGenerateInvoice(ctx, resourceService as import('./nodes/contractor-generate-invoice').IInvoiceResourceService)
        : Promise.resolve(NO_SERVICE('NO_SERVICE', 'ResourceService not injected')),

    // M2 — Finance
    'contractor.record_payment': (ctx) =>
      resourceService
        ? realRecordPayment(ctx, resourceService)
        : Promise.resolve(NO_SERVICE('NO_SERVICE', 'ResourceService not injected')),

    'contractor.approve_expense': (ctx) =>
      resourceService
        ? realApproveExpense(ctx, resourceService)
        : Promise.resolve(NO_SERVICE('NO_SERVICE', 'ResourceService not injected')),

    // M3 — Fleet Maintenance
    'contractor.create_maintenance_record': (ctx) =>
      resourceService
        ? realCreateMaintenanceRecord(ctx, resourceService)
        : Promise.resolve(NO_SERVICE('NO_SERVICE', 'ResourceService not injected')),

    'contractor.clear_maintenance': (ctx) =>
      resourceService
        ? realClearMaintenance(ctx, resourceService)
        : Promise.resolve(NO_SERVICE('NO_SERVICE', 'ResourceService not injected')),

    // M4 — HR / Payroll
    'contractor.prepare_payroll_run': (ctx) =>
      resourceService
        ? realPreparePayrollRun(ctx, resourceService)
        : Promise.resolve(NO_SERVICE('NO_SERVICE', 'ResourceService not injected')),

    'contractor.approve_payroll': (ctx) =>
      resourceService
        ? realApprovePayroll(ctx, resourceService)
        : Promise.resolve(NO_SERVICE('NO_SERVICE', 'ResourceService not injected')),
  };

  return (nodeType: string) => nodes[nodeType] ?? null;
}
