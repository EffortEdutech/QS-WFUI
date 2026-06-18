# QS-OS Platform — Master Sprint Plan & Build Checklist

**Document status:** Living document — update as each task is completed  
**Architecture version:** V3  
**Repository:** `https://github.com/EffortEdutech/QS-WFUI`  
**Last updated:** 2026-06-18  

> **How to use this document:**  
> Mark each task `[x]` when done. Add notes under tasks when decisions change.  
> This document is the single source of truth for build progress.

---

## Standing Constraints (apply to every sprint)

- `NEVER commit .env to source control`
- `Do not put service-role or secret keys in frontend env vars`
- `AI is advisory only. AI must not approve, certify, decide entitlement, or impersonate a registered Professional Quantity Surveyor / Sr.`
- All DB changes go through numbered migration files in `supabase/migrations/`
- All new NestJS modules must be registered in `app.module.ts`
- TypeScript strict mode — no `any` without explicit cast comment

---

## Sprint History (Completed)

| Sprint | Theme | Status |
|---|---|---|
| S1–S2 | Monorepo scaffold, workflow canvas, DB foundations | ✅ Done |
| S5 | Node SDK, Pack SDK, NodePalette, PropertyPanel | ✅ Done |
| S6 | Execution engine, run logs, run button | ✅ Done |
| S7 | File uploads, BOQ Excel reader, real node implementations | ✅ Done |
| S8 | Project file library, LibraryPicker, library panel UI | ✅ Done |
| S9 | AI Service, classify trade, split work package, generate RFQ nodes | ✅ Done |
| S10 | Workflow templates, human approval node, demo seed, UI polish | ✅ Done |
| S11 | Pipeline canvas, PipelineModule, ArtifactModule, save/read artifact nodes | ✅ Done |
| S12 | Pipeline execution runtime, PipelineRunner, SwitchPathModal, PipelineRunLog | ✅ Done |

### Key files and architecture from completed sprints

```
apps/api/src/
  execution/          ExecutionService, real-nodes/
  pipeline/           PipelineModule (GET/PUT /projects/:id/pipeline)
  artifact/           ArtifactModule (GET/POST /projects/:id/artifacts)
  workflow/           WorkflowModule, WorkflowService
  templates/          TemplatesModule
  ai/                 AiService (OpenAI + keyword fallback)

apps/web/src/
  components/canvas/  WorkflowCanvas.tsx
  components/pipeline/ PipelineCanvas.tsx, PipelineRunner.ts,
                       WorkflowNode.tsx, SwitchNode.tsx,
                       SwitchPathModal.tsx, PipelineRunLog.tsx

packages/
  workflow-json/      validate.ts + dist/validate.js
  execution-engine/   ExecutionEngine

supabase/migrations/
  0001–0012           All DB schema history
```

---

## V3 Architecture Reference (summary)

```
QS-OS Platform
│
├── Core Runtime
│   ├── Workflow Execution Engine   ← ExecutionService (built)
│   ├── Skill Runtime               ← node resolver in ExecutionService (built)
│   ├── Pack Registry               ← registered_nodes + packs tables (built)
│   ├── Data Pack Registry          ← needs new table (Sprint 13)
│   ├── Permission Engine           ← Supabase RLS (partial)
│   └── Audit Engine                ← audit_logs table (partial)
│
├── Core Services
│   ├── AI Service                  ← AiService (built)
│   ├── OCR Service                 ← not built (Sprint 18)
│   ├── Document Service            ← scattered in nodes (Sprint 14)
│   ├── Geometry Service            ← not built (Sprint 18)
│   ├── Storage Service             ← Supabase Storage (built)
│   ├── Search Service              ← not built (Sprint 15)
│   ├── Notification Service        ← stub only (Sprint 16)
│   └── Billing Service             ← not built (future)
│
├── Capability Marketplace
│   └── Document, AI, Geometry, Estimation, Procurement,
│       Contract, Finance, Reporting Packs
│
├── Data Marketplace
│   └── Price Intelligence, Supplier, Material Catalogue,
│       Labour Rate, Equipment Rental, SMM Standards, Cost Index Packs
│
├── Workflow Designer (QS-WFUI)
│   ├── Skill Library               ← NodePalette rename (Sprint 13)
│   ├── Canvas                      ← WorkflowCanvas (built)
│   ├── Inspector                   ← PropertyPanel enrich (Sprint 13)
│   ├── Execution Console           ← ExecutionLogPanel (built, polish Sprint 13)
│   └── Artifact Viewer             ← stub (Sprint 17)
│
└── Project Workspace
    ├── Project Data                ← built
    ├── Workflows                   ← built
    ├── Pipeline                    ← built (Sprint 11–12)
    ├── Documents                   ← library (built)
    ├── Approvals                   ← auto-approve MVP (Sprint 16 real)
    ├── Executions                  ← built
    └── Audit Logs                  ← partial
```

