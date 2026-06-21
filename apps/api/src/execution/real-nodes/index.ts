/**
 * Real node resolver for NestJS execution context.
 *
 * Phase 2: node implementations moved into their packs.
 * Phase 3: ResourceService added — resource.* nodes now live in core-pack.
 * Phase 4: EventBusService added — event.publish node now live in core-pack.
 * Phase 5: StateEngineService added — state.change node now live in core-pack.
 * Phase 7: FoundationPack added — foundation.* nodes (notification, approval, assign_user).
 * Phase 9: ContractorPack added — contractor.* nodes (job, trip, fuel, invoice).
 *
 * This file is a thin integration layer — it injects NestJS services
 * into each pack's resolveNode() factory and chains the results.
 */
import type { NodeContext, NodeExecuteResult } from '@lados/execution-engine';
import type { FileService }         from '../../file/file.service';
import type { LibraryService }      from '../../library/library.service';
import type { AiService }           from '../../ai/ai.service';
import type { DocumentService }     from '../../document/document.service';
import type { NotificationService } from '../../notification/notification.service';
import type { ResourceService }     from '../../resource/resource.service';
import type { EventBusService }     from '../../event-bus/event-bus.service';
import type { StateEngineService }  from '../../state-engine/state-engine.service';
import type { ApprovalTaskCreator } from '../../approval/approval-task.creator';
import type { ArtifactService }     from '../../artifact/artifact.service';

import { resolveNode as coreResolve }        from '@lados/core-pack';
import { resolveNode as documentResolve }    from '@lados/document-pack';
import { resolveNode as qsResolve }          from '@lados/qs-pack';
import { resolveNode as procurementResolve } from '@lados/procurement-pack';
import { resolveNode as foundationResolve }  from '@lados/foundation-pack';
import { resolveNode as contractorResolve }  from '@lados/contractor-pack';
import type {
  IResourceService,
  IResourceUpdateService,
  IInvoiceResourceService,
  IPaymentResourceService,
  IExpenseApprovalService,
  IMaintenanceCreateService,
  IMaintenanceClearService,
  IPayrollCreateService,
  IPayrollApprovalService,
} from '@lados/contractor-pack';

type FullContractorAdapter =
  IResourceService &
  IResourceUpdateService &
  IInvoiceResourceService &
  IPaymentResourceService &
  IExpenseApprovalService &
  IMaintenanceCreateService &
  IMaintenanceClearService &
  IPayrollCreateService &
  IPayrollApprovalService;

type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

// ── Contractor-pack adapter ────────────────────────────────────────────────────
//
// contractor-pack defines domain-focused interface names (create, list, findById).
// ResourceService uses different method names (createResource, listResources, getResource).
// This adapter bridges both without coupling the pack to NestJS.

function makeContractorResourceAdapter(
  svc: ResourceService | undefined,
): FullContractorAdapter | undefined {
  if (!svc) return undefined;
  return {
    async create(params) {
      // Cast to widest create-params shape — parentId is optional across all interfaces
      const p = params as {
        orgId: string; type: string; name: string;
        data?: Record<string, unknown>; parentId?: string; createdBy?: string;
      };
      return svc.createResource({
        orgId:     p.orgId,
        type:      p.type as Parameters<ResourceService['createResource']>[0]['type'],
        name:      p.name,
        data:      p.data,
        parentId:  p.parentId,
        createdBy: p.createdBy ?? 'system',
      });
    },
    async updateResource(id, orgId, updates, updatedBy) {
      return svc.updateResource(id, orgId, updates, updatedBy ?? 'system');
    },
    async transitionState(id, orgId, toState, actorId) {
      return svc.transitionState(id, orgId, toState, actorId ?? 'system');
    },
    async list(params) {
      return svc.listResources(params.orgId, {
        type:     params.type as NonNullable<Parameters<ResourceService['listResources']>[1]>['type'],
        state:    params.state,
        parentId: params.parentId,
      });
    },
    async findById(id, orgId) {
      try { return await svc.getResource(id, orgId); }
      catch { return null; }
    },
    async getResource(id, orgId) {
      return svc.getResource(id, orgId);
    },
  };
}

// ── Main resolver factory ─────────────────────────────────────────────────────

/**
 * Build the real node resolver, injecting NestJS services.
 * Call this once in ExecutionService and pass to WorkflowRunner.
 *
 * Each pack resolver is tried in order; the first non-null match wins.
 * Falls back to null (WorkflowRunner then uses its mock executor).
 */
export function buildRealNodeResolver(
  fileService: FileService,
  libraryService: LibraryService,
  aiService: AiService,
  documentService?: DocumentService,
  notificationService?: NotificationService,
  resourceService?: ResourceService,
  eventBusService?: EventBusService,
  stateEngineService?: StateEngineService,
  approvalService?: ApprovalTaskCreator,
  artifactService?: ArtifactService,
): (nodeType: string) => NodeExecutor | null {
  const contractorAdapter = makeContractorResourceAdapter(resourceService);

  // ArtifactService satisfies both IArtifactWriteService and IArtifactReadService structurally
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const artifactAdapter = artifactService as any;

  const resolvers = [
    // Foundation Pack first — canonical nodes take priority over core-pack equivalents
    foundationResolve({
      notificationService,
      approvalTaskService: approvalService,
      resourceService,
    }),
    // Contractor Pack — domain nodes for Contractor Edition
    contractorResolve({
      resourceService: contractorAdapter,
    }),
    // Cast needed: core-pack's IResourceService has a narrower ResourceType compiled before
    // contractor types were added. The runtime shape is compatible — only the TS union differs.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    coreResolve({ notificationService, resourceService: resourceService as any, eventBusService, stateEngineService, artifactService: artifactAdapter }),
    documentResolve({ fileService, libraryService, documentService }),
    qsResolve({ aiService }),
    procurementResolve({ libraryService }),
  ];

  return (nodeType: string) => {
    for (const resolver of resolvers) {
      const fn = resolver(nodeType);
      if (fn) return fn;
    }
    return null;
  };
}
