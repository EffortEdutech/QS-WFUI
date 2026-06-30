/**
 * construction.submit_inspection_report
 *
 * Records findings for an in-progress site inspection and transitions
 * it to 'completed' (pass/conditional) or 'failed'.
 *
 * Inputs:
 *   inspectionId   — site_inspection resource ID (required)
 *   overallResult  — 'pass' | 'fail' | 'conditional' (required)
 *   findings       — array of InspectionFinding objects (optional)
 *   defectCount    — count of defects found (optional; auto-counted from findings if omitted)
 *   remarks        — summary remarks (optional)
 *   photoUrls      — array of photo URLs (optional)
 *
 * Outputs:
 *   inspectionId    — same inspection ID (pass-through)
 *   overallResult   — 'pass' | 'fail' | 'conditional'
 *   defectCount     — number of defects found
 *   inspectionState — final state ('completed' or 'failed')
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { IConstructionResourceService, InspectionFinding } from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realSubmitInspectionReport(
  ctx: NodeContext,
  resourceService?: IConstructionResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const inspectionId  = (inp['inspectionId']  ?? cfg['inspectionId'])  as string | undefined;
  const overallResult = (inp['overallResult'] ?? cfg['overallResult']) as 'pass' | 'fail' | 'conditional' | undefined;
  const findings      = (inp['findings']      ?? cfg['findings'])      as InspectionFinding[] | undefined;
  const defectCount   = (inp['defectCount']   ?? cfg['defectCount'])   as number | undefined;
  const remarks       = (inp['remarks']       ?? cfg['remarks'])       as string | undefined;
  const photoUrls     = (inp['photoUrls']     ?? cfg['photoUrls'])     as string[] | undefined;

  if (!inspectionId)  return err('construction.submit_inspection_report: inspectionId is required');
  if (!overallResult) return err('construction.submit_inspection_report: overallResult is required');
  if (!['pass', 'fail', 'conditional'].includes(overallResult)) {
    return err('construction.submit_inspection_report: overallResult must be pass, fail, or conditional');
  }
  if (!ctx.organizationId) return err('construction.submit_inspection_report: organizationId missing from context');
  if (!resourceService)  return err('construction.submit_inspection_report: resourceService not injected');

  const inspection = await resourceService.findById(inspectionId, ctx.organizationId);
  if (!inspection) {
    return {
      status: 'failure', outputs: {},
      error: { code: 'NOT_FOUND', message: `Inspection ${inspectionId} not found` },
    };
  }

  const now        = new Date().toISOString();
  const autoCount  = findings?.filter((f) => !f.rectified).length ?? 0;
  const finalCount = defectCount ?? autoCount;
  const targetState: string = overallResult === 'fail' ? 'failed' : 'completed';

  const updatedData: Record<string, unknown> = {
    ...inspection.data,
    findings:      findings ?? [],
    overallResult,
    defectCount:   finalCount,
    ...(remarks    ? { remarks }    : {}),
    ...(photoUrls  ? { photoUrls }  : {}),
    completedAt:   now,
  };

  await resourceService.updateResource(
    inspectionId, ctx.organizationId,
    { data: updatedData },
    ctx.userId,
  );

  // Advance state: scheduled → in_progress → completed|failed
  let currentState = inspection.state;
  if (currentState === 'scheduled') {
    await resourceService.transitionState(inspectionId, ctx.organizationId, 'in_progress', ctx.userId);
    currentState = 'in_progress';
  }

  const finalInspection = await resourceService.transitionState(
    inspectionId, ctx.organizationId, targetState, ctx.userId,
  );

  ctx.logger.info(
    `[construction.submit_inspection_report] Inspection ${inspectionId} → ${finalInspection.state} ` +
    `(result=${overallResult}, defects=${finalCount})`,
  );

  return {
    status: 'success',
    outputs: {
      inspectionId,
      overallResult,
      defectCount:    finalCount,
      inspectionState: finalInspection.state,
    },
  };
}
