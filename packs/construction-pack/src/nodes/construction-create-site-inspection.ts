/**
 * construction.create_site_inspection
 *
 * Creates a SiteInspection resource linked to a ConstructionProject.
 * Initial state is 'scheduled'.
 *
 * Inputs:
 *   projectResourceId — construction_project resource ID (required)
 *   inspectionType    — pre-concrete | structural | finishes | mep | final | general (required)
 *   scheduledDate     — ISO 8601 scheduled inspection date (optional)
 *   inspector         — inspector user ID (optional)
 *   inspectorName     — inspector display name (optional)
 *   notes             — pre-inspection notes (optional)
 *   projectId         — Lados project to attach to (optional)
 *
 * Outputs:
 *   inspectionId     — created site_inspection resource ID
 *   inspectionState  — initial state ('scheduled')
 *   inspectionType   — pass-through
 *   scheduledDate    — pass-through
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { IConstructionResourceService, SiteInspectionData } from '../types';

const VALID_TYPES = ['pre-concrete', 'structural', 'finishes', 'mep', 'final', 'general'];

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realCreateSiteInspection(
  ctx: NodeContext,
  resourceService?: IConstructionResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const projectResourceId = (inp['projectResourceId'] ?? cfg['projectResourceId']) as string | undefined;
  const inspectionType    = (inp['inspectionType']    ?? cfg['inspectionType'])    as string | undefined;
  const scheduledDate     = (inp['scheduledDate']     ?? cfg['scheduledDate'])     as string | undefined;
  const inspector         = (inp['inspector']         ?? cfg['inspector'])         as string | undefined;
  const inspectorName     = (inp['inspectorName']     ?? cfg['inspectorName'])     as string | undefined;
  const notes             = (inp['notes']             ?? cfg['notes'])             as string | undefined;
  const projectId         = (inp['projectId']         ?? cfg['projectId'])         as string | undefined;

  if (!projectResourceId) return err('construction.create_site_inspection: projectResourceId is required');
  if (!inspectionType)    return err('construction.create_site_inspection: inspectionType is required');
  if (!ctx.organizationId) return err('construction.create_site_inspection: organizationId missing from context');
  if (!resourceService)   return err('construction.create_site_inspection: resourceService not injected');

  if (!VALID_TYPES.includes(inspectionType)) {
    return err(
      `construction.create_site_inspection: invalid inspectionType "${inspectionType}". ` +
      `Must be one of: ${VALID_TYPES.join(', ')}`,
    );
  }

  const label = `${inspectionType.charAt(0).toUpperCase() + inspectionType.slice(1)} Inspection` +
    (scheduledDate ? ` — ${scheduledDate.substring(0, 10)}` : '');

  const data: SiteInspectionData = {
    projectResourceId,
    inspectionType,
    ...(scheduledDate  ? { scheduledDate }  : {}),
    ...(inspector      ? { inspector }      : {}),
    ...(inspectorName  ? { inspectorName }  : {}),
    ...(notes          ? { notes }          : {}),
  };

  const resource = await resourceService.create({
    orgId:     ctx.organizationId,
    type:      'site_inspection',
    name:      label,
    data:      data as unknown as Record<string, unknown>,
    parentId:  projectResourceId,
    ...(projectId ? { projectId } : {}),
    createdBy: ctx.userId,
  });

  ctx.logger.info(
    `[construction.create_site_inspection] Inspection "${label}" created ` +
    `(id=${resource.id}, state=${resource.state})`,
  );

  return {
    status: 'success',
    outputs: {
      inspectionId:    resource.id,
      inspectionState: resource.state,
      inspectionType,
      scheduledDate:   scheduledDate ?? null,
    },
  };
}