---

## Terminology: V1/V2 → V3

| Old term | V3 term | Where to rename |
|---|---|---|
| Node | Skill | UI labels (keep `node` in code) |
| Node Library | Skill Library | Left panel header |
| Node Pack / Pack | Capability Pack | Pack grouping headers |
| Data Source | Data Pack | New browser tab |
| Property Panel | Skill Inspector | Right panel header |
| Run | Execution | Execution Console, logs |

---

---

# SPRINT 13 — V3 Surface Adaptation

**Goal:** Make QS-WFUI look and feel like a V3 Skills platform. No new execution features — UI language, Skill Library, Skill Inspector, and Data Pack browser stub.

**Prerequisite before starting:** Apply migration 0012 to Supabase. Restart NestJS API.

---

### S13-001 — UI Terminology Rename

**Files:** `NodePalette.tsx`, `PropertyPanel.tsx`, left panel headers, toolbar labels  
**What:** Replace visible UI text only. Do not rename TypeScript identifiers.

- [ ] `NodePalette.tsx` — header label: "Node Library" → "Skill Library"
- [ ] `NodePalette.tsx` — pack group headers: "Pack" → "Capability Pack"
- [ ] `PropertyPanel.tsx` — section header: "Properties" → "Skill Inspector"
- [ ] Workflow canvas toolbar — "Add Node" → "Add Skill" (if present)
- [ ] Execution log panel — "Node" references in display text → "Skill"

---

### S13-002 — Enrich `registered_nodes` Schema

**File:** `supabase/migrations/0013_v3_skill_metadata.sql`  
**What:** Add V3 metadata columns to `registered_nodes`. All new columns nullable so existing rows are unaffected.

- [ ] Add `description TEXT` column
- [ ] Add `input_ports JSONB` column — array of `{name, type, description, required}`
- [ ] Add `output_ports JSONB` column — array of `{name, type, description}`
- [ ] Add `uses_services TEXT[]` column — e.g. `['ai-service', 'storage-service']`
- [ ] Add `data_pack_deps TEXT[]` column — e.g. `['supplier-pack']`
- [ ] Seed all existing nodes with `description`, `input_ports`, `output_ports`, `uses_services`

**Seed target nodes:**

| Node | Description | Uses Services |
|---|---|---|
| `document.upload_file` | Upload a document to project storage | storage-service |
| `document.read_excel` | Read and parse an Excel file | storage-service |
| `document.read_boq` | Parse BOQ data from Excel | storage-service |
| `qs.classify_trade` | AI-classify BOQ items by construction trade | ai-service, audit-service |
| `qs.split_work_package` | Split classified BOQ into work packages | ai-service |
| `procurement.generate_rfq` | Generate RFQ document from work packages | ai-service, storage-service, audit-service |
| `core.human_approval` | Pause workflow for human approval | auth-service, audit-service |
| `project.save_artifact` | Save output to project artifact store | storage-service |
| `project.read_artifact` | Read a saved project artifact | storage-service |

---

### S13-003 — Rebuild NodePalette → SkillLibrary Component

**File:** `apps/web/src/components/canvas/NodePalette.tsx`  
**What:** Redesign left panel to show skills grouped by Capability Pack. Add search.

- [ ] Add search bar at top of panel — filters skills by name/description
- [ ] Group skills by `pack_id` — each pack renders as a collapsible accordion section
- [ ] Each pack section header shows: Pack icon + "Capability Pack" label + skill count
- [ ] Each skill card shows: skill name, short description, `uses_services` chips
- [ ] Drag-to-canvas still works (existing `onDragStart` handler preserved)
- [ ] Empty search state: "No skills match your search"
- [ ] Pack with no skills: hide from list

---

### S13-004 — Enrich PropertyPanel → SkillInspector

**File:** `apps/web/src/components/canvas/PropertyPanel.tsx`  
**What:** When a node is selected, right panel shows full V3 Skill Inspector view.

Inspector layout (top to bottom):

