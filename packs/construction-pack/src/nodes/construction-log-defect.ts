/**
 * construction.log_defect
 *
 * Creates a Defect resource linked to a ConstructionProject.
 * Initial state is 'open'. Optionally links to a SiteInspection.
 *
 * Inputs:
 *   projectResourceId — construction_project resource ID (required)
 *   description       — description of the defect (required)
 *   severity          — 'low' | 'medium' | 'high' | 'critical' (required)
 *   inspectionId      — site_inspection resource ID that discovered this defect (optional)
 *   location          — location description on site (optional)
 *   discoveredDate    — ISO 8601 date defect was discovered (optional; defaults to now)
 *   photoUrls         — array of photo file URLs (optional)
 *   remarks           — additional remarks (optional)
 *   projectId         — Lados project to attach to (optional)
 *
 * Outputs:
 *   defectId     — created defect resource ID
 *   defectState  — initial state ('open')
 *   severity     — pass-through
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { IConstructionResourceService, DefectData } from '../types';

const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realLogDefect(
  ctx: NodeContext,
  resourceService?: IConstructionResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const projectResourceId = (inp['projectResourceId'] ?? cfg['projectResourceId']) as string | undefined;
  const description       = (inp['description']       ?? cfg['description'])       as string | undefined;
  const severity          = (inp['severity']          ?? cfg['severity'])          as 'low' | 'medium' | 'high' | 'critical' | undefined;
  const inspectionId      = (inp['inspectionId']      ?? cfg['inspectionId'])      as string | undefined;
  const location          = (inp['location']          ?? cfg['location'])          as string | undefined;
  const discoveredDate    = (inp['discoveredDate']    ?? cfg['discoveredDate'])    as string | undefined;
  const photoUrls         = (inp['photoUrls']         ?? cfg['photoUrls'])         as string[] | undefined;
  const remarks           = (inp['remarks']           ?? cfg['remarks'])           as string | undefined;
  const projectId         = (inp['projectId']         ?? cfg['projectId'])         as string | undefined;

  if (!projectResourceId) return err('construction.log_defect: projectResourceId is required');
  if (!description)       return err('construction.log_defect: description is required');
  if (!severity)          return err('construction.log_defect: severity is required');
  if (!ctx.organizationId) return err('construction.log_defect: organizationId missing from context');
  if (!resourceService)   return err('construction.log_defect: resourceService not injected');

  if (!VALID_SEVERITIES.includes(severity)) {
    return err(
      `construction.log_defect: invalid severity "${severity}". ` +
      `Must be one of: ${VALID_SEVERITIES.join(', ')}`,
    );
  }

  const now   = new Date().toISOString();
  const label = `[${severity.toUpperCase()}] ${description.slice(0, 60)}${description.length > 60 ? '…' : ''}`;

  const data: DefectData = {
    projectResourceId,
    description,
    severity,
    ...(inspectionId   ? { inspectionId }             : {}),
    ...(location       ? { location }                 : {}),
    discoveredDate:      discoveredDate ?? now,
    discoveredBy:        ctx.userId,
    ...(photoUrls      ? { photoUrls }                : {}),
    ...(remarks        ? { remarks }                  : {}),
  };

  const resource = await resourceService.create({
    orgId:     ctx.organizationId,
    type:      'defect',
    name:      label,
    data:      data as unknown as Record<string, unknown>,
    parentId:  projectResourceId,
    ...(projectId    ? { projectId }    : {}),
    ...(inspectionId ? { parentId: projectResourceId } : {}),
    createdBy: ctx.userId,
  });

  ctx.logger.info(
    `[construction.log_defect] Defect logged: "${label}" ` +
    `(id=${resource.id}, severity=${severity}, state=${resource.state})`,
  );

  return {
    status: 'success',
    outputs: {
      defectId:    resource.id,
      defectState: resource.state,
      severity,
    },
  };
}
