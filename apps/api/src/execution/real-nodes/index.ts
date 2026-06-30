/**
 * Real node resolver for NestJS execution context.
 *
 * Phase 2: node implementations moved into their packs.
 * Phase 3: ResourceService added — resource.* nodes now live in core-pack.
 * Phase 4: EventBusService added — event.publish node now live in core-pack.
 * Phase 5: StateEngineService added — state.change node now live in core-pack.
 * Phase 7: FoundationPack added — foundation.* nodes (notification, approval, assign_user).
 * Phase 9: ContractorPack added — contractor.* nodes (job, trip, fuel, invoice).
 * Phase 10: NotificationsPack added — notification.send_email / send_sms / send_in_app.
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
import type { EmailService }        from '../../notification/email.service';   // Phase 10
import type { SmsService }          from '../../notification/sms.service';     // Phase 10

import { resolveNode as coreResolve }         from '@lados/core-pack';
import { resolveNode as documentResolve }     from '@lados/document-pack';
import { resolveNode as qsResolve }           from '@lados/qs-pack';
import { resolveNode as procurementResolve }  from '@lados/procurement-pack';
import { resolveNode as foundationResolve }   from '@lados/foundation-pack';
import { resolveNode as contractorResolve }   from '@lados/contractor-pack';
import { resolveNode as constructionResolve } from '@lados/construction-pack';  // Phase 7
import { resolveNode as financeResolve }        from '@lados/finance-pack';           // Phase 9
import { resolveNode as notificationsResolve } from '@lados/notifications-pack';     // Phase 10
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
  IFuelExtractResourceService,
} from '@lados/contractor-pack';
import type {
  IConstructionResourceService,
  IConstructionAiService,
} from '@lados/construction-pack';  // Phase 7
import type {
  IFinanceResourceService,
} from '@lados/finance-pack';         // Phase 9

type FullContractorAdapter =
  IResourceService &
  IResourceUpdateService &
  IInvoiceResourceService &
  IPaymentResourceService &
  IExpenseApprovalService &
  IMaintenanceCreateService &
  IMaintenanceClearService &
  IPayrollCreateService &
  IPayrollApprovalService &
  IFuelExtractResourceService;

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

// ── Construction-pack adapters — Phase 7 ─────────────────────────────────────
//
// IConstructionResourceService expects: create, findById, updateResource, transitionState.
// ResourceService exposes: createResource, getResource, updateResource, transitionState.
// This adapter bridges the naming differences without coupling the pack to NestJS.
//
// IConstructionAiService.complete({ systemPrompt, userPrompt, maxTokens })
// AiService.complete(systemPrompt, userPrompt, options?) — positional args.
// Adapter maps the single-object form to the positional-arg form.

function makeConstructionAiAdapter(
  aiSvc: AiService | undefined,
): IConstructionAiService | undefined {
  if (!aiSvc) return undefined;
  return {
    complete: ({ systemPrompt, userPrompt, maxTokens }) =>
      aiSvc.complete(systemPrompt, userPrompt, maxTokens ? { maxTokens } : {}),
  };
}

function makeConstructionResourceAdapter(
  svc: ResourceService | undefined,
): IConstructionResourceService | undefined {
  if (!svc) return undefined;
  return {
    async create(params) {
      return svc.createResource({
        orgId:     params.orgId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type:      params.type as any,
        name:      params.name,
        data:      params.data,
        parentId:  params.parentId,
        createdBy: params.createdBy ?? 'system',
      });
    },
    async findById(id, orgId) {
      try { return await svc.getResource(id, orgId); }
      catch { return null; }
    },
    async updateResource(id, orgId, updates, updatedBy) {
      return svc.updateResource(id, orgId, updates, updatedBy);
    },
    async transitionState(id, orgId, toState, actorId) {
      return svc.transitionState(id, orgId, toState, actorId);
    },
  };
}

// ── Finance-pack adapter — Phase 9 ───────────────────────────────────────────
//
// IFinanceResourceService expects: create, findById, updateResource, transitionState.
// ResourceService exposes: createResource, getResource, updateResource, transitionState.
// Identical shape to construction adapter — separate function for clarity.

function makeFinanceResourceAdapter(
  svc: ResourceService | undefined,
): IFinanceResourceService | undefined {
  if (!svc) return undefined;
  return {
    async create(params) {
      return svc.createResource({
        orgId:     params.orgId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        type:      params.type as any,
        name:      params.name,
        data:      params.data,
        parentId:  params.parentId,
        createdBy: params.createdBy ?? 'system',
      });
    },
    async findById(id, orgId) {
      try { return await svc.getResource(id, orgId); }
      catch { return null; }
    },
    async updateResource(id, orgId, updates, updatedBy) {
      return svc.updateResource(id, orgId, updates, updatedBy);
    },
    async transitionState(id, orgId, toState, actorId) {
      return svc.transitionState(id, orgId, toState, actorId);
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
  emailService?: EmailService,        // Phase 10
  smsService?: SmsService,            // Phase 10
): (nodeType: string) => NodeExecutor | null {
  const contractorAdapter    = makeContractorResourceAdapter(resourceService);
  const constructionAdapter  = makeConstructionResourceAdapter(resourceService);  // Phase 7
  const constructionAiAdapt = makeConstructionAiAdapter(aiService);              // Phase 7
  const financeAdapter       = makeFinanceResourceAdapter(resourceService);       // Phase 9

  // Phase 10 — notifications-pack adapters
  // EmailService / SmsService already satisfy IEmailService / ISmsService via duck typing.
  // NotificationService already satisfies IInAppNotificationService via duck typing.
  // No adapter needed — pass through directly.

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
    // aiService passed for contractor.extract_fuel_data (GPT-4o vision)
    contractorResolve({
      resourceService: contractorAdapter,
      aiService,
    }),
    // Construction Pack — Phase 7: Projects, Claims, Variations, Defects, BOQ, Inspections
    // aiService passed for construction.generate_boq (optional AI line-item generation)
    constructionResolve({
      resourceService: constructionAdapter,
      aiService:       constructionAiAdapt,
    }),
    // Finance Pack — Phase 9: Invoice, Purchase Orders, Retention Release (CIPAA / PAM / JKR)
    financeResolve({ resourceService: financeAdapter }),
    // Notifications Pack — Phase 10: send_email, send_sms, send_in_app
    notificationsResolve({
      emailService,
      smsService,
      notificationService,
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