```
┌─────────────────────────────┐
│ [Icon] Skill Name           │  ← node label
│ Capability Pack: Pack Name  │  ← from pack_id
│ v1.0.0                      │  ← version
├─────────────────────────────┤
│ Description                 │  ← new description field
├─────────────────────────────┤
│ INPUTS     │ OUTPUTS        │  ← tab or two-column list
│ • name:type│ • name:type    │
├─────────────────────────────┤
│ Configuration               │  ← existing config form (unchanged)
│ [form fields...]            │
├─────────────────────────────┤
│ Uses Services               │  ← chips
│ 🤖 AI   💾 Storage 📋 Audit │
│ Uses Data Packs             │
│ 🏢 Supplier Pack            │  ← if any
└─────────────────────────────┘
```

- [ ] Fetch full node metadata from `/nodes/:nodeType` API endpoint (add if missing)
- [ ] Render pack name from `pack_id` lookup
- [ ] Render `description` text block
- [ ] Render `input_ports` list
- [ ] Render `output_ports` list
- [ ] Render `uses_services` chips with icons
- [ ] Render `data_pack_deps` chips (if present)
- [ ] Existing config form unchanged — rendered below

---

### S13-005 — Workflow JSON V3 Schema

**Files:** `packages/workflow-json/src/validate.ts`, `apps/api/src/workflow/`, canvas serialisation  
**What:** Add `skillId` and `packId` fields to workflow node JSON. Backward-compatible — keep `type` field.

V3 node format:
```json
{
  "id": "node-1",
  "type": "qs.classify_trade",
  "skillId": "qs.classify-boq-trade",
  "packId": "ai-pack",
  "position": { "x": 100, "y": 100 },
  "config": {}
}
```

- [ ] Update `WorkflowNodeData` interface — add optional `skillId?: string`, `packId?: string`
- [ ] Update canvas node serialisation to include `skillId` and `packId` when saving
- [ ] Update `validate.ts` — `skillId` and `packId` accepted but not required (backward compat)
- [ ] Rebuild `packages/workflow-json/dist/validate.js` after source change

---

### S13-006 — Data Pack Registry Table + Seed

**File:** `supabase/migrations/0014_data_pack_registry.sql`  
**What:** New table for Data Packs. Sprint 13 seed = 3 stubs. No live data yet.

Table: `data_packs`

```sql
id          TEXT PRIMARY KEY   -- e.g. 'supplier-pack'
name        TEXT NOT NULL      -- e.g. 'Supplier Pack'
description TEXT
category    TEXT               -- 'market-data' | 'standards' | 'reference'
status      TEXT DEFAULT 'coming_soon'  -- 'active' | 'coming_soon'
provider    TEXT DEFAULT 'EffortEdutech'
icon        TEXT               -- emoji or icon key
metadata    JSONB DEFAULT '{}'
```

Seed rows:
- `supplier-pack` — Supplier Pack — market-data — coming_soon
- `price-intelligence-pack` — Price Intelligence Pack — market-data — coming_soon
- `material-catalogue-pack` — Material Catalogue Pack — reference — coming_soon

- [ ] Write and apply migration 0014
- [ ] Add `GET /data-packs` endpoint in NestJS (DataPackModule)
- [ ] Register DataPackModule in `app.module.ts`

---

### S13-007 — Data Pack Browser UI Stub

**File:** `apps/web/src/components/canvas/DataPackBrowser.tsx` (new)  
**What:** New tab in the left panel showing available Data Packs. "Coming Soon" badges for stubs.

- [ ] Add "Data Packs" tab alongside "Skill Library" in left panel
- [ ] Fetch from `GET /data-packs`
- [ ] Each card shows: icon, name, description, `status` badge (Active / Coming Soon)
- [ ] "Coming Soon" cards are display-only, no interaction
- [ ] Active cards (future) will link to browse/connect workflow

---

### S13-008 — Business-First Execution Log Labels

**File:** `apps/web/src/components/canvas/ExecutionLogPanel.tsx`  
**What:** Show node display names in execution logs instead of technical IDs.

- [ ] Replace `node_type` display (e.g. `qs.classify_trade`) with node `name` (e.g. `Classify BOQ Trade`)
- [ ] Replace generic "Node executed" with action-oriented label from node `description`
- [ ] Status labels: "Running" → "Running…", "completed" → "✓ Done", "failed" → "✕ Failed"
- [ ] Keep technical details collapsed/expandable for developer mode

---

### S13-009 — Update BOQ-to-RFQ Demo Seed to V3 Schema

**File:** `supabase/seeds/` — update relevant demo seed SQL  
**What:** Demo workflow nodes should include `skillId` and `packId` in their definition JSON.

- [ ] Update demo seed workflow node JSON to include `skillId` + `packId`
- [ ] Verify demo workflow still loads and runs after schema change

---

### S13-010 — Skill Node Execution Modes (Mute / Bypass / Active)

