# 07 LCE Reference

**Layer 3 — Developer: "How do I build with Lados?"**

> Catalogs, schemas, standards, and the definition of done. The single place for lookups. Audience: anyone building nodes, packs, workflows, or solutions on LCE.

---

## 1. Glossary

| Term | Definition |
|---|---|
| **LCE** | Lados Core Engine — the platform engine |
| **Pack** | Installable bundle of nodes, resources, workflows, events, and state machines for a domain |
| **Solution** | A named composition of packs (e.g. Contractor Edition) |
| **Resource** | A typed business object instance (Job, Invoice, Vehicle) managed by the Resource Engine |
| **Node** | A single executable step in a workflow with declared inputs, outputs, and config |
| **Workflow** | A directed acyclic graph of nodes defining a business process |
| **Workflow Version** | An immutable snapshot of a workflow definition created at any point |
| **Published Version** | The pinned snapshot executed by runs — set via `POST /workflows/:id/publish` |
| **Run** | A single execution instance of a workflow |
| **Checkpoint** | Persisted node outputs + paused state enabling pause/resume |
| **Approval Task** | Human action required to resume a paused workflow run |
| **Event** | A typed, immutable record of something that happened in the system |
| **State Machine** | Configurable states and allowed transitions for a resource type |
| **Foundation Pack** | Mandatory base pack — users, files, approvals, notifications, AI context |
| **NodeContext** | Runtime context passed to every node executor |
| **ExecutionResult** | Final outcome of a workflow run, including logs and optional checkpoint |
| **Fire-and-forget** | Async execution pattern: trigger returns immediately, run continues in background |
| **Advisory** | AI output that is not yet accepted by a human — must not be committed to financial or legal records |

---

## 2. Event System

### 2.1 Event Envelope Schema

```sql
CREATE TABLE lados_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      text NOT NULL,           -- 'Job.Created', 'Trip.Completed', etc.
  event_version   text NOT NULL DEFAULT '1.0.0',
  organisation_id uuid NOT NULL,
  actor_type      text NOT NULL,           -- 'user' | 'system' | 'workflow' | 'node'
  actor_id        uuid,
  resource_type   text,
  resource_id     uuid,
  workflow_id     uuid,
  node_id         text,
  payload         jsonb DEFAULT '{}',
  correlation_id  uuid,                    -- links events in the same workflow run
  causation_id    uuid,                    -- ID of event that caused this one
  occurred_at     timestamptz DEFAULT now()
);
```

Events are **append-only** — no updates, no deletes.

### 2.2 Event Publisher Pattern

```typescript
await eventBus.publish({
  eventType: 'Trip.Completed',
  organisationId,
  actorType: 'workflow',
  actorId: userId,
  resourceType: 'Trip',
  resourceId: tripId,
  payload: { jobId, vehicleId, driverId, tripCount },
  correlationId: runId,
});
```

### 2.3 Event Subscriber Pattern

```typescript
eventBus.subscribe('Trip.Completed', async (event) => {
  // update dashboard projection
  // notify owner
  // trigger invoice workflow if all trips done
});
```

### 2.4 Core Event Catalog

| Event Type | Emitted when |
|---|---|
| `Resource.Created` | Any resource created via Resource Engine |
| `Resource.Updated` | Any resource field updated |
| `Resource.Archived` | Resource archived |
| `Resource.StateChanged` | Resource transitions to a new state |
| `Workflow.Run.Started` | Execution run begins |
| `Workflow.Run.Completed` | Execution run completes successfully |
| `Workflow.Run.Paused` | Execution paused at approval node |
| `Workflow.Run.Resumed` | Execution resumed after approval decision |
| `Workflow.Run.Failed` | Execution run fails |
| `Workflow.Run.Cancelled` | Run cancelled by user |
| `Workflow.Published` | Workflow definition published as immutable version |
| `Approval.Requested` | Human approval task created |
| `Approval.Granted` | Approval task approved |
| `Approval.Rejected` | Approval task rejected |
| `File.Uploaded` | File uploaded to Supabase Storage |
| `Notification.Sent` | In-app notification delivered |
| `AI.ResponseGenerated` | AI produces a response |
| `AI.ResponseAccepted` | Human accepts an AI advisory output |
| `Pack.Installed` | Pack installed at runtime |
| `Pack.Upgraded` | Pack upgraded to new version |
| `Pack.Disabled` | Pack disabled |

---

## 3. State Engine

### 3.1 State Machine Definition Format

Declared in pack manifests:

```json
{
  "id": "vehicle_lifecycle",
  "resourceType": "Vehicle",
  "states": ["Available", "Assigned", "In Service", "Maintenance", "Retired"],
  "transitions": [
    { "from": "Available",   "to": "Assigned",    "permission": "fleet.assign" },
    { "from": "Assigned",    "to": "In Service",  "permission": "fleet.record" },
    { "from": "In Service",  "to": "Available",   "permission": "fleet.record" },
    { "from": "Available",   "to": "Maintenance", "permission": "fleet.maintain" },
    { "from": "Maintenance", "to": "Available",   "permission": "fleet.maintain" },
    { "from": "*",           "to": "Retired",     "permission": "fleet.retire", "requiresApproval": true }
  ]
}
```

### 3.2 Contractor Edition State Machines

| Resource | States |
|---|---|
| Job | Draft → Assigned → Active → Completed → Invoiced → Archived |
| Trip | Pending → In Progress → Completed → Disputed → Archived |
| Vehicle | Available → Assigned → In Service → Maintenance → Retired |
| Equipment | Available → Assigned → Working → Maintenance → Retired |
| FuelReceipt | Uploaded → Extracted → Reviewed → Approved → Posted → Archived |
| Invoice | Draft → Submitted → Approved → Paid → Archived |
| Payment | Pending → Recorded → Reconciled → Archived |
| PayrollRun | Draft → Reviewed → Approved → Paid → Archived |

### 3.3 State History Table

```sql
CREATE TABLE lados_state_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid NOT NULL,
  from_state  text,
  to_state    text NOT NULL,
  actor_id    uuid,
  reason      text,
  occurred_at timestamptz DEFAULT now()
);
```

---

## 4. UI Framework

### 4.1 Application Shell

`apps/web/src/app/(app)/layout.tsx` — fixed sidebar + scrollable main area.

Sidebar navigation (current):

```
Lados
  Dashboard
  Projects
  Approvals       ← Phase 1
  Suppliers
  Packs
  Marketplace
  Services
  ──────────
  Notifications
  Sign out
```

### 4.2 Canvas Components

| Component | Purpose |
|---|---|
| `WorkflowCanvas` | React Flow canvas — nodes, edges, toolbar, run controls |
| `NodePalette` | Draggable node list grouped by category |
| `SkillNode` | Custom React Flow node (active / muted / bypassed modes) |
| `PropertyPanel` | Config editor for selected node |
| `ExecutionLogPanel` | Per-node log, artifact section, pause/approve UI (Phase 1) |
| `RunHistoryPanel` | Past runs with status and duration |
| `VersionHistoryDrawer` | Version list with snapshot and restore actions |

### 4.3 Phase 1 UI Additions

**Approval Inbox (`/approvals`):**
- Lists all pending approval tasks for the user's organisations
- Each card: task title, description, node name, assignee role, timestamp
- Comments textarea + Approve / Reject buttons
- Calls `POST /approvals/:taskId/decide`
- Removes card optimistically on decision

**ExecutionLogPanel — Paused State:**
- When `run.status === 'paused'`, shows `PausedApprovalBanner`
- Fetches pending tasks for the run from `GET /approvals/run/:runId`
- Inline Approve / Reject with comments
- Calls `onClose` after decision (triggers run status re-poll)

### 4.4 UI Principles

**Screens are the last expression.** The resource model and workflow definition are the product. The UI surfaces them.

**Packs can contribute views.** A pack should be able to register a nav item and page views without touching the app shell (Phase 8 capability).

**Driver UI is tap-first.** Trip recording screens must work one-handed with large touch targets. Minimal text input.

**AI output is visually marked advisory.** AI-generated content that has not been human-accepted carries a visible "AI draft — pending review" indicator.

**Status colours:**

| Status | Badge |
|---|---|
| completed | Green |
| failed | Red |
| paused | Amber |
| running | Blue (pulsing) |
| waiting | Amber (no pulse) |
| skipped | Gray |

---

## 5. Node Catalog

### Core Pack

| Type | Description |
|---|---|
| `core.human_approval` | Creates approval task, pauses execution until human decision |
| `core.logger` | Logs a message to execution run log |
| `core.cron_trigger` | Cron-based workflow trigger (stub — Phase 1) |
| `workflow.condition` | Conditional branch on input value |

### Artifact Nodes

| Type | Description |
|---|---|
| `project.save_artifact` | Saves named artifact to artifact store |
| `project.read_artifact` | Reads named artifact |

### Document Pack

| Type | Description |
|---|---|
| `document.upload_file` | Uploads file to Supabase Storage |
| `document.read_excel` | Parses Excel workbook into structured rows |

### QS Pack

| Type | Description |
|---|---|
| `qs.read_boq` | Reads a Bill of Quantities file |
| `qs.clean_boq` | Normalises and deduplicates BOQ rows |
| `qs.classify_trade` | AI-classifies BOQ items by trade |
| `qs.split_work_package` | Groups BOQ items into work packages |

### Procurement Pack

| Type | Description |
|---|---|
| `procurement.generate_rfq` | Generates RFQ documents per trade |
| `procurement.generate_po` | Generates a Purchase Order document |

