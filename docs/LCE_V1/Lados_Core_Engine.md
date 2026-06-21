# Lados Core Engine

**Version:** LCE V1  
**Date:** 2026-06-20  
**Status:** Living document — updated as each phase completes

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architecture](#2-architecture)
3. [Runtime](#3-runtime)
4. [Workflow Engine](#4-workflow-engine)
5. [Resource Engine](#5-resource-engine)
6. [Event System](#6-event-system)
7. [State Engine](#7-state-engine)
8. [Security](#8-security)
9. [AI Runtime](#9-ai-runtime)
10. [SDK](#10-sdk)
11. [Marketplace](#11-marketplace)
12. [API](#12-api)
13. [UI Framework](#13-ui-framework)
14. [Storage](#14-storage)
15. [Deployment](#15-deployment)
16. [Testing](#16-testing)
17. [Reference](#17-reference)

---

## 1. Introduction

### 1.1 What Lados Is

Lados is a business operating platform. It is not an ERP, not a project management tool, and not a vertical SaaS product. It is the reusable engine on which domain-specific business solutions are composed and run.

The engine is called the **Lados Core Engine** (LCE). Every solution — Contractor Edition, Procurement Edition, LEOS — is a configuration of packs, resources, workflows, nodes, states, and AI tools built on top of LCE. The engine does not know about tipper lorries, invoices, or procurement contracts. The packs do.

```
LCE
  = Workflow Engine
  + Node System
  + Pack System
  + Resource Engine
  + Event Bus
  + State Engine
  + Security Engine
  + Foundation Pack
  + AI Runtime
  + Internal Registry
```

### 1.2 Identity

```
Platform name:     Lados
Engine:            Lados Core Engine (LCE)
Version:           LCE V1
Package namespace: @lados/
Former names:      QS-OS, V3, @qsos/  (historical references only — retired)
```

Former names are preserved only in git history and migration notes. All active code, documentation, and UI uses the Lados identity.

### 1.3 Solutions Are Pack Compositions

A solution is a named composition of packs installed on LCE:

| Solution | Packs |
|---|---|
| Contractor Edition | Foundation, Job, Fleet, Equipment, Finance, HR, Document, Dashboard, AI |
| Procurement Edition | Foundation, Procurement, Approval, Finance, Document, Dashboard, AI |
| LEOS / JKR | Foundation, Project, Tender, BOQ, Contract, Inspection, Payment, Variation, Asset, Archive |

The engine stays compact. Solutions grow by adding packs, resource types, workflow templates, and node implementations — not by modifying the engine.

### 1.4 Contractor Edition: The First Validation

The minimum successful product is a working engine with one real solution: **Contractor Edition**. It targets a small contractor:

- 1 Owner
- 3 Tipper Lorries
- 3 Drivers
- 1 Backhoe
- 1 optional Admin

This is exactly the class of business where Lados should work without ERP complexity. If LCE cannot run a small contractor cleanly, it cannot scale to LEOS.

### 1.5 What This Document Covers

This document is the primary technical reference for LCE V1. It covers every engine layer from architecture through testing and reference. It is authoritative over all earlier QS-OS and V3 documents, which are archived.

---

## 2. Architecture

### 2.1 Monorepo Structure

The entire platform lives in a single monorepo managed by pnpm workspaces and Turborepo.

```
QS-WFUI/
  apps/
    api/              NestJS 10 — REST API, execution host, Supabase client
    web/              Next.js 14 App Router — canvas UI, project and workflow management
  packages/
    execution-engine/ @lados/execution-engine — DAG runner, graph planner, checkpoint
    node-sdk/         @lados/node-sdk — node contract, manifest types, base class
    pack-sdk/         @lados/pack-sdk — pack manifest, permission, node registration
    shared-types/     @lados/shared-types — cross-layer type contracts
    workflow-json/    @lados/workflow-json — workflow schema, builder, validation
  packs/
    core-pack/        @lados/core-pack — Start, End, Logger, Condition, Human Approval
    ai-pack/          @lados/ai-pack — AI Analyze, Extract, Summarize
    document-pack/    @lados/document-pack — Upload, Read Excel, Generate PDF
    procurement-pack/ @lados/procurement-pack — Generate RFQ, Generate PO
    qs-pack/          @lados/qs-pack — Read BOQ, Classify Trade, Split Work Package
  supabase/
    migrations/       Applied schema migrations (0001 through 0026)
    functions/        Edge function stubs
  docs/
    LCE_V1/           This document and chapter files
```

### 2.2 Technology Stack

| Layer | Technology |
|---|---|
| API runtime | NestJS 10, TypeScript 5 |
| Frontend | Next.js 14 App Router, React Flow, Tailwind CSS |
| Database | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth + JWT guard |
| File storage | Supabase Storage |
| AI | OpenAI Chat Completions API |
| Monorepo | pnpm workspaces + Turborepo |
| Package namespace | @lados/ |

### 2.3 Core Design Decisions

**Engine before solution.** Every feature question is asked at two levels:

```
Level 1 — Engine:    What reusable LCE capability does this need?
Level 2 — Solution:  How does Contractor Edition configure it?
```

The screen is the last expression. The workflow and resource model are the product.

**Resources are first-class objects.** Every important business entity — Customer, Job, Vehicle, Invoice, Contract — is a Resource instance stored in a shared resource layer. Resources have a type, a state, typed data, relationships, and a complete history. Domain logic lives in packs and workflows, not in one-off modules.

**Events are mandatory.** Every important action emits a typed, immutable event. Dashboards, AI context, notifications, and audit views all read from the event stream. There are no side-effect calls hidden inside services.

**States are configurable.** Resource lifecycle is driven by configurable state machine definitions declared in pack manifests. The State Engine enforces valid transitions and records every change. Invalid transitions are blocked at the engine level.

**Packs own their nodes.** Node implementations belong in their pack (`@lados/fleet-pack/src/nodes/`), not in the API host. The execution engine resolves nodes by querying installed packs. This keeps the engine decoupled from solution logic.

**AI is advisory.** AI output is never a final commercial or regulatory fact without explicit human acceptance through a workflow approval step. This guardrail is enforced at the engine level and must never be relaxed.

### 2.4 Engine Layers Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  Solutions (Contractor Edition · Procurement Edition · LEOS)    │
├─────────────────────────────────────────────────────────────────┤
│  Packs (Foundation · Job · Fleet · Finance · AI · ...)          │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│  Workflow    │  Resource    │  Event       │  State             │
│  Engine      │  Engine      │  Bus         │  Engine            │
├──────────────┴──────────────┴──────────────┴────────────────────┤
│  Security Engine + AI Runtime                                   │
├─────────────────────────────────────────────────────────────────┤
│  Foundation Pack (Users · Files · Approvals · Notifications)    │
├─────────────────────────────────────────────────────────────────┤
│  Supabase (PostgreSQL · Auth · Storage) + NestJS Host           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Runtime

### 3.1 API Host (NestJS)

`apps/api` is the execution host. It is a NestJS 10 application built on TypeScript with strict mode. All workflow execution, resource mutations, event publishing, state transitions, security checks, and AI calls are handled here.

NestJS module layout:

```
apps/api/src/
  app.module.ts              Root module
  common/
    supabase/                SupabaseService — global, admin client
    guards/                  SupabaseJwtGuard
    decorators/              @CurrentUser()
  auth/                      Auth module (Supabase session)
  organization/              Org and membership CRUD
  project/                   Project CRUD
  workflow/                  Workflow CRUD, versioning, publish, export
  execution/                 Trigger, resume, run history, log retrieval
    real-nodes/              (Transitional) Real node implementations
  approval/                  Approval inbox, decide endpoint
  notification/              In-app notifications
  file/                      File upload to Supabase Storage
  library/                   Project document library
  ai/                        OpenAI wrapper
  node/                      Node registry
  supplier/                  Supplier CRUD
  rfq-distribution/          RFQ distribution
  quotation/                 Quotation submission and comparison
  ...
```

### 3.2 Web App (Next.js)

`apps/web` is the frontend application. It uses the Next.js 14 App Router with the `(app)` route group for authenticated pages.

```
apps/web/src/
  app/
    (app)/
      layout.tsx             Sidebar + navigation shell
      dashboard/             Dashboard page
      projects/              Project list and detail
      projects/[id]/
        workflows/           Workflow canvas
        quotations/          Quotation comparison
      approvals/             Approval inbox
      suppliers/             Supplier list
      packs/                 Pack browser
  components/
    canvas/                  WorkflowCanvas, NodePalette, PropertyPanel,
                             ExecutionLogPanel, NodePalette
    notifications/           NotificationBell
  lib/
    api/client.ts            Thin API client (JWT auto-attach)
    supabase/client.ts       Browser Supabase client
```

### 3.3 Package Build

Each `packages/*` and `packs/*` package is built with `tsc`. The compiled output lands in `dist/`. The API and web apps resolve package imports through pnpm workspace symlinks.

Build all packages:
```bash
pnpm turbo build
```

Build a single package:
```bash
cd packages/execution-engine && pnpm build
```

**Important:** When `src/` types change, `dist/*.d.ts` must be rebuilt before the API compiler picks up the changes. During development, run `pnpm build --watch` in the affected package or update `dist/*.d.ts` directly.

### 3.4 Database (Supabase)

All persistent state lives in Supabase PostgreSQL. The API uses the Supabase admin client (`@supabase/supabase-js` with the service role key) for all server-side operations. RLS policies are defined but the API bypasses them via the admin client — access control is enforced at the NestJS service layer.

Active schema objects (as of migration 0026):

| Table | Purpose |
|---|---|
| organisations | Tenant root |
| organization_members | User → org membership with role |
| projects | Project container |
| workflows | Workflow definitions (draft) |
| workflow_versions | Immutable definition snapshots |
| execution_runs | Run records (status, inputs, outputs, checkpoint) |
| execution_logs | Per-node execution log entries |
| approval_tasks | Human approval task records |
| notification_tasks | In-app notification queue |
| audit_log | Human-readable audit trail |
| packs | Installed pack registry |
| registered_nodes | Node manifest registry |
| suppliers | Supplier/contractor records |
| rfq_distributions | RFQ send records |
| quotations | Submitted quotations |
| pipeline_nodes | Pipeline canvas nodes |
| pipeline_edges | Pipeline canvas edges |
| artifacts | Inter-workflow data artifacts |

---

## 4. Workflow Engine

### 4.1 Purpose

The Workflow Engine is the automation backbone of LCE. It allows any business process — job dispatch, fuel receipt review, invoice generation, payroll approval — to be designed visually and executed reliably.

### 4.2 Workflow Definition

A workflow definition is a JSON document conforming to the `QSWorkflowDefinition` schema from `@lados/workflow-json`. It contains nodes, edges, global variables, and trigger configuration.

```typescript
interface QSWorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: VariableDefinition[];
  trigger?: TriggerConfig;
}

interface WorkflowNode {
  id: string;
  type: string;           // e.g. 'core.human_approval', 'fleet.assign_vehicle'
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}
```

### 4.3 Graph Planner

`@lados/execution-engine/graph-planner.ts` converts a workflow definition into an `ExecutionPlan` — a topologically sorted list of steps with explicit dependency declarations.

The planner detects cycles before execution begins. A workflow with cycles is rejected immediately with a `CYCLE_DETECTED` error.

```typescript
const plan = planWorkflow(definition);
if (plan.cycles.length > 0) {
  // reject before executing
}
// plan.steps — ordered execution sequence
```

### 4.4 Runner

`@lados/execution-engine/runner.ts` implements `WorkflowRunner` and the `runWorkflow()` convenience function.

Execution sequence:

1. Validate plan (reject cycles)
2. Restore checkpoint if resuming from a pause (Phase 1)
3. For each step in topological order:
   a. Resolve the node executor (real or mock)
   b. Build `NodeContext` from completed node outputs
   c. Execute the node
   d. Handle result: `success` → continue, `failure` → fail, `paused` → persist checkpoint and halt, `skipped` → continue
4. Return `ExecutionResult` with status, outputs, per-node logs, and optional checkpoint data

```typescript
const result = await runWorkflow({
  executionId, workflowId, projectId, organizationId, userId,
  definition, inputs, variables,
  nodeResolver,           // optional: resolves real node executors
  resumeFromCheckpoint,   // optional: Phase 1 resume
});
```

### 4.5 Pause and Resume (Phase 1)

When a node returns `{ status: 'paused' }` (the `core.human_approval` node), the runner:

1. Records the paused node ID as `pausedAtNodeId`
2. Captures all completed node outputs as `checkpointOutputs`
3. Marks remaining nodes as `waiting`
4. Returns `ExecutionResult` with `status: 'paused'`

The API persists `paused_at_node_id` and `checkpoint_outputs` to `execution_runs`.

On resume (after a human approves or rejects):

1. The runner receives `resumeFromCheckpoint` with the paused node ID, checkpoint outputs, and approval decision
2. It pre-seeds `nodeOutputs` from `checkpointOutputs`
3. It injects the approval decision as the paused node's synthetic output
4. It skips nodes already in `nodeOutputs`
5. Execution continues from the next node

### 4.6 Fire-and-Forget Async Execution (Phase 1)

`ExecutionService.triggerRun()` is fire-and-forget. It creates the run record (status `running`), starts `_executeAndPersist()` as an unresolved background promise, and immediately returns `{ runId, status: 'running' }`.

The UI polls `GET /api/v1/runs/:runId` for status. When the run completes, pauses, or fails, the poll returns the updated status.

This avoids blocking the HTTP thread for long-running workflows without requiring Redis or BullMQ in the MVP.

### 4.7 Published Versions and Immutability (Phase 1)

Every workflow has a **draft** definition (the live canvas state) and an optional **published version** (an immutable snapshot).

Publishing a workflow:
1. Snapshots the current definition into `workflow_versions`
2. Sets `published_version_id`, `published_at`, `published_by` on the workflow row
3. Sets workflow status to `active`

Execution guard: `triggerRun()` reads `published_version_id` and executes from the pinned snapshot in `workflow_versions`. If no published version exists, the trigger is rejected with `400 Bad Request — publish the workflow first`.

This ensures that canvas edits do not silently change the behaviour of live, scheduled, or approved workflows.

### 4.8 Node Execution Contract

Every node executor is a function that receives `NodeContext` and returns `NodeExecuteResult`:

```typescript
type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;

interface NodeContext {
  nodeId: string;
  nodeType: string;
  config: Record<string, unknown>;
  inputs: Record<string, unknown>;
  executionId?: string;
  workflowId: string;
  projectId: string;
  organizationId: string;
  userId: string;
  log: NodeLogger;
  // Phase 1 extended context (injected for real nodes):
  services?: {
    supabase: SupabaseClient;
    fileService: FileService;
    aiService: AiService;
    notificationService: NotificationService;
    // ...
  };
}

interface NodeExecuteResult {
  status: 'success' | 'failure' | 'paused' | 'pending_approval' | 'skipped';
  outputs: Record<string, unknown>;
  logs?: string[];
  summary?: string;
  error?: { code: string; message: string };
}
```

### 4.9 Real Nodes (Current Implementation)

Real node executors live in `apps/api/src/execution/real-nodes/`. They are injected into the execution engine via `buildRealNodeResolver()`, which returns a function mapping node type strings to executors.

Current implemented real nodes:

| Node Type | Description |
|---|---|
| `core.human_approval` | Creates approval task, pauses execution (Phase 1) |
| `core.logger` | Logs a message to the execution log |
| `core.cron_trigger` | Cron trigger stub |
| `workflow.condition` | Conditional branch based on input value |
| `project.save_artifact` | Saves a value as a named workflow artifact |
| `project.read_artifact` | Reads a named artifact |
| `document.upload_file` | Uploads a file to Supabase Storage |
| `document.read_excel` | Parses an Excel workbook |
| `qs.read_boq` | Reads a Bill of Quantities file |
| `qs.clean_boq` | Normalises BOQ rows |
| `qs.classify_trade` | AI-classifies BOQ items by trade |
| `qs.split_work_package` | Groups BOQ items into work packages |
| `procurement.generate_rfq` | Generates RFQ documents per trade |
| `procurement.generate_po` | Generates a Purchase Order document |

**Phase 2 target:** node implementations move from `api/src/execution/real-nodes/` into their respective packs.

### 4.10 Workflow Versioning

Every call to `WorkflowService.snapshotVersion()` creates a row in `workflow_versions` with the full definition snapshot, a sequential version number, and an optional label. Versions are immutable once created.

`WorkflowService.restoreVersion()` auto-saves the current definition before overwriting it, so restores are always reversible.

---

## 5. Resource Engine

### 5.1 Purpose

The Resource Engine is the universal business object layer. Every domain entity — Customer, Job, Vehicle, Invoice, Contract — is a typed Resource instance. The engine provides a consistent CRUD, relationship, history, and lifecycle API that all packs and nodes use.

**Current status:** Not yet built. Business objects are currently individual Supabase tables in separate NestJS modules. The Resource Engine will progressively absorb them.

### 5.2 Core Schema

```sql
CREATE TABLE lados_resources (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id uuid NOT NULL REFERENCES organisations(id),
  resource_type   text NOT NULL,           -- 'Vehicle', 'Invoice', 'Job', etc.
  resource_key    text,                    -- human-readable key, e.g. 'INV-2026-001'
  title           text,
  status          text DEFAULT 'active',
  state           text,                    -- current state machine state
  data            jsonb DEFAULT '{}',      -- typed payload per resource_type
  relationships   jsonb DEFAULT '[]',      -- links to other resources
  created_by      uuid REFERENCES auth.users(id),
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  archived_at     timestamptz
);

CREATE INDEX idx_lados_resources_org_type
  ON lados_resources (organisation_id, resource_type);

CREATE INDEX idx_lados_resources_state
  ON lados_resources (resource_type, state)
  WHERE archived_at IS NULL;
```

### 5.3 Resource Engine API

`ResourceEngine` NestJS service exposes:

```typescript
createResource(type: string, data: unknown, organisationId: string, userId: string): Promise<Resource>
updateResource(id: string, data: Partial<unknown>, userId: string): Promise<Resource>
findResource(id: string, organisationId: string): Promise<Resource>
searchResources(type: string, filters: ResourceFilter, organisationId: string): Promise<Resource[]>
archiveResource(id: string, userId: string): Promise<void>
relateResources(sourceId: string, targetId: string, relationshipType: string): Promise<void>
getResourceHistory(id: string): Promise<ResourceHistoryEntry[]>
transitionState(id: string, toState: string, userId: string): Promise<Resource>  // delegates to State Engine
```

Every mutation emits a typed event via the Event Bus and appends to the audit log.

### 5.4 Contractor Edition Resource Types

| Resource Type | Key Fields |
|---|---|
| Customer | name, contactPerson, phone, address, paymentTerms |
| Job | customerId, jobType, location, material, ratePerTrip, startTime, estimatedTrips |
| Trip | jobId, vehicleId, driverId, loadedAt, deliveredAt, tripCount |
| Driver | name, licenseNo, phone, vehicleId |
| Vehicle | plateNo, type, capacity, insuranceExpiry, roadTaxExpiry, lastService |
| Equipment | type, serialNo, model, operatorId, hourlyRate |
| Operator | name, phone, certifications |
| FuelReceipt | vehicleId, driverId, amount, litres, station, receiptDate, aiExtracted |
| MaintenanceRecord | vehicleId, serviceType, mileage, cost, serviceDate, nextDueDate |
| Invoice | jobId, customerId, lineItems, subtotal, total, issuedDate, dueDate |
| Payment | invoiceId, amount, paymentDate, paymentMethod, reference |
| Expense | category, amount, description, date, receiptFileId |
| PayrollRun | periodStart, periodEnd, employees, grossTotal, netTotal, status |
| Document | fileName, fileType, fileSize, storagePath, linkedResourceId |

### 5.5 Resource Engine Nodes

Foundation Pack contributes the following engine-level nodes:

| Node | Description |
|---|---|
| `resource.create` | Create a resource instance |
| `resource.update` | Update resource fields |
| `resource.find` | Find resource by ID or filter |
| `resource.search` | Search resources by type and filter |
| `resource.archive` | Archive a resource |
| `resource.relate` | Link two resources |
| `resource.change_state` | Transition resource state (via State Engine) |

---

## 6. Event System

### 6.1 Purpose

The Event Bus is the observability backbone. Every important action — workflow step, resource mutation, state transition, approval decision — emits a typed, immutable event. Dashboards, AI context, notifications, and audit views all read from the event stream.

**Current status:** `audit_log` table exists and is written on key actions. The formal Event Bus with typed envelopes, subscribers, and projections is Phase 4.

### 6.2 Event Envelope Schema

```sql
CREATE TABLE lados_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      text NOT NULL,            -- 'Job.Created', 'Trip.Completed', etc.
  event_version   text NOT NULL DEFAULT '1.0.0',
  organisation_id uuid NOT NULL,
  actor_type      text NOT NULL,            -- 'user', 'system', 'workflow', 'node'
  actor_id        uuid,
  resource_type   text,
  resource_id     uuid,
  workflow_id     uuid,
  node_id         text,
  payload         jsonb DEFAULT '{}',
  correlation_id  uuid,                     -- links events in the same workflow run
  causation_id    uuid,                     -- ID of event that caused this one
  occurred_at     timestamptz DEFAULT now()
);
```

Events are append-only. No updates. No deletes.

### 6.3 Event Publisher

Every Resource mutation, State transition, Workflow step completion, and Approval action calls `EventBus.publish(event)`. The publisher writes to `lados_events` and triggers registered handlers.

```typescript
await eventBus.publish({
  eventType: 'Trip.Completed',
  organisationId,
  actorType: 'user',
  actorId: userId,
  resourceType: 'Trip',
  resourceId: tripId,
  payload: { jobId, vehicleId, driverId, tripCount },
  correlationId: runId,
});
```

### 6.4 Event Subscribers

Handlers register per event type. Initial handlers:

| Handler | Triggers on | Effect |
|---|---|---|
| `notification-trigger` | Approval requested, Trip completed, Invoice due | Creates notification task |
| `audit-log-projection` | All events | Appends human-readable row to `audit_log` |
| `dashboard-projection` | Trip completed, Invoice paid, Fuel receipt approved | Updates projection counters |
| `ai-context-invalidation` | Resource created/updated, State changed | Marks AI context cache stale |

### 6.5 Core Event Catalog

| Event Type | Emitted when |
|---|---|
| `Resource.Created` | Any resource created |
| `Resource.Updated` | Any resource field updated |
| `Resource.Archived` | Resource archived |
| `Resource.StateChanged` | Resource state transition |
| `Workflow.Run.Started` | Execution run begins |
| `Workflow.Run.Completed` | Execution run completes successfully |
| `Workflow.Run.Paused` | Execution paused at approval node |
| `Workflow.Run.Resumed` | Execution resumed after approval |
| `Workflow.Run.Failed` | Execution run fails |
| `Workflow.Published` | Workflow definition published |
| `Approval.Requested` | Human approval task created |
| `Approval.Granted` | Approval task approved |
| `Approval.Rejected` | Approval task rejected |
| `File.Uploaded` | File uploaded to storage |
| `AI.ResponseGenerated` | AI produces a response |

---

## 7. State Engine

### 7.1 Purpose

The State Engine enforces resource lifecycle rules through configurable state machine definitions. Invalid transitions are blocked at the engine level, not scattered across business logic. Every transition is recorded in a state history.

**Current status:** Not yet built. State is currently a free-form column value in individual tables.

### 7.2 State Machine Definition

State machines are declared per resource type in pack manifests:

```json
{
  "resourceType": "Invoice",
  "states": ["Draft", "Submitted", "Verified", "Approved", "Paid", "Archived"],
  "transitions": [
    { "from": "Draft",     "to": "Submitted", "permission": "invoice.submit" },
    { "from": "Submitted", "to": "Verified",  "permission": "invoice.verify" },
    { "from": "Verified",  "to": "Approved",  "permission": "invoice.approve", "requiresApproval": true },
    { "from": "Approved",  "to": "Paid",      "permission": "payment.record" },
    { "from": "*",         "to": "Archived",  "permission": "resource.archive" }
  ]
}
```

### 7.3 Contractor Edition State Machines

| Resource | States |
|---|---|
| Job | Draft → Assigned → Active → Completed → Invoiced → Archived |
| Trip | Pending → In Progress → Completed → Disputed → Archived |
| Vehicle | Available → Assigned → In Service → Maintenance → Retired |
| FuelReceipt | Uploaded → Extracted → Reviewed → Approved → Posted → Archived |
| Invoice | Draft → Submitted → Approved → Paid → Archived |
| Payment | Pending → Recorded → Reconciled → Archived |
| PayrollRun | Draft → Reviewed → Approved → Paid → Archived |

### 7.4 State Engine Service

```typescript
interface StateEngine {
  validateTransition(resourceId: string, toState: string, userId: string): Promise<ValidationResult>
  executeTransition(resourceId: string, toState: string, userId: string, reason?: string): Promise<Resource>
  getHistory(resourceId: string): Promise<StateHistoryEntry[]>
}

interface StateHistoryEntry {
  fromState: string;
  toState: string;
  actorId: string;
  reason?: string;
  occurredAt: string;
}
```

Approval-required transitions create an approval task and pause the workflow run at the `resource.change_state` node, identical to the `core.human_approval` mechanism.

---

## 8. Security

### 8.1 Current State

Authentication and membership are fully implemented. Fine-grained permission enforcement is partially implemented.

What exists:
- Supabase Auth with email/password and magic link
- JWT issued by Supabase, validated on every API request by `SupabaseJwtGuard`
- Organisation membership model with roles (`owner`, `admin`, `member`)
- Per-endpoint membership assertions in every service

### 8.2 Authentication Flow

```
Client → POST /auth/login → Supabase Auth → JWT
Client → API request with Bearer JWT → SupabaseJwtGuard validates → @CurrentUser() injects user
```

The `SupabaseJwtGuard` uses the Supabase admin client to verify the JWT. No session storage — every request is stateless.

### 8.3 Roles

**Current roles:**

| Role | Capabilities |
|---|---|
| owner | All operations including billing and user management |
| admin | All operations except billing and role management |
| member | Execute assigned tasks, upload documents, view assigned resources |

**Contractor Edition target roles:**

| Role | Capabilities |
|---|---|
| Owner | Everything — jobs, fleet, finance, payroll, AI assistant |
| Admin | Operational management without billing |
| Member | General office tasks |
| Driver | View assigned jobs, record trip events |
| Operator | View assigned equipment jobs, record hours |

### 8.4 Permission Model (Phase 6 Target)

Permissions are declarative rules per operation:

```typescript
interface PermissionPolicy {
  action: string;                // 'invoice.approve', 'resource.archive', etc.
  requiredRole?: string[];       // any of these roles can perform the action
  requiredState?: string[];      // resource must be in one of these states
  requiresApproval?: boolean;    // action triggers an approval workflow
}
```

The `SecurityEngine` service evaluates policies before every node execution, state transition, and resource mutation.

### 8.5 API Key Support (Phase 6 Target)

Programmatic access (integrations, cron runners, external systems) uses scoped API keys rather than user JWTs. API keys are issued per organisation, scoped to a permission set, and revocable at any time.

### 8.6 Security Guardrails

These are non-negotiable and are already enforced in the codebase:

- AI cannot approve, certify, or release payment
- AI cannot create final commercial facts without human acceptance
- Workflow execution requires a published version
- Every resource mutation records the actor and timestamp
- Organisation data is always scoped by `organisation_id` — cross-tenant reads are blocked at the service level

---

## 9. AI Runtime

### 9.1 Current State

`AiService` is a thin OpenAI Chat Completions wrapper with JSON mode support and a keyword fallback when no API key is configured. AI nodes call it directly. There is no context builder, tool calling layer, or output ledger.

### 9.2 AI Runtime Architecture (Phase 10 Target)

```
Owner question
    ↓
AI Runtime
    ├── Context Builder
    │     ├── Current user and permissions
    │     ├── Recent resources (last 7 days)
    │     ├── Recent events
    │     └── Available tools
    ├── Prompt Template Registry
    │     └── Named templates per use case
    ├── Tool Calling Layer
    │     ├── search_resources(type, filter)
    │     ├── get_events(type, since)
    │     └── get_workflow_status(workflowId)
    └── Output Ledger
          └── Stores every response with source context
```

### 9.3 AI Owner Assistant Example

```
Owner asks: "Which jobs are not invoiced yet?"

AI Runtime:
  1. Build context: organisation, user, permissions
  2. Call search_resources('Job', { state: ['Completed'] })
  3. Call get_events('Invoice.Generated', { since: '7d' })
  4. Subtract — find Jobs with no matching InvoiceGenerated event
  5. Answer: "3 jobs completed this week are not yet invoiced: Job-047, Job-051, Job-053"
  6. Store answer in output ledger with source resource IDs
```

### 9.4 AI Guardrails (Non-Negotiable)

These rules are implemented at every AI call site and must never be relaxed:

- AI **cannot** approve
- AI **cannot** certify
- AI **cannot** release payment
- AI **cannot** create final commercial facts without human acceptance
- AI must preserve source references in all operational and commercial answers
- AI output is marked advisory unless accepted through a workflow approval step
- AI responses that are used as inputs to financial or legal documents must pass through a human review node before they are committed

### 9.5 AI Nodes (Current)

| Node | Uses AI for |
|---|---|
| `qs.classify_trade` | BOQ trade classification |
| `procurement.generate_rfq` | RFQ document generation |
| `document.read_excel` | Table extraction from Excel |
| `qs.clean_boq` | BOQ normalisation and deduplication |

All AI nodes mark their outputs as extracted/advisory. None commit a result directly to a financial record without a subsequent human review node.

---

## 10. SDK

### 10.1 Overview

The LCE SDK is a collection of TypeScript packages that provide the contracts, base classes, and utilities for building nodes, packs, and solutions on top of LCE.

```
@lados/node-sdk          Node contract, manifest types, base class
@lados/pack-sdk          Pack manifest, permission types, node registration
@lados/execution-engine  DAG runner, graph planner, checkpoint types
@lados/shared-types      Cross-layer type contracts (ApiResponse, etc.)
@lados/workflow-json     Workflow schema, builder, validation
```

### 10.2 @lados/node-sdk

Defines the contract every node implementation must satisfy.

```typescript
// Core types
type ExecutionStatus = 'success' | 'failure' | 'paused' | 'pending_approval' | 'skipped';

interface NodeManifest {
  type: string;                      // e.g. 'fleet.assign_vehicle'
  name: string;
  description: string;
  category: NodeCategory;
  inputs: NodePort[];
  outputs: NodePort[];
  config: ConfigField[];
  events?: string[];                 // events this node emits
  requiredPermissions?: string[];    // permissions node requires
}

interface NodeContext {
  nodeId: string;
  nodeType: string;
  config: Record<string, unknown>;
  inputs: Record<string, unknown>;
  executionId?: string;
  workflowId: string;
  projectId: string;
  organizationId: string;
  userId: string;
  log: NodeLogger;
}

interface NodeExecuteResult {
  status: ExecutionStatus;
  outputs: Record<string, unknown>;
  logs?: string[];
  summary?: string;
  error?: { code: string; message: string };
}
```

**BaseNode abstract class:**

```typescript
abstract class BaseNode {
  abstract get manifest(): NodeManifest;
  abstract execute(ctx: NodeContext): Promise<NodeExecuteResult>;
  validate(config: unknown): NodeValidationResult { ... }
}
```

Node categories: `core`, `resource`, `event`, `document`, `ai`, `procurement`, `qs`, `fleet`, `finance`, `integration`.

### 10.3 @lados/pack-sdk

Defines the structure of an installable pack.

```typescript
interface PackManifest {
  packKey: string;
  name: string;
  version: string;
  engineCompatibility: string;       // semver range, e.g. '>=1.0.0 <2.0.0'
  dependencies: string[];            // other packKeys
  resources?: string[];              // resource types this pack introduces
  nodes: string[];                   // node types this pack registers
  workflows?: string[];              // workflow template IDs
  permissions: PackPermission[];
  events?: string[];                 // events this pack declares
  states?: string[];                 // state machine IDs
  migrations?: string[];             // SQL migration file names
}
```

A pack must also export:

```typescript
export function resolveNode(type: string): NodeExecutor | null
```

The execution engine calls this to resolve real node executors at runtime.

### 10.4 @lados/execution-engine

```typescript
// Entry point
function runWorkflow(options: RunnerOptions): Promise<ExecutionResult>

// Graph planner
function planWorkflow(definition: QSWorkflowDefinition): ExecutionPlan

// Key types
interface ExecutionResult {
  status: RunStatus;
  outputs: Record<string, unknown>;
  logs: NodeLogEntry[];
  error?: { code: string; message: string };
  startedAt: string;
  completedAt: string;
  durationMs: number;
  // Phase 1 pause fields
  pausedAtNodeId?: string;
  checkpointOutputs?: Record<string, Record<string, unknown>>;
  pendingApprovalTaskId?: string;
}

interface RunnerOptions {
  executionId?: string;
  workflowId: string;
  projectId: string;
  organizationId: string;
  userId: string;
  definition: QSWorkflowDefinition;
  inputs?: Record<string, unknown>;
  variables?: Record<string, unknown>;
  nodeResolver?: (type: string) => NodeExecutor | null;
  resumeFromCheckpoint?: ResumeCheckpoint;  // Phase 1
}

interface ResumeCheckpoint {
  pausedAtNodeId: string;
  checkpointOutputs: Record<string, Record<string, unknown>>;
  approvalResult: {
    approved: boolean;
    rejected: boolean;
    comments: string;
    approvalTaskId: string;
    decidedBy: string;
  };
}
```

### 10.5 @lados/shared-types

Cross-layer contracts:

```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error: string | null;
}

interface QSWorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: VariableDefinition[];
  trigger?: TriggerConfig;
}
```

### 10.6 @lados/workflow-json

Provides:
- Full `QSWorkflowDefinition` JSON schema
- `WorkflowBuilder` — fluent API for constructing workflow definitions programmatically
- `validateWorkflow(definition)` — returns validation errors before execution
- JSON serialization and deserialization utilities

---

## 11. Marketplace

### 11.1 Purpose

The Marketplace (Internal Registry) is where packs are discovered, installed, upgraded, enabled, and disabled. For LCE V1, it manages the packs installed on the current engine instance. In future versions it will connect to an external pack catalog.

**Current status:** `packs` and `registered_nodes` tables exist. Pack browser UI at `/packs`. Packs are seeded via SQL migrations. No runtime installer yet.

### 11.2 Pack Lifecycle

```
Available → Installing → Installed → Enabled
                                        ↓
                                    Disabled
                                        ↓
                                    Upgrading → Enabled
                                        ↓
                                    Uninstalling → Removed
```

### 11.3 Pack Installer (Phase 8 Target)

`PackInstaller` service:

```typescript
interface PackInstaller {
  install(manifest: PackManifest): Promise<InstallResult>
  upgrade(packKey: string, newManifest: PackManifest): Promise<UpgradeResult>
  enable(packKey: string): Promise<void>
  disable(packKey: string): Promise<void>
  uninstall(packKey: string): Promise<void>
  resolveDependencies(manifest: PackManifest): Promise<DependencyGraph>
}
```

Install sequence:
1. Validate engine compatibility
2. Resolve and validate dependencies (all must be installed first)
3. Run pack migrations in order
4. Register nodes in `registered_nodes`
5. Register resource types in `lados_resources` schema (via metadata)
6. Register state machines
7. Register events
8. Mark pack as `enabled` in `packs`

### 11.4 Dependency Rules

- Foundation Pack must be the first pack installed
- All packs declare their dependencies in `PackManifest.dependencies`
- Circular dependencies are rejected at validation time
- Upgrading a dependency triggers compatibility checks on all dependent packs

### 11.5 Current Pack Registry

| Pack Key | Status | Nodes |
|---|---|---|
| `core-pack` | Installed (SQL seeded) | Logger, Condition, Human Approval, Cron Trigger |
| `ai-pack` | Installed (SQL seeded) | AI Analyze, AI Extract, AI Summarize |
| `document-pack` | Installed (SQL seeded) | Upload File, Read Excel |
| `procurement-pack` | Installed (SQL seeded) | Generate RFQ, Generate PO |
| `qs-pack` | Installed (SQL seeded) | Read BOQ, Clean BOQ, Classify Trade, Split Work Package |

### 11.6 UI at /packs

The current pack browser at `/packs` and `/packs/[packId]` shows installed packs and their registered nodes. Phase 8 will add install, upgrade, enable/disable, and dependency graph views.

---

## 12. API

### 12.1 Base URL

```
http://localhost:4000/api/v1    (development)
https://api.lados.io/api/v1     (production)
```

### 12.2 Authentication

All endpoints require a Bearer JWT obtained from Supabase Auth:

```
Authorization: Bearer <supabase_access_token>
```

### 12.3 Response Envelope

All endpoints return `ApiResponse<T>`:

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

On error:

```json
{
  "success": false,
  "data": null,
  "error": "Human-readable error message"
}
```

### 12.4 Endpoint Reference

**Auth**

| Method | Path | Description |
|---|---|---|
| GET | `/health` | Health check |

**Organisations**

| Method | Path | Description |
|---|---|---|
| GET | `/organizations` | List user's orgs |
| POST | `/organizations` | Create org |
| GET | `/organizations/:id` | Get org |
| GET | `/organizations/:id/members` | List members |
| POST | `/organizations/:id/members` | Invite member |

**Projects**

| Method | Path | Description |
|---|---|---|
| GET | `/projects` | List projects across orgs |
| POST | `/projects` | Create project |
| GET | `/projects/:id` | Get project |
| PATCH | `/projects/:id` | Update project |

**Workflows**

| Method | Path | Description |
|---|---|---|
| GET | `/projects/:pId/workflows` | List workflows |
| POST | `/projects/:pId/workflows` | Create workflow |
| GET | `/projects/:pId/workflows/:id` | Get workflow |
| PATCH | `/projects/:pId/workflows/:id` | Update metadata |
| PUT | `/projects/:pId/workflows/:id/definition` | Auto-save canvas |
| POST | `/projects/:pId/workflows/:id/publish` | Publish version |
| GET | `/projects/:pId/workflows/:id/export` | Export bundle |
| POST | `/projects/:pId/workflows/import` | Import bundle |
| POST | `/projects/:pId/workflows/:id/versions` | Snapshot version |
| GET | `/projects/:pId/workflows/:id/versions` | List versions |
| POST | `/projects/:pId/workflows/:id/versions/:vId/restore` | Restore version |
| DELETE | `/projects/:pId/workflows/:id` | Delete workflow |

**Execution**

| Method | Path | Description |
|---|---|---|
| POST | `/workflows/:id/trigger` | Trigger run (fire-and-forget) |
| GET | `/runs/:runId` | Get run status |
| GET | `/runs/:runId/logs` | Get run logs |
| GET | `/workflows/:id/runs` | List runs for workflow |

**Approvals**

| Method | Path | Description |
|---|---|---|
| GET | `/approvals` | List pending tasks for current user |
| GET | `/approvals/run/:runId` | List tasks for a run |
| GET | `/approvals/:taskId` | Get single task |
| POST | `/approvals/:taskId/decide` | Approve or reject |

**Nodes**

| Method | Path | Description |
|---|---|---|
| GET | `/nodes` | List registered nodes |
| GET | `/nodes/:type` | Get node manifest |

**Packs**

| Method | Path | Description |
|---|---|---|
| GET | `/packs` | List installed packs |
| GET | `/packs/:id` | Get pack detail |

**Suppliers / RFQ / Quotations**

| Method | Path | Description |
|---|---|---|
| GET | `/suppliers` | List suppliers |
| POST | `/suppliers` | Create supplier |
| GET/PATCH/DELETE | `/suppliers/:id` | Manage supplier |
| POST | `/rfq-distributions` | Distribute RFQ |
| GET | `/projects/:id/quotations` | List quotations |

**Files**

| Method | Path | Description |
|---|---|---|
| POST | `/files/upload` | Upload file to Storage |
| GET | `/files/:id` | Get file metadata and URL |

**AI**

| Method | Path | Description |
|---|---|---|
| POST | `/ai/analyze` | Analyze document or text |

### 12.5 Pagination

List endpoints accept:

```
?page=1&limit=20&sort=created_at:desc
```

Response includes `{ data: [...], total, page, limit }`.

### 12.6 Error Codes

| HTTP | Meaning |
|---|---|
| 400 | Bad request — validation failed or business rule violation |
| 401 | Missing or invalid JWT |
| 403 | Authenticated but not authorised (membership check failed) |
| 404 | Resource not found |
| 409 | Conflict (duplicate key, state already set) |
| 500 | Internal server error — check API logs |

---

## 13. UI Framework

### 13.1 Application Shell

The app shell lives in `apps/web/src/app/(app)/layout.tsx`. It renders a fixed sidebar and a scrollable main content area.

Sidebar navigation:

```
Lados
  Dashboard
  Projects
  Approvals         ← Phase 1 addition
  Suppliers
  Packs
  Marketplace
  Services
```

Each nav item is an active-aware `<Link>` with icon and label. The notification bell and sign-out button are in the sidebar footer.

### 13.2 Workflow Canvas

The canvas at `/projects/[id]/workflows/[id]` is built on React Flow. Components:

| Component | Purpose |
|---|---|
| `WorkflowCanvas` | Main canvas — nodes, edges, toolbar, run controls |
| `NodePalette` | Draggable node list grouped by category |
| `SkillNode` | Custom React Flow node (active/muted/bypassed modes) |
| `PropertyPanel` | Config editor for selected node |
| `ExecutionLogPanel` | Per-node execution log, artifact section, pause/approve UI |
| `RunHistoryPanel` | List of past runs with status and duration |
| `VersionHistoryDrawer` | Version list with snapshot and restore actions |

### 13.3 Execution Log Panel (Phase 1)

When a run is `paused`, `ExecutionLogPanel` shows a `PausedApprovalBanner` with:
- Task title and description
- Optional comments textarea
- Approve and Reject buttons
- Calls `POST /approvals/:taskId/decide` on action
- Calls `onClose` on decision (triggers a run status re-poll)

Status styles:

| Status | Badge style |
|---|---|
| completed | green |
| failed | red |
| paused | amber |
| running | blue (pulse) |
| waiting | amber (no pulse) |
| skipped | gray |

### 13.4 Approval Inbox (/approvals)

Full-page inbox listing all pending approval tasks for the current user's organisations. Each card shows:
- Task title and description
- Node name, assignee role, requested timestamp
- Collapsible task data snapshot
- Comments textarea
- Approve / Reject buttons

Calls `GET /approvals` on load, re-polls on refresh. Removes the card optimistically on decision.

### 13.5 UI Principles

**Screens are the last expression.** The resource model and workflow definition are the product. The UI surfaces them — it does not own the business logic.

**Packs can contribute views.** A pack should be able to register a nav item and a set of page views without requiring changes to the app shell. This is a Phase 8 capability.

**Driver UI is tap-first.** The driver-facing screens for Trip recording must work one-handed, with large touch targets and minimal text input.

**AI output is visually marked advisory.** AI-generated content that has not been human-accepted carries a visible "AI draft — pending review" indicator.

---

## 14. Storage

### 14.1 Supabase Storage

All binary files — uploaded documents, generated PDFs, RFQ packages, fuel receipt images — are stored in Supabase Storage. The API's `FileService` manages upload, URL generation, and metadata persistence.

Buckets:

| Bucket | Contents |
|---|---|
| `documents` | User-uploaded documents (PDF, Excel, Word) |
| `rfq-packages` | Generated RFQ ZIP archives |
| `receipts` | Fuel receipt and expense images |
| `exports` | Workflow export bundles |

### 14.2 FileService

`FileService` in `apps/api/src/file/` handles:

```typescript
uploadFile(file: Express.Multer.File, organisationId: string, userId: string): Promise<FileRecord>
getSignedUrl(fileId: string, expiresIn?: number): Promise<string>
deleteFile(fileId: string): Promise<void>
```

Files are stored at `{bucket}/{organisationId}/{uuid}.{ext}`. Metadata (name, type, size, path) is persisted to a `files` table in PostgreSQL.

### 14.3 Document Library

`LibraryService` provides per-project document management:

- List library items by project
- Add file reference to library
- Remove from library (does not delete the underlying file)
- Get file with signed URL for download

### 14.4 Storage Guardrails

- All storage URLs are signed with a short expiry (default 2 hours) — no public bucket access
- Files are scoped to `organisationId` — cross-tenant file access is blocked at the service level
- AI-extracted content from documents is stored in the database, not re-read from storage on every request
- Receipt images submitted for fuel expense posting remain accessible until the expense is reconciled and archived

---

## 15. Deployment

### 15.1 Development Setup

Prerequisites: Node.js 20+, pnpm 9+, Supabase CLI

```bash
# Install dependencies
pnpm install

# Start Supabase locally
supabase start

# Apply migrations
supabase db push

# Start API and web
pnpm dev
```

`pnpm dev` uses Turborepo to start both `apps/api` (port 4000) and `apps/web` (port 3000) in watch mode.

### 15.2 Environment Variables

`apps/api/.env.local`:
```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service_role_key>
OPENAI_API_KEY=<openai_key>
NODE_ENV=development
```

`apps/web/.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

### 15.3 Database Migrations

Migrations live in `supabase/migrations/`. The naming convention is:

```
0001_initial_schema.sql
0002_organization_members.sql
...
0026_phase1_approvals_publish.sql
```

Apply all migrations:
```bash
supabase db push
```

Generate TypeScript types from schema:
```bash
supabase gen types typescript --local > packages/shared-types/src/supabase.ts
```

### 15.4 Building for Production

```bash
# Build all packages first
pnpm turbo build --filter='./packages/*' --filter='./packs/*'

# Build apps
pnpm turbo build --filter='./apps/*'
```

API output: `apps/api/dist/`  
Web output: `apps/web/.next/`

### 15.5 Production Considerations

- The API must run with a service role key that is never exposed to the browser
- Supabase RLS provides defence-in-depth but is not the primary enforcement layer
- The fire-and-forget async execution model (Phase 1) is suitable for MVP but must be replaced with a proper job queue before production traffic
- Workflow executions that modify financial records must be idempotent — the runner must be safe to replay after a process crash

### 15.6 Migration 0026 (Phase 1)

Migration 0026 adds Phase 1 columns. Apply it before starting the Phase 1 API:

```sql
-- execution_runs: pause/resume checkpoint
ALTER TABLE execution_runs
  ADD COLUMN IF NOT EXISTS paused_at_node_id  text,
  ADD COLUMN IF NOT EXISTS checkpoint_outputs jsonb DEFAULT '{}';

-- workflows: publish tracking
ALTER TABLE workflows
  ADD COLUMN IF NOT EXISTS published_version_id uuid REFERENCES workflow_versions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_at          timestamptz,
  ADD COLUMN IF NOT EXISTS published_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index for fast pending approval lookups
CREATE INDEX IF NOT EXISTS idx_approval_tasks_run_status
  ON approval_tasks (execution_id, status) WHERE status = 'pending';
```

---

## 16. Testing

### 16.1 Testing Strategy

LCE is tested at three levels:

**Level 1 — Unit tests** for pure functions: graph planner, state machine validator, workflow JSON builder, permission policy evaluator. These have no external dependencies.

**Level 2 — Service integration tests** for NestJS services with a real Supabase test database. Tests create organisations, run workflows, assert on database state.

**Level 3 — End-to-end tests** that drive the API via HTTP and assert on final resource states, event records, and run logs.

### 16.2 Node Tests

Every node implementation must have at minimum a smoke test:

```typescript
describe('fleet.assign_vehicle', () => {
  it('assigns a vehicle to a job and emits VehicleAssigned event', async () => {
    const ctx = buildMockContext({
      config: { vehicleId: 'v-001', jobId: 'j-001' },
      inputs: {},
    });
    const result = await assignVehicleNode.execute(ctx);
    expect(result.status).toBe('success');
    expect(result.outputs.assigned).toBe(true);
  });
});
```

`buildMockContext()` is provided by `@lados/node-sdk/testing`.

### 16.3 Workflow Runner Tests

The runner is tested with a mock node resolver:

```typescript
const result = await runWorkflow({
  definition: buildLinearWorkflow(['step-a', 'step-b']),
  nodeResolver: mockResolver({ 'step-a': successNode, 'step-b': successNode }),
  ...minimalOptions,
});
expect(result.status).toBe('completed');
expect(result.logs).toHaveLength(2);
```

Pause/resume must be explicitly tested:

```typescript
const pauseResult = await runWorkflow({ ..., nodeResolver: mockResolver({ 'step-a': pauseNode }) });
expect(pauseResult.status).toBe('paused');
expect(pauseResult.pausedAtNodeId).toBe('step-a');

const resumeResult = await runWorkflow({
  ...,
  resumeFromCheckpoint: {
    pausedAtNodeId: pauseResult.pausedAtNodeId!,
    checkpointOutputs: pauseResult.checkpointOutputs!,
    approvalResult: { approved: true, rejected: false, comments: 'OK', ... },
  },
  nodeResolver: mockResolver({ 'step-b': successNode }),
});
expect(resumeResult.status).toBe('completed');
```

### 16.4 Definition of Done

**For any engine feature:**
- Resource model updated where business objects are involved
- Events emitted for every important action
- State transition rules defined where lifecycle is involved
- Permission checks implemented at the engine level
- Audit record produced
- Pack or node manifest updated where applicable
- Smoke test added
- Documentation updated in the appropriate section of this document

**For any Contractor Edition feature:**
- Owner flow is complete
- Driver or operator flow is complete where applicable
- Resource, event, state, and security behaviour routes through LCE — not around it
- Dashboard impact is considered
- Invoice, payroll, and finance outputs are clearly Draft, Reviewed, Approved, or Paid
- AI behaviour is grounded and advisory

**For any node:**
- Node lives in its pack, not in the API module
- Inputs and outputs are schema-validated
- Config schema declared in node manifest
- Node emits the events it declares
- Node cannot bypass permission or approval guards
- Smoke test passes

---

## 17. Reference

### 17.1 Glossary

| Term | Definition |
|---|---|
| LCE | Lados Core Engine — the platform engine |
| Pack | An installable bundle of nodes, resources, workflows, events, and state machines for a domain |
| Solution | A named composition of packs (e.g. Contractor Edition) |
| Resource | A typed business object instance (Job, Invoice, Vehicle, etc.) managed by the Resource Engine |
| Node | A single executable step in a workflow with declared inputs, outputs, and config |
| Workflow | A directed acyclic graph of nodes defining a business process |
| Workflow Version | An immutable snapshot of a workflow definition |
| Published Version | The pinned snapshot used by execution runs |
| Run | A single execution instance of a workflow |
| Checkpoint | Persisted node outputs and paused state enabling pause/resume |
| Approval Task | A human action required to resume a paused workflow run |
| Event | A typed, immutable record of something that happened |
| State Machine | A configurable set of states and allowed transitions for a resource type |
| Foundation Pack | The mandatory base pack providing users, files, approvals, notifications, and AI context |
| NodeContext | Runtime context passed to every node execution |
| ExecutionResult | The final outcome of a workflow run, including logs and optional checkpoint |
| Fire-and-forget | Async execution pattern: trigger returns immediately, run continues in background |

### 17.2 Implementation Phases

| Phase | Name | Status |
|---|---|---|
| Phase 0 | Identity: @lados/, Lados branding | ✅ Complete |
| Phase 1 | Workflow Engine: real approvals, async execution, immutable versions | ✅ Complete |
| Phase 2 | Node Isolation: nodes move into packs | Pending |
| Phase 3 | Resource Engine: first-class business objects | Pending |
| Phase 4 | Event Bus: typed, immutable, subscribable | Pending |
| Phase 5 | State Engine: configurable lifecycle enforcement | Pending |
| Phase 6 | Security Engine: declarative permission policies | Pending |
| Phase 7 | Foundation Pack: universal capabilities packaged | Pending |
| Phase 8 | Pack Installer: runtime install, upgrade, enable, disable | Pending |
| Phase 9 | Contractor Edition: first real solution | Pending |
| Phase 10 | AI Runtime: context-aware, tool-calling, auditable | Pending |
| Phase 11 | Registry: operator-grade pack management | Pending |
| Phase 12 | Async Execution Queue: production-grade runner | Pending |
| Phase 13 | LEOS / JKR Blueprint: documented, not built | Deferred |

### 17.3 Supabase Migration Index

| Migration | Description |
|---|---|
| 0001 | Initial schema |
| 0002 | Organisation members |
| 0003 | Projects |
| 0004 | Workflows and versions |
| 0005 | Execution runs and logs |
| 0006 | Audit log |
| 0007 | Packs and registered nodes |
| 0008 | Notification tasks |
| 0009 | Approval tasks |
| 0010 | File storage metadata |
| 0011 | Document library |
| 0012 | Pipeline canvas |
| 0013 | Artifacts |
| 0014 | Services registry |
| 0015 | Supplier module |
| 0016 | RFQ distribution |
| 0017 | Quotations |
| 0018–0025 | Incremental schema refinements |
| 0026 | Phase 1: checkpoint columns, publish columns, approval index |

### 17.4 Node Catalog

#### Core Pack

| Type | Description |
|---|---|
| `core.human_approval` | Creates approval task, pauses execution until human decision |
| `core.logger` | Logs a message to the execution run log |
| `core.cron_trigger` | Cron-based workflow trigger |
| `workflow.condition` | Conditional branch on input value |

#### Document Pack

| Type | Description |
|---|---|
| `document.upload_file` | Uploads a file to Supabase Storage |
| `document.read_excel` | Parses an Excel workbook and returns structured rows |

#### QS Pack

| Type | Description |
|---|---|
| `qs.read_boq` | Reads a Bill of Quantities file |
| `qs.clean_boq` | Normalises and deduplicates BOQ rows |
| `qs.classify_trade` | AI-classifies BOQ items by trade |
| `qs.split_work_package` | Groups BOQ items into work packages |

#### Procurement Pack

| Type | Description |
|---|---|
| `procurement.generate_rfq` | Generates RFQ documents per trade |
| `procurement.generate_po` | Generates a Purchase Order document |

#### Artifact Nodes

| Type | Description |
|---|---|
| `project.save_artifact` | Saves a named artifact to the artifact store |
| `project.read_artifact` | Reads a named artifact |

### 17.5 Event Catalog

See Section 6.5 for the core event catalog. Each pack declares additional events in its manifest.

### 17.6 Resource Type Catalog

See Section 5.4 for the Contractor Edition resource type catalog. LEOS/JKR resource types are documented in `docs/LEOS/01_Deferred_Blueprint.md`.

### 17.7 AI Guardrail Checklist

Apply this checklist to every feature that touches AI output:

- [ ] AI output is not committed directly to a financial or legal record
- [ ] AI output passes through a human review node before being used as a workflow decision
- [ ] AI-generated content is visually marked as advisory in the UI
- [ ] AI response is stored in the output ledger with source resource references
- [ ] The approval workflow for this AI output is tested with both approved and rejected paths
- [ ] No approval bypass exists — not for demo mode, not for testing convenience

### 17.8 Scale Targets

| Area | LCE V1 Target |
|---|---|
| Engine modules (NestJS) | 30 to 60 |
| REST API endpoints | 150 to 300 |
| UI components | 150 to 250 |
| Core nodes (Foundation) | 20 to 30 |
| Total nodes across all packs | 80 to 120 |
| System packs | 10 to 20 |

| Area | Contractor Edition Target |
|---|---|
| Workflows | 40 to 70 |
| Nodes | 100 to 200 |
| Resource types | 15 to 25 |
| Dashboards | 5 to 10 |

| Area | LEOS / JKR Target (future) |
|---|---|
| Workflows | 300+ |
| Nodes | 800 to 1,500 |
| Resource types | 80+ |

---

*Lados Core Engine — LCE V1 — 2026-06-20*  
*This document is authoritative over all earlier QS-OS, V3, and @qsos/ documents.*