**Reference:** `QS-OS_Switch_Mute_Bypass_Group_Design_Reference.md` §3.1–3.2, §6  
**Files:** `apps/web/src/components/canvas/WorkflowCanvas.tsx`, `WorkflowNodeData` interface, `packages/workflow-json/src/validate.ts`  
**What:** Add per-node `mode` field so designers can mute or bypass individual skills during testing. Design-time toggle only — no user interaction during execution.

```
Active  — node runs normally (default)
Muted   — node skipped, all outputs emit null  (🔇 grayed appearance)
Bypassed — node skipped, input[0] passed through to output[0]  (→ dashed appearance)
```

- [ ] Add `mode?: 'active' | 'muted' | 'bypassed'` to `WorkflowNodeData` interface
- [ ] Add `mode` field to workflow JSON node schema — accepted but not required in `validate.ts`
- [ ] Right-click context menu on canvas skill nodes: **Activate / 🔇 Mute / → Bypass**
- [ ] Muted node visual: gray background, reduced opacity, 🔇 badge top-right, dashed edges
- [ ] Bypassed node visual: dashed border, → badge top-right, thin blue dashed edges
- [ ] Save/restore `mode` when workflow JSON is saved and loaded
- [ ] Execution engine: check `mode` before running a node
  - `muted` → skip execution, emit `null` on all output ports
  - `bypassed` → skip execution, pass `input[0]` value → `output[0]`, `null` on rest
  - `active` → execute normally (existing behaviour)

---

### S13-011 — Skill Group (Visual, no bulk control yet)

**Reference:** `QS-OS_Switch_Mute_Bypass_Group_Design_Reference.md` §3.3, §7  
**Files:** `apps/web/src/components/canvas/WorkflowCanvas.tsx`, workflow JSON `ui.groups[]`  
**What:** Visual container that groups related skill nodes on the canvas. Stored in workflow JSON. No execution effect in this sprint — visual organisation only.

- [ ] Add "Group selected nodes" button to canvas toolbar (active when ≥ 2 nodes selected)
- [ ] `GroupNode` React Flow node type using `parentNode` approach — nodes inside move with group
- [ ] Group has: coloured background frame, editable name label, colour picker
- [ ] Right-click group → **Rename / Change colour / Ungroup**
- [ ] Save groups to `ui.groups[]` in workflow JSON per Vol 4 schema:
  ```json
  { "id": "group_rfq", "name": "RFQ Generation", "color": "#8B5CF6",
    "nodeIds": ["node-a", "node-b"], "collapsed": false, "mode": "active" }
  ```
- [ ] Load groups from workflow JSON on canvas open
- [ ] Collapse/expand group: collapsed shows single labelled box; nodes hidden

---

### S13-012 — Build Verification

- [ ] TypeScript typecheck passes (`tsc --noEmit`) across `apps/web` and `apps/api`
- [ ] Dev servers start without errors
- [ ] Skill Library shows packs grouped correctly
- [ ] Skill Inspector shows description, ports, service chips for a selected node
- [ ] Data Pack browser tab shows 3 stub cards
- [ ] Execution log shows display names not technical IDs
- [ ] Right-click a skill node → Mute → node grays out, 🔇 badge visible
- [ ] Right-click a skill node → Bypass → dashed border, → badge visible
- [ ] Muted/bypassed mode persists after save + reload of workflow
- [ ] Execution run: muted node is skipped, downstream receives null
- [ ] Execution run: bypassed node is skipped, downstream receives input value
- [ ] Group: select 2+ nodes → group them → group frame visible, labelled
- [ ] Group: collapse → single labelled box; expand → nodes reappear
- [ ] BOQ-to-RFQ demo workflow loads and runs end-to-end
- [ ] Git commit and push Sprint 13

---

---

# SPRINT 14 — Core Services Layer + Condition Node

**Goal:** Formalize Core Services as a named registry. Unify Document handling into a DocumentService. Add the Condition Node (data-driven routing within workflows). Add Group bulk controls.

---

### S14-001 — DocumentService (unified)

**File:** `apps/api/src/document/document.service.ts` (new module)  
**What:** Extract file-parsing logic from individual nodes into a shared NestJS service.

- [ ] Create `DocumentModule` with `DocumentService`
- [ ] Move Excel parsing logic from `read_excel` / `read_boq` nodes → `DocumentService.parseExcel()`
- [ ] Move PDF text extraction stub → `DocumentService.parsePdf()`
- [ ] Update `read_excel`, `read_boq`, `upload_file` nodes to call `DocumentService`
- [ ] Register `DocumentModule` in `app.module.ts`

---

### S14-002 — Core Service Registry Table + Seed

