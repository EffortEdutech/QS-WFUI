/**
 * @lados/construction-pack
 *
 * Construction domain nodes for Lados — Projects, Progress Claims, Variations,
 * Defects, BOQ, and Site Inspections.
 *
 * Phase 7: Full construction lifecycle support for main contractors and
 * QS professionals operating under PAM / JKR / CIPAA contract frameworks.
 *
 * AI guardrails (non-negotiable):
 *   - construction.certify_progress_claim: Must appear DOWNSTREAM of
 *     foundation.request_approval. AI cannot issue Certificates of Payment.
 *   - construction.approve_variation: Must appear DOWNSTREAM of
 *     foundation.request_approval. AI cannot approve contract variations.
 *   - construction.generate_boq: AI-generated BOQ items are ADVISORY only.
 *     BOQ must be reviewed and approved (submitted → approved) before use
 *     as a contract document.
 *
 * Depends on: @lados/foundation-pack (must be active)
 */

import type { PackManifest } from '@lados/pack-sdk';
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';

import { realCreateProject }            from './nodes/construction-create-project';
import { realSubmitProgressClaim }      from './nodes/construction-submit-progress-claim';
import { realAssessProgressClaim }      from './nodes/construction-assess-progress-claim';
import { realCertifyProgressClaim }     from './nodes/construction-certify-progress-claim';
import { realSubmitVariation }          from './nodes/construction-submit-variation';
import { realApproveVariation }         from './nodes/construction-approve-variation';
import { realCreateSiteInspection }     from './nodes/construction-create-site-inspection';
import { realSubmitInspectionReport }   from './nodes/construction-submit-inspection-report';
import { realLogDefect }                from './nodes/construction-log-defect';
import { realGenerateBoq }              from './nodes/construction-generate-boq';

// ── Re-export types ───────────────────────────────────────────────────────────

export {
  CONSTRUCTION_RESOURCE_TYPES,
  CONSTRUCTION_EVENTS,
  type ConstructionResourceType,
  type ConstructionEventType,
  type IConstructionResourceService,
  type IConstructionResource,
  type IConstructionAiService,
  type ConstructionProjectData,
  type ProgressClaimData,
  type ProgressClaimItem,
  type VariationData,
  type DefectData,
  type BOQData,
  type BOQLineItem,
  type SiteInspectionData,
  type InspectionFinding,
} from './types';

export { nodeManifests } from './manifests';

export const PACK_ID      = 'construction-pack' as const;
export const PACK_VERSION = '0.1.0' as const;

export const manifest: PackManifest = {
  id:          PACK_ID,
  version:     PACK_VERSION,
  displayName: 'Construction Pack',
  description: 'Construction domain nodes — Projects, Progress Claims, Variations, Defects, BOQ, Site Inspections. Supports PAM / JKR / CIPAA contract frameworks.',
  author:      'Lados Platform',
  nodes: [
    'construction.create_project',
    'construction.submit_progress_claim',
    'construction.assess_progress_claim',
    'construction.certify_progress_claim',
    'construction.submit_variation',
    'construction.approve_variation',
    'construction.create_site_inspection',
    'construction.submit_inspection_report',
    'construction.log_defect',
    'construction.generate_boq',
  ],
};

export interface ConstructionPackServices {
  resourceService?: import('./types').IConstructionResourceService;
  /** Optional AI service for construction.generate_boq */
  aiService?:       import('./types').IConstructionAiService;
}

type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

const noService = (code: string, msg: string): NodeExecuteResult =>
  ({ status: 'failure', outputs: {}, error: { code, message: msg } });

/**
 * Returns the real executor for a construction-pack node type, or null if unknown.
 */
export function resolveNode(
  services: ConstructionPackServices = {},
): (nodeType: string) => NodeExecutor | null {
  const { resourceService, aiService } = services;

  const nodes: Record<string, NodeExecutor> = {
    'construction.create_project':
      (ctx) => resourceService
        ? realCreateProject(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'ConstructionResourceService not injected')),

    'construction.submit_progress_claim':
      (ctx) => resourceService
        ? realSubmitProgressClaim(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'ConstructionResourceService not injected')),

    'construction.assess_progress_claim':
      (ctx) => resourceService
        ? realAssessProgressClaim(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'ConstructionResourceService not injected')),

    'construction.certify_progress_claim':
      (ctx) => resourceService
        ? realCertifyProgressClaim(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'ConstructionResourceService not injected')),

    'construction.submit_variation':
      (ctx) => resourceService
        ? realSubmitVariation(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'ConstructionResourceService not injected')),

    'construction.approve_variation':
      (ctx) => resourceService
        ? realApproveVariation(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'ConstructionResourceService not injected')),

    'construction.create_site_inspection':
      (ctx) => resourceService
        ? realCreateSiteInspection(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'ConstructionResourceService not injected')),

    'construction.submit_inspection_report':
      (ctx) => resourceService
        ? realSubmitInspectionReport(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'ConstructionResourceService not injected')),

    'construction.log_defect':
      (ctx) => resourceService
        ? realLogDefect(ctx, resourceService)
        : Promise.resolve(noService('NO_SERVICE', 'ConstructionResourceService not injected')),

    'construction.generate_boq':
      (ctx) => resourceService
        ? realGenerateBoq(ctx, resourceService, aiService)
        : Promise.resolve(noService('NO_SERVICE', 'ConstructionResourceService not injected')),
  };

  return (nodeType: string) => nodes[nodeType] ?? null;
}