### Foundation Pack Nodes (Phase 7 Target)

| Type | Description |
|---|---|
| `resource.create` | Create a resource instance |
| `resource.update` | Update resource fields |
| `resource.find` | Find resource by ID or filter |
| `resource.search` | Search resources by type and filter |
| `resource.archive` | Archive a resource |
| `resource.relate` | Link two resources |
| `resource.change_state` | Transition resource state |
| `event.emit` | Emit a typed event to the Event Bus |
| `notification.send` | Send in-app notification |
| `approval.request` | Create and assign approval task |
| `file.upload` | Upload file (Foundation-level) |
| `file.generate_pdf` | Generate PDF from template |
| `user.assign` | Assign user to a resource or task |

---

## 6. Testing Standards

### 6.1 Testing Levels

| Level | What | Where |
|---|---|---|
| Unit | Pure functions — graph planner, state validator, workflow builder | `packages/*/src/__tests__/` |
| Service integration | NestJS services with real Supabase test DB | `apps/api/test/` |
| End-to-end | HTTP → API → DB assertions on resources, events, and run logs | `apps/api/test/e2e/` |

### 6.2 Node Smoke Test Pattern

```typescript
import { buildMockContext } from '@lados/node-sdk/testing';

describe('fleet.assign_vehicle', () => {
  it('assigns vehicle and returns success', async () => {
    const ctx = buildMockContext({
      config: { notifyDriver: false },
      inputs: { jobId: 'j-001', vehicleId: 'v-001' },
    });
    const result = await new AssignVehicleNode().execute(ctx);
    expect(result.status).toBe('success');
    expect(result.outputs.assigned).toBe(true);
  });
});
```

### 6.3 Pause/Resume Test Pattern

```typescript
it('pauses at approval node and resumes correctly', async () => {
  const pauseResult = await runWorkflow({
    definition: twoNodeWorkflow(['approval', 'logger']),
    nodeResolver: mockResolver({ 'approval': pauseNode, 'logger': successNode }),
    ...baseOptions,
  });
  expect(pauseResult.status).toBe('paused');
  expect(pauseResult.pausedAtNodeId).toBe('approval');

  const resumeResult = await runWorkflow({
    ...baseOptions,
    resumeFromCheckpoint: {
      pausedAtNodeId: pauseResult.pausedAtNodeId!,
      checkpointOutputs: pauseResult.checkpointOutputs!,
      approvalResult: { approved: true, rejected: false, comments: 'OK',
                        approvalTaskId: 'task-1', decidedBy: 'user-1' },
    },
    nodeResolver: mockResolver({ 'logger': successNode }),
  });
  expect(resumeResult.status).toBe('completed');
  expect(resumeResult.logs).toHaveLength(2);
});
```

### 6.4 Definition of Done

**Engine feature:**
- Resource model updated where business objects are involved
- Events emitted for every important action
- State transition rules defined where lifecycle is involved
- Permission checks at engine level
- Audit record produced
- Pack/node manifest updated
- Smoke test added
- This reference updated

**Contractor Edition feature:**
- Owner flow complete
- Driver/operator flow complete where applicable
- Resources, events, state, and security route through LCE — not around it
- Dashboard impact considered
- Financial outputs clearly labelled: Draft / Reviewed / Approved / Paid
- AI behaviour is grounded and advisory

**Node implementation:**
- Node lives in its pack, not in the API module
- Inputs and outputs schema-validated
- Config schema declared in manifest
- Node emits declared events
- Cannot bypass permission or approval guards
- Smoke test passes

---

## 7. Migration Index

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

---

## 8. AI Guardrail Checklist

Apply to **every** feature that involves AI output:

- [ ] AI output is not committed directly to a financial or legal record
- [ ] AI output passes through a human review node before being a workflow decision
- [ ] AI-generated content is visually marked advisory in the UI
- [ ] AI response is stored in the output ledger with source resource references
- [ ] Both approved and rejected paths are tested
- [ ] No approval bypass exists in any mode or environment

---

## 9. Scale Targets

| Area | LCE V1 | Contractor Edition | LEOS / JKR |
|---|---|---|---|
| Engine modules | 80–150 | — | — |
| API endpoints | 150–300 | — | — |
| UI components | 150–250 | — | — |
| Core nodes (Foundation) | 20–30 | — | — |
| Total nodes across packs | 80–120 | 100–200 | 800–1,500 |
| System packs | 10–20 | 9 | 12+ |
| Workflows | — | 40–70 | 300+ |
| Resource types | — | 15–25 | 80+ |
| Dashboards | — | 5–10 | — |

---

*Previous: [06 LCE Ecosystem](06_LCE_Ecosystem.md) · Next: [20 Contractor Edition](20_Contractor_Edition.md)*