**File:** `supabase/migrations/0015_core_service_registry.sql`

Table: `core_services`

```
id, name, description, status ('active'|'stub'|'not_built'), version, metadata
```

Seed all 8 V3 services with current status:

| id | name | status |
|---|---|---|
| `ai-service` | AI Service | active |
| `storage-service` | Storage Service | active |
| `auth-service` | Authentication Service | active |
| `audit-service` | Audit Service | active |
| `document-service` | Document Service | active (after S14-001) |
| `notification-service` | Notification Service | stub |
| `ocr-service` | OCR Service | not_built |
| `geometry-service` | Geometry Service | not_built |
| `search-service` | Search Service | not_built |
| `billing-service` | Billing Service | not_built |

- [ ] Write and apply migration 0015
- [ ] Add `GET /services` endpoint
- [ ] Register in `app.module.ts`

---

### S14-003 — Services Status Panel (Admin/Settings)

**File:** `apps/web/src/app/(app)/settings/services/page.tsx` (new)

- [ ] New settings page: Platform Services
- [ ] List all core services with status badge (Active / Stub / Not Built)
- [ ] Add link from app Settings menu

---

### S14-004 — Notification Service Stub

**What:** In-app notification when a workflow reaches `human_approval` node

- [ ] Create `NotificationService` in NestJS — `notify(userId, message, type)` method
- [ ] Stub implementation: write to `notifications` table (new table in migration)
- [ ] Call `NotificationService` from `human_approval` node execution
- [ ] Frontend: notification bell icon in top bar — shows unread count + list

---

### S14-005 — Audit Engine Enrichment

**What:** Extend `audit_logs` to cover all service calls, not just approvals

- [ ] Add `service_id TEXT` column to `audit_logs` table
- [ ] AiService writes audit entry on each AI call (node, prompt hash, response summary)
- [ ] DocumentService writes audit entry on each file parse
- [ ] Audit log viewer in bottom drawer shows service column

---

### S14-006 — Condition Node (`workflow.condition`)

**Reference:** `QS-OS_Switch_Mute_Bypass_Group_Design_Reference.md` §3.4, §5  
**Files:** `apps/web/src/components/canvas/ConditionNode.tsx` (new), NestJS execution engine  
**What:** Data-driven routing node on the workflow canvas. Evaluates an expression from upstream outputs and automatically routes data to the true or false path. No user interaction during execution.

> **Distinct from Pipeline SwitchNode** (violet ◆, user-driven, Sprint 12).  
> Condition Node is teal ◇, data-driven, lives on the single-workflow canvas.

- [ ] New `ConditionNode` React Flow component — diamond shape, teal (`#0D9488`)
- [ ] Two output handles: `true_path` (top-right, labelled "✓ True") and `false_path` (bottom-right, labelled "✗ False")
- [ ] One input handle: `value` (left centre)
- [ ] Condition expression configured in Skill Inspector — text field with examples
- [ ] Register `workflow.condition` in `registered_nodes` + seed migration
- [ ] Execution engine: evaluate expression against input value at runtime
  - true → forward value to `true_path`, emit null on `false_path`
  - false → forward value to `false_path`, emit null on `true_path`
- [ ] Log condition evaluation to `execution_logs`: expression, input value, result (true/false)
- [ ] Supported expression types: `>=`, `<=`, `==`, `!=`, `includes`, `!= null`

---

### S14-007 — Skill Group Bulk Controls

**Reference:** `QS-OS_Switch_Mute_Bypass_Group_Design_Reference.md` §3.3, §7.3  
**What:** Extend the Skill Groups added in S13-011 with bulk mute/bypass controls on the group header.

- [ ] Group header shows mode toggle: **Active / 🔇 Mute All / → Bypass All**
- [ ] Clicking Mute Group: sets all `nodeIds` in the group to `mode: 'muted'`
- [ ] Clicking Bypass Group: sets all `nodeIds` in the group to `mode: 'bypassed'`
- [ ] Clicking Activate Group: restores all nodes to `mode: 'active'`
- [ ] Save group mode (`mode` field on `ui.groups[]` entry) in workflow JSON
- [ ] Execution engine: respect group mode — if group is muted, skip all nodes inside

---

### S14-008 — Build Verification

- [ ] DocumentService works — existing BOQ-to-RFQ demo runs correctly
- [ ] Services status page loads and shows all 9 services
- [ ] Notification appears after `human_approval` node
- [ ] Audit log shows service entries
- [ ] Condition Node: drag from Skill Library onto canvas — renders as teal diamond
- [ ] Condition Node: configure expression in Skill Inspector
- [ ] Execution run: condition evaluates correctly, routes to correct path
- [ ] Condition evaluation logged in execution log
- [ ] Group bulk mute: all nodes in group show 🔇, execution skips them
- [ ] Group bulk bypass: all nodes show →, execution passes input through
- [ ] Git commit and push Sprint 14

