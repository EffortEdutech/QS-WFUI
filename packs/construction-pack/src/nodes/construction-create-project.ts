/**
 * construction.create_project
 *
 * Creates a new ConstructionProject resource. This is the root record that
 * all other construction resources (claims, variations, defects, BOQ,
 * inspections) are attached to as children via parent_id.
 *
 * Inputs:
 *   name            — project name (required)
 *   description     — project scope description (optional)
 *   contractValue   — total contract value in MYR (optional)
 *   currency        — default 'MYR' (optional)
 *   startDate       — ISO 8601 start date (optional)
 *   endDate         — ISO 8601 projected end date (optional)
 *   clientName      — client/employer name (optional)
 *   contractorName  — main contractor name (optional)
 *   siteAddress     — site address (optional)
 *   contractNo      — contract reference number (optional)
 *   projectType     — residential | commercial | industrial | infrastructure (optional)
 *   projectId       — Lados project to attach to (optional)
 *
 * Outputs:
 *   constructionProjectId   — created resource ID
 *   constructionProjectState — initial state ('draft')
 *   constructionProjectName — resource name
 */

import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type {
  IConstructionResourceService,
  ConstructionProjectData,
} from '../types';

function err(message: string): NodeExecuteResult {
  return { status: 'failure', outputs: {}, error: { code: 'VALIDATION_ERROR', message } };
}

export async function realCreateProject(
  ctx: NodeContext,
  resourceService?: IConstructionResourceService,
): Promise<NodeExecuteResult> {
  const inp = ctx.inputs as Record<string, unknown>;
  const cfg = ctx.config  as Record<string, unknown>;

  const name           = (inp['name']           ?? cfg['name'])           as string | undefined;
  const description    = (inp['description']    ?? cfg['description'])    as string | undefined;
  const contractValue  = (inp['contractValue']  ?? cfg['contractValue'])  as number | undefined;
  const currency       = (inp['currency']       ?? cfg['currency'])       as string | undefined ?? 'MYR';
  const startDate      = (inp['startDate']      ?? cfg['startDate'])      as string | undefined;
  const endDate        = (inp['endDate']        ?? cfg['endDate'])        as string | undefined;
  const clientName     = (inp['clientName']     ?? cfg['clientName'])     as string | undefined;
  const contractorName = (inp['contractorName'] ?? cfg['contractorName']) as string | undefined;
  const siteAddress    = (inp['siteAddress']    ?? cfg['siteAddress'])    as string | undefined;
  const contractNo     = (inp['contractNo']     ?? cfg['contractNo'])     as string | undefined;
  const projectType    = (inp['projectType']    ?? cfg['projectType'])    as string | undefined;
  const projectId      = (inp['projectId']      ?? cfg['projectId'])      as string | undefined;

  if (!name)             return err('construction.create_project: name is required');
  if (!ctx.organizationId) return err('construction.create_project: organizationId missing from context');
  if (!resourceService)  return err('construction.create_project: resourceService not injected');

  const data: ConstructionProjectData = {
    ...(description    ? { description }    : {}),
    ...(contractValue  ? { contractValue }  : {}),
    currency,
    ...(startDate      ? { startDate }      : {}),
    ...(endDate        ? { endDate }        : {}),
    ...(clientName     ? { clientName }     : {}),
    ...(contractorName ? { contractorName } : {}),
    ...(siteAddress    ? { siteAddress }    : {}),
    ...(contractNo     ? { contractNo }     : {}),
    ...(projectType    ? { projectType }    : {}),
  };

  const resource = await resourceService.create({
    orgId:     ctx.organizationId,
    type:      'construction_project',
    name,
    data:      data as Record<string, unknown>,
    ...(projectId ? { projectId } : {}),
    createdBy: ctx.userId,
  });

  ctx.logger.info(
    `[construction.create_project] Created project "${name}" (id=${resource.id}, state=${resource.state})`,
  );

  return {
    status: 'success',
    outputs: {
      constructionProjectId:    resource.id,
      constructionProjectState: resource.state,
      constructionProjectName:  resource.name,
    },
  };
}
