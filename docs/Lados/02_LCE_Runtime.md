# 02 LCE Runtime

**Layer 2 — Engine: "How does Lados work?"**

> This document explains how the LCE execution environment is structured and how the Workflow Engine runs business processes. Audience: platform engineers extending or operating the engine.

---

## 1. Runtime Components

The LCE runtime has two main processes:

| Process | Technology | Port |
|---|---|---|
| API host | NestJS 10 (Node.js) | 4000 |
| Web app | Next.js 14 App Router | 3000 |

Both are managed by Turborepo in the monorepo. Start both:

```bash
pnpm dev
```

---

## 2. API Host (NestJS)

`apps/api` is the execution host. All workflow runs, resource mutations, event publishing, state transitions, security enforcement, and AI calls happen here.

### Module Layout

```
apps/api/src/
  app.module.ts              Root module — imports all feature modules
  common/
    supabase/                SupabaseService — @Global(), admin client
    guards/                  SupabaseJwtGuard
    decorators/              @CurrentUser()
    types/                   AuthenticatedRequest
  auth/                      Auth + session management
  organization/              Organisation and membership CRUD
  project/                   Project CRUD
  workflow/                  Workflow CRUD, versioning, publish, export/import
  execution/                 Trigger, resume, run history, logs
    real-nodes/              (Transitional) Real node implementations — Phase 2 moves these into packs
  approval/                  Approval inbox, decide endpoint (Phase 1)
  notification/              In-app notification service
  file/                      File upload to Supabase Storage
  library/                   Project document library
  ai/                        OpenAI wrapper (AiService)
  node/                      Node registry
  supplier/                  Supplier CRUD
  rfq-distribution/          RFQ distribution
  quotation/                 Quotation submission and comparison
```

### Global Services

`SupabaseService` is marked `@Global()` and injected everywhere. It provides:
- `admin` — Supabase admin client (service role key, bypasses RLS)
- `getClient(token)` — user-scoped client for RLS-sensitive reads

---

## 3. Web App (Next.js)

`apps/web` is the frontend. It uses the Next.js 14 App Router with an `(app)` route group for authenticated pages.

```
apps/web/src/
  app/
    (app)/
      layout.tsx             Sidebar + nav shell
      dashboard/             Owner dashboard
      projects/              Project list
      projects/[id]/
        workflows/[id]/      Workflow canvas
        quotations/          Quotation comparison
      approvals/             Approval inbox (Phase 1)
      suppliers/             Supplier list
      packs/                 Pack browser
  components/
    canvas/                  WorkflowCanvas, NodePalette, PropertyPanel,
                             ExecutionLogPanel, RunHistoryPanel, VersionHistoryDrawer
    notifications/           NotificationBell
  lib/
    api/client.ts            Thin API client — JWT auto-attached
    supabase/client.ts       Browser Supabase client (@supabase/ssr)
```

---

## 4. Database (Supabase / PostgreSQL)

All persistent state lives in Supabase. The API uses the admin client for all server-side operations. Access control is enforced at the NestJS service layer, not by RLS.

### Active Tables (Migration 0001–0026)

| Table | Purpose |
|---|---|
| `organisations` | Tenant root |
| `organization_members` | User → org with role |
| `projects` | Project container |
| `workflows` | Workflow definitions (draft) + publish metadata |
| `workflow_versions` | Immutable definition snapshots |
| `execution_runs` | Run records — status, inputs, outputs, checkpoint (Phase 1) |
| `execution_logs` | Per-node log entries |
| `approval_tasks` | Human approval task records |
| `notification_tasks` | In-app notification queue |
| `audit_log` | Human-readable audit trail |
| `packs` | Installed pack registry |
| `registered_nodes` | Node manifest registry |
| `suppliers` | Supplier/contractor records |
| `rfq_distributions` | RFQ send records |
| `quotations` | Submitted quotations |
| `pipeline_nodes` / `pipeline_edges` | Pipeline canvas |
| `artifacts` | Inter-workflow data store |

---

## 5. Workflow Engine

### 5.1 Workflow Definition

A workflow is a JSON document (`QSWorkflowDefinition`) containing nodes, edges, variables, and a trigger:

```typescript
interface QSWorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: VariableDefinition[];
  trigger?: TriggerConfig;
}

interface WorkflowNode {
  id: string;
  type: string;       // e.g. 'core.human_approval', 'fleet.assign_vehicle'
  label: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}
```

### 5.2 Graph Planner

`@lados/execution-engine/graph-planner.ts` converts a definition into an `ExecutionPlan` — topologically sorted steps with dependency declarations.

Cycles are detected before execution. A workflow with cycles is rejected immediately.

```typescript
const plan = planWorkflow(definition);
if (plan.cycles.length > 0) throw new Error('CYCLE_DETECTED');
// plan.steps — ordered execution sequence
```

### 5.3 Runner

`@lados/execution-engine/runner.ts` executes the plan:

1. Validate plan — reject cycles
2. Restore checkpoint if resuming (Phase 1)
3. For each step (topological order):
   - Resolve node executor (real or mock fallback)
   - Build `NodeContext` from completed outputs
   - Execute node
   - Handle: `success` → continue · `failure` → halt · `paused` → persist checkpoint + halt · `skipped` → continue
4. Return `ExecutionResult`

```typescript
const result = await runWorkflow({
  executionId, workflowId, projectId, organizationId, userId,
  definition, inputs, variables,
  nodeResolver,            // resolves real node executors by type string
  resumeFromCheckpoint,    // Phase 1: resume from a paused run
});
```

### 5.4 Node Execution Contract

Every node executor is a pure async function:

```typescript
type NodeExecutor = (ctx: NodeContext) => Promise<NodeExecuteResult>;
```

`NodeContext` carries the node's config, resolved inputs (from upstream node outputs), execution IDs, and a structured logger. `NodeExecuteResult` declares status, outputs, and optional error.

### 5.5 Pause and Resume (Phase 1)

When `core.human_approval` returns `{ status: 'paused' }`:

1. Runner records `pausedAtNodeId` and `checkpointOutputs` (all completed node outputs)
2. Remaining nodes are marked `waiting`
3. `ExecutionResult` carries `status: 'paused'` + checkpoint data
4. API persists `paused_at_node_id` + `checkpoint_outputs` to `execution_runs`

On resume (human approves or rejects via `/approvals/:taskId/decide`):

1. `ExecutionService.resumeRun()` fetches run + checkpoint from DB
2. Calls `runWorkflow()` with `resumeFromCheckpoint`
3. Runner pre-seeds `nodeOutputs` from checkpoint
4. Injects approval decision as the paused node's synthetic output
5. Skips all nodes already in `nodeOutputs`
6. Execution continues from the next unexecuted node

### 5.6 Fire-and-Forget Async Execution (Phase 1)

`ExecutionService.triggerRun()` is non-blocking:

1. Creates `execution_runs` row with `status: 'running'`
2. Starts `_executeAndPersist()` as an unresolved background promise
3. Returns `{ runId, status: 'running' }` immediately

The UI polls `GET /runs/:runId` until status changes. No Redis or BullMQ required in Phase 1.

Phase 12 will replace this with a proper job queue for production scale.

### 5.7 Published Versions (Phase 1)

Workflows have a **draft** (the live canvas) and an optional **published version** (immutable snapshot).

Publishing (`POST /workflows/:id/publish`):
1. Snapshots current definition into `workflow_versions`
2. Sets `published_version_id` + `published_at` + `published_by`
3. Sets workflow status to `active`

Execution guard: `triggerRun()` executes from the published snapshot. If none exists, returns `400 — publish first`. This prevents silent canvas edits from changing live workflow behaviour.

---

## 6. Real Nodes (Current)

Real node executors live in `apps/api/src/execution/real-nodes/` (transitional location — Phase 2 moves them into packs).

| Node Type | Description |
|---|---|
| `core.human_approval` | Creates approval task, pauses execution |
| `core.logger` | Writes to execution log |
| `core.cron_trigger` | Cron trigger stub |
| `workflow.condition` | Conditional branch |
| `project.save_artifact` | Saves named artifact |
| `project.read_artifact` | Reads named artifact |
| `document.upload_file` | Uploads file to Storage |
| `document.read_excel` | Parses Excel workbook |
| `qs.read_boq` | Reads BOQ file |
| `qs.clean_boq` | Normalises BOQ rows |
| `qs.classify_trade` | AI-classifies BOQ items |
| `qs.split_work_package` | Groups BOQ into work packages |
| `procurement.generate_rfq` | Generates RFQ documents |
| `procurement.generate_po` | Generates Purchase Order |

`buildRealNodeResolver()` maps type strings to executors and injects services (FileService, AiService, NotificationService, etc.) via closure.

---

## 7. Workflow Versioning

| Operation | What it does |
|---|---|
| `snapshotVersion(id, userId, label?)` | Creates immutable row in `workflow_versions` |
| `publish(id, userId)` | Snapshots + sets `published_version_id` + emits `workflow.published` audit |
| `restoreVersion(id, versionId, userId)` | Auto-saves current first, then overwrites draft |
| `listVersions(id, userId)` | Returns version list, newest first |

---

## 8. Package Build

Each `packages/*` and `packs/*` package is compiled with `tsc`. Output goes to `dist/`. The API and web apps resolve packages via pnpm workspace symlinks → `dist/`.

```bash
# Build all packages
pnpm turbo build

# Watch a single package
cd packages/execution-engine && pnpm build --watch
```

**Important:** When source types change, `dist/*.d.ts` must be rebuilt before the consuming app picks up the changes. On Windows with NTFS symlinks, the sandbox cannot run `tsc` — update `dist/*.d.ts` directly or run `pnpm build` on Windows.

---

*Previous: [01 LCE Architecture](01_LCE_Architecture.md) · Next: [03 LCE SDK](03_LCE_SDK.md)*