---

---

# SPRINT 15 — Pack Manager + Marketplace Preview

**Goal:** Users can browse installed Capability Packs, see their skills, and preview the Capability Marketplace. No real install/uninstall — UI scaffolding.

---

### S15-001 — Pack Manager Page

**File:** `apps/web/src/app/(app)/packs/page.tsx`

- [ ] New top-level nav item: "Packs"
- [ ] List all installed Capability Packs from `packs` table
- [ ] Each pack card: icon, name, description, version, skill count, status badge

---

### S15-002 — Pack Detail Page

**File:** `apps/web/src/app/(app)/packs/[packId]/page.tsx`

- [ ] Pack header: name, publisher, version, description
- [ ] Skills list — all skills/nodes from this pack
- [ ] Dependencies: which other packs this pack requires
- [ ] Optional Data Packs: which Data Packs this pack can use

---

### S15-003 — Capability Marketplace Browser

**File:** `apps/web/src/app/(app)/marketplace/page.tsx`

- [ ] Marketplace page with two tabs: Capability Packs | Data Packs
- [ ] Capability Packs tab: grid of pack cards (installed vs available)
- [ ] Data Packs tab: grid of data pack cards (mirrors Data Pack browser from S13-007)
- [ ] "Coming Soon" packs: display only, no install button yet
- [ ] Installed packs: show "Installed" badge + link to Pack Detail

---

### S15-004 — Search Service Stub

**What:** Global skill search across Skill Library

- [ ] `GET /nodes/search?q=` endpoint — query by name, description, pack
- [ ] Wire search bar in SkillLibrary (S13-003) to live API search
- [ ] Debounce 300ms

---

### S15-005 — Build Verification

- [ ] Pack Manager page lists all packs
- [ ] Pack Detail shows skills for a pack
- [ ] Marketplace page loads with both tabs
- [ ] Skill Library search returns results
- [ ] Git commit and push Sprint 15

---

---

# SPRINT 16 — Approval Inbox + Real Human Workflow

**Goal:** Replace auto-approve stub with real human approval flow. Approval Inbox page. Email notification via Supabase Edge Function.

---

### S16-001 — Approval Inbox Page

**File:** `apps/web/src/app/(app)/approvals/page.tsx`

- [ ] New nav item: "Approvals" with pending count badge
- [ ] List pending approvals: workflow name, project, submitted by, submitted at, item summary
- [ ] Filter: All / Pending / Approved / Rejected

---

### S16-002 — Approval Decision Form

**File:** component in approvals page

- [ ] Approve button + Reject button
- [ ] Comment field (required for rejection)
- [ ] AI-generated summary of the item for approval (advisory label: "AI Summary — not a professional assessment")
- [ ] Decision writes to `approval_records` table, updates `execution_runs` status

---

### S16-003 — Approval Gate Visual State on Canvas

**File:** `apps/web/src/components/canvas/WorkflowCanvas.tsx`

- [ ] When a run is paused at `human_approval`, the node shows a "⏸ Awaiting Approval" badge
- [ ] Badge links to the Approvals inbox
- [ ] Canvas polling: check run status every 5s when a run is in `waiting_approval` state

---

### S16-004 — Email Notification via Supabase Edge Function

- [ ] Supabase Edge Function: `notify-approval` — sends email using Resend or Supabase SMTP
- [ ] Trigger: called by `NotificationService` when approval is created
- [ ] Email content: workflow name, project, "Click here to review" link

---

### S16-005 — Build Verification

- [ ] Run BOQ-to-RFQ workflow — pauses at approval node
- [ ] Approval Inbox shows the pending item
- [ ] Approve it — workflow continues and completes
- [ ] Canvas shows approval resolved
- [ ] Git commit and push Sprint 16

---

---

# SPRINT 17 — Artifact Viewer + Document Output

**Goal:** Users can see generated documents from workflow executions and download them.

---

### S17-001 — Artifact Viewer Component

**File:** `apps/web/src/components/canvas/ArtifactViewer.tsx`

- [ ] Bottom drawer tab: "Generated Documents"
- [ ] List artifacts from current execution run
- [ ] Each row: file name, type (PDF/Excel/JSON), size, generated at, download button

---

### S17-002 — Execution Artifact Association

**What:** Link generated files to their execution run

