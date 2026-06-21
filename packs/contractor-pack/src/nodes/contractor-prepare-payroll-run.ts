/**
 * contractor.prepare_payroll_run  (M4 — HR / Payroll)
 *
 * Creates a PayrollRun resource for a given pay period.
 * Computes gross pay per employee: dailyRate × daysWorked.
 * Lands in 'draft' state — must be submitted for owner review.
 *
 * AI guardrail: computation is arithmetic only. AI cannot decide who gets
 * paid or how much. Payroll must be reviewed and approved by owner before
 * any payment action.
 *
 * Inputs:
 *   periodStart — ISO date for pay period start (required)
 *   periodEnd   — ISO date for pay period end (required)
 *   employees   — array of { employeeId, name, dailyRate, daysWorked } (required)
 *   notes       — notes (optional)
 *
 * Outputs:
 *   payrollRunId    — created PayrollRun resource ID
 *   payrollRunState — 'draft'
 *   totalGross      — sum of all employee gross pay
 *   employeeCount   — number of employees in this run
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { PayrollRunData, PayrollRunEmployee } from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export interface IPayrollCreateService {
  create(params: {
    orgId:      string;
    type:       string;
    name:       string;
    data?:      Record<string, unknown>;
    createdBy?: string;
  }): Promise<{ id: string; state: string }>;
}

export async function realPreparePayrollRun(
  ctx: NodeContext,
  resourceService?: IPayrollCreateService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;

  const periodStart = (inp['periodStart'] as string | undefined) ?? (ctx.config['periodStart'] as string | undefined);
  const periodEnd   = (inp['periodEnd']   as string | undefined) ?? (ctx.config['periodEnd']   as string | undefined);
  const employeesRaw = (inp['employees']  as unknown[] | undefined) ?? (ctx.config['employees'] as unknown[] | undefined);
  const notes       = (inp['notes']       as string | undefined) ?? (ctx.config['notes']       as string | undefined);

  if (!periodStart)        return err('contractor.prepare_payroll_run: periodStart is required');
  if (!periodEnd)          return err('contractor.prepare_payroll_run: periodEnd is required');
  if (!employeesRaw || !Array.isArray(employeesRaw) || employeesRaw.length === 0)
    return err('contractor.prepare_payroll_run: employees array is required and must not be empty');
  if (!ctx.organizationId) return err('contractor.prepare_payroll_run: organizationId missing from context');
  if (!resourceService)    return err('contractor.prepare_payroll_run: resourceService not injected');

  // Compute gross pay per employee
  const employees: PayrollRunEmployee[] = (employeesRaw as Record<string, unknown>[]).map((e) => {
    const dailyRate  = Number(e['dailyRate']  ?? 0);
    const daysWorked = Number(e['daysWorked'] ?? 0);
    const grossPay   = Math.round(dailyRate * daysWorked * 100) / 100;
    return {
      employeeId: String(e['employeeId'] ?? ''),
      name:       String(e['name']       ?? ''),
      dailyRate,
      daysWorked,
      grossPay,
      netPay: grossPay, // deductions applied by owner during review
    };
  });

  const totalGross = Math.round(employees.reduce((sum, e) => sum + e.grossPay, 0) * 100) / 100;

  const data: PayrollRunData = {
    periodStart,
    periodEnd,
    employees,
    totalGross,
    ...(notes ? { notes } : {}),
  };

  const run = await resourceService.create({
    orgId:     ctx.organizationId,
    type:      'payroll_run',
    name:      `Payroll Run ${periodStart} – ${periodEnd}`,
    data:      data as unknown as Record<string, unknown>,
    createdBy: ctx.userId,
  });

  return {
    status: 'success',
    outputs: {
      payrollRunId:    run.id,
      payrollRunState: run.state,
      totalGross,
      employeeCount:   employees.length,
    },
  };
}