- [ ] `execution_artifacts` table (migration) — `run_id`, `artifact_id`, `node_id`
- [ ] `project.save_artifact` node writes to `execution_artifacts`
- [ ] Artifact Viewer fetches `GET /executions/:runId/artifacts`

---

### S17-003 — PDF Preview

- [ ] Inline PDF preview using `<iframe>` or `react-pdf`
- [ ] Show preview panel when artifact row is clicked

---

### S17-004 — Excel Preview

- [ ] Inline table preview for `.xlsx` artifacts using `SheetJS`
- [ ] Show first 50 rows

---

### S17-005 — Build Verification

- [ ] Run BOQ-to-RFQ — artifact viewer shows generated RFQ files
- [ ] Download works
- [ ] PDF preview renders
- [ ] Git commit and push Sprint 17

---

---

# SPRINT 18 — OCR Service + Geometry Pack Phase 1

**Goal:** Enable reading scanned/PDF BOQ documents. Introduce first Geometry Pack skills (area calculator, basic measurement).

---

### S18-001 — OCR Service (Supabase Edge Function)

- [ ] Edge Function: `ocr-extract` — accepts image/PDF, returns extracted text
- [ ] Uses Tesseract.js or an AI vision call
- [ ] `OcrService` in NestJS wraps the Edge Function call
- [ ] Register `ocr-service` in core_services table as `active`

---

### S18-002 — Read PDF BOQ Node

**Node:** `document.read_pdf_boq`

- [ ] New node: accepts PDF file, calls OcrService, returns structured BOQ text
- [ ] Register in `registered_nodes` with `uses_services: ['ocr-service', 'ai-service']`
- [ ] Add to Document Pack

---

### S18-003 — Geometry Pack Stubs

- [ ] Register `geometry-pack` in `packs` table
- [ ] Add stub nodes: `geometry.calculate_area`, `geometry.calculate_length`, `geometry.calculate_volume`
- [ ] Nodes are registered but return mock output — real implementation in a later sprint
- [ ] Geometry Pack visible in Skill Library under "Geometry"

---

### S18-004 — Drawing Upload Node

**Node:** `document.upload_drawing`

- [ ] Accepts PDF/image drawing files
- [ ] Stores in Supabase Storage under `drawings/` bucket
- [ ] Returns `drawing_id` for downstream geometry nodes

---

### S18-005 — Build Verification

- [ ] PDF BOQ can be uploaded and OCR-extracted
- [ ] Geometry Pack visible in Skill Library
- [ ] Area calculator stub runs without error
- [ ] Git commit and push Sprint 18

---

---

# SPRINT 19 — Supplier Data Pack + Price Intelligence

**Goal:** First live Data Pack. Supplier directory. Price catalogue. `Match Suppliers` node uses real data.

---

### S19-001 — Supplier Data Model

**Migration:** `suppliers`, `supplier_products`, `supplier_prices` tables

- [ ] `suppliers` table: id, name, company_profile, contact, delivery_regions, certifications, status
- [ ] `supplier_products` table: id, supplier_id, material_code, name, unit, lead_time_days
- [ ] `supplier_prices` table: id, supplier_product_id, price, currency, region, valid_from, valid_to, verification_status

---

### S19-002 — Supplier Directory UI

**File:** `apps/web/src/app/(app)/data-packs/suppliers/page.tsx`

- [ ] Supplier listing page: search, filter by region, filter by category
- [ ] Supplier detail: company info, product catalogue, price list, ratings

---

### S19-003 — Price Intelligence Data Model + UI

- [ ] Price catalogue page: filter by material code, region, date range
- [ ] Price history chart per material

---

### S19-004 — Match Suppliers Node (live data)

**Node:** `procurement.match_suppliers` — currently stub

- [ ] Update node to query `supplier_products` + `supplier_prices` tables
- [ ] Returns ranked supplier list for a given material category
- [ ] Adds `data_pack_deps: ['supplier-pack']` to node registration

---

### S19-005 — Build Verification

- [ ] Supplier directory loads
- [ ] BOQ-to-RFQ workflow with `match_suppliers` node returns real supplier matches
- [ ] Price catalogue shows seeded data
- [ ] Git commit and push Sprint 19

---

---

# SPRINT 20 — Public Demo Polish

**Goal:** The platform is demo-ready. V3 MVP acceptance criteria all pass.

---

### S20-001 — Office Renovation Demo Project Seed

- [ ] Seed demo org, project "Office Renovation Package", demo user
- [ ] Pre-built BOQ-to-RFQ workflow using V3 JSON schema
- [ ] Sample BOQ Excel file attached to project library
- [ ] Workflow runnable out of the box on fresh DB

---

### S20-002 — V3 MVP Acceptance Criteria Walkthrough

Run through each of the 14 V3 acceptance criteria from the blueprint (Section 21):

- [ ] 1. Open a project
- [ ] 2. Open the BOQ-to-RFQ workflow
- [ ] 3. See a canvas with business skills
- [ ] 4. Browse skills by Capability Pack
- [ ] 5. Add a skill to the canvas
- [ ] 6. Connect two skills
- [ ] 7. Configure a selected skill
- [ ] 8. Save/export workflow as JSON
- [ ] 9. Run a mock execution
- [ ] 10. See execution logs
- [ ] 11. See an approval pause
- [ ] 12. Approve the workflow
- [ ] 13. See generated RFQ artifacts
- [ ] 14. Understand that the workflow uses multiple packs and data packs

---

### S20-003 — UI Polish Pass

- [ ] Consistent spacing and type scale across all pages
- [ ] Empty states on all list pages
- [ ] Loading skeletons on all data-fetching components
- [ ] Error boundary components on canvas and execution panel
- [ ] Mobile responsiveness check (not a primary target — document known gaps)

---

### S20-004 — Performance Audit

- [ ] Workflow canvas renders smoothly at 20+ nodes
- [ ] Skill Library search returns results < 200ms
- [ ] Execution log panel does not lag during live run
- [ ] Page load time < 3s on first visit

---

### S20-005 — Security Review

- [ ] `.env` not committed — verify with `git log --all -- .env`
- [ ] No service-role key in frontend bundle — verify with `grep -r SERVICE_ROLE apps/web/src`
- [ ] All API routes protected by JWT guard
- [ ] RLS policies correct on all tables
- [ ] AI advisory disclaimer visible on all AI-generated outputs

---

### S20-006 — Final E2E Test + Git Tag

- [ ] Full BOQ-to-RFQ run from upload to approved RFQ artifact
- [ ] Pipeline run across two workflows
- [ ] `git tag v1.0.0-demo`
- [ ] Git push with tag

---

---

# Future Backlog (Post-Demo)

These are intentionally NOT in the current sprint plan. Add to a sprint when prioritised.

```
[ ] Developer SDK documentation
[ ] Third-party Pack installer (real install/uninstall)
[ ] Supplier self-registration portal
[ ] Billing Service + subscription tiers
[ ] Geometry Pack — real drawing measurement (computer vision)
[ ] BIM/CAD reader integration
[ ] Construction Cost Index Pack
[ ] SMM Standards Pack (Standard Method of Measurement)
[ ] Contract Pack (clause extractor, variation order)
[ ] Finance Pack (payment certificate, retention)
[ ] Multi-user collaboration on workflow canvas (CRDT)
[ ] Workflow versioning (snapshot + rollback)
[ ] Public API documentation (OpenAPI/Swagger)
[ ] Mobile app (React Native or PWA)
[ ] Offline mode for field use
[ ] White-label / multi-tenant
```

---

---

# Sprint Planning Reference

## Summary table

| Sprint | Theme | Key deliverables | Status |
|---|---|---|---|
| S1–S12 | Foundation through Pipeline Runtime | See Sprint History | ✅ Done |
| S13 | V3 Surface Adaptation | Skill Library, Skill Inspector, Data Pack browser, node Mute/Bypass modes, Skill Groups | ⬜ Not started |
| S14 | Core Services + Routing | DocumentService, service registry, Condition Node (◇ data-driven routing), Group bulk controls | ⬜ Not started |
| S15 | Pack Manager + Marketplace | Pack browser, Capability + Data Marketplace UI | ⬜ Not started |
| S16 | Real Approval Workflow | Approval inbox, email notification, approval gate UI | ⬜ Not started |
| S17 | Artifact Viewer | Generated document list, PDF/Excel preview, download | ⬜ Not started |
| S18 | OCR + Geometry Pack Phase 1 | PDF BOQ reading, geometry stub nodes | ⬜ Not started |
| S19 | Supplier + Price Data Pack | Supplier directory, price catalogue, live match node | ⬜ Not started |
| S20 | Public Demo Polish | V3 acceptance criteria, security review, v1.0.0-demo tag | ⬜ Not started |

## Versioning convention

- Migration files: `NNNN_description.sql` — never skip numbers, never edit after applying
- Git tags: `sprint-XX-done` at end of each sprint, `v1.0.0-demo` at S20

## Definition of done (every task)

1. Code written and TypeScript typecheck passes
2. Feature manually verified in browser
3. Migration applied to Supabase (if any)
4. Checkbox marked `[x]` in this document
5. Committed and pushed to `main`
