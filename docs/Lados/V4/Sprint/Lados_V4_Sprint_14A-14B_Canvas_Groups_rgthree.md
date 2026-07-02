# Lados — Sprint Plan: Sprint 14A + 14B  
## Canvas Skill Groups & Selective Group Execution (rgthree-inspired)

**Platform:** Lados — Universal Business Workflow Engine  
**Version:** V4  
**Prepared:** 2026-06-30  
**Status:** 🟡 Sprint 14A implementation pass complete; browser verification pending  

---

## Overview

These two sprints implement the visual grouping and selective execution features inspired by the **rgthree-comfy** ComfyUI extension. They are canvas-layer enhancements that sit on top of the Phase 13–15 Canvas UX foundation.

| Sprint | Focus | Phase Tag |
|--------|-------|-----------|
| **Sprint 14A** | Canvas Skill Groups + Group Execution Modes | Phase A + B |
| **Sprint 14B** | Selective Group Execution ("Run Group") | Phase C |

> **Design reference:** `docs/Lados/V4/Design/Lados_rgthree_Canvas_Upgrade_Paper.md`  
> Sprint 14B depends on Sprint 14A being fully complete.

---

## What Is Already Built

| Feature | Status | Location |
|---------|--------|----------|
| Individual node Active / Mute / Bypass | ✅ Done | `WorkflowCanvas` node context menu |
| Pack-level bulk controls | ✅ Done | Skill Library sidebar |

## What These Sprints Add

| Feature | Sprint | Paper Section |
|---------|--------|---------------|
| `SkillGroupNode` visual container on canvas | 14A | §4.1 |
| Group creation (keyboard `G`, toolbar, right-click) | 14A | §4.1 |
| Drag-to-join / leave group membership | 14A | §4.1 |
| Persist + restore groups in workflow JSON | 14A | §5.1 |
| Group header Mute / Bypass / Activate controls | 14A | §4.2 |
| Execution engine group mode enforcement | 14A | §5.4 |
| `SkillGroupControlsPanel` sidebar | 14A | §4.5 |
| Toggle restriction (radio mode) | 14A | §4.4 |
| `group_run_logs` migration (0048) | 14B | §5.5 |
| Sub-graph extraction helper | 14B | §5.3 |
| `POST /workflows/:id/run-group` endpoint | 14B | §4.3 |
| `RunGroupModal` component | 14B | §4.3 |
| Execution Console "Group Runs" tab | 14B | §4.3 |
| Right-click "Run Group" context menu on group | 14B | §4.3 |

---

---

# SPRINT 14A — Canvas Skill Groups (Phase A + B)

**Goal:** Add visual Skill Groups to the workflow canvas and wire group-level execution modes (Mute / Bypass / Activate). Phase A = visual grouping only. Phase B = group mode controls + engine enforcement.

**Reference:** `docs/Lados/V4/Design/Lados_rgthree_Canvas_Upgrade_Paper.md` §4.1, §4.2, §4.4, §4.5, §6.1, §6.2

---

### S14A-001 — SkillGroupNode React Flow Component (Phase A)

**File:** `apps/web/src/components/canvas/SkillGroupNode.tsx` (new)  
**What:** Custom React Flow node type for the group container — coloured frame, header bar, resize handles, name editor, collapse toggle.

- [x] Create `SkillGroupNode` functional component
- [x] Render semi-transparent coloured background with 2px solid border (group colour)
- [x] Header bar: group name (editable inline), mode badge, colour picker swatch, collapse arrow
- [x] `NodeResizer` on all 4 corners + 4 edge midpoints (from React Flow v11 export)
- [x] Collapse / expand: collapsed → compact card (name + mode badge + node count); expanded → full frame
- [x] Save `collapsed` state to `ui.groups[].collapsed` via workflow state update
- [x] Register in `WorkflowCanvas` as custom node type `"skillGroup"`

---

### S14A-002 — Group Creation Interaction (Phase A)

**File:** `apps/web/src/components/canvas/WorkflowCanvas.tsx`  
**What:** Let designers create groups from selected nodes.

- [x] Keyboard shortcut `G` — when ≥ 2 skill nodes selected, create a group around them
- [x] Toolbar button: Group icon (active when ≥ 2 nodes selected)
- [x] Right-click multi-select → "Group selected nodes" context menu item
- [x] Auto-compute group bounds = bounding box of selected nodes + 40px padding
- [x] Add group to `ui.groups[]` in workflow JSON immediately (generate `id`, default name, default colour)
- [x] Assign selected nodes as group members via `ui.groups[].nodeIds`

> Implementation note: this pass does not set React Flow `parentNode`; Lados keeps absolute node coordinates and stores group membership in `ui.groups[].nodeIds` to avoid rewriting existing workflow node positions.

---

### S14A-003 — Group Membership: Drag to Join / Leave (Phase A)

**File:** `apps/web/src/components/canvas/WorkflowCanvas.tsx`  
**What:** When a skill node is dragged inside a group boundary, it automatically becomes a group member. Dragged out → removed.

- [x] On node drag-stop: check if node centre is inside any group bounds
- [x] If inside a group → add `nodeId` to `ui.groups[groupId].nodeIds`
- [x] If previously in a group and now outside → remove from `nodeIds`
- [x] Right-click node → "Remove from group" option

---

### S14A-004 — Persist + Restore Groups in Workflow JSON (Phase A)

**Files:** `WorkflowCanvas` serialisation, `packages/workflow-json/src/validate.ts`  
**What:** Groups must survive save and reload.

- [x] On workflow save: serialise `ui.groups[]` array with `id`, `name`, `color`, `nodeIds`, `collapsed`, `mode`, `toggleRestriction`, `bounds`
- [x] On workflow load: restore `SkillGroupNode` instances from `ui.groups[]`
- [x] Update `validate.ts` schema to accept all new group fields (all optional, backward-compat)
- [x] Rebuild `@lados/workflow-json` dist output

**Workflow JSON schema additions:**
```json
{
  "ui": {
    "groups": [
      {
        "id": "grp_abc123",
        "name": "RFQ Generation",
        "color": "#6366F1",
        "nodeIds": ["node_1", "node_2"],
        "collapsed": false,
        "mode": "active",
        "toggleRestriction": "default",
        "bounds": { "x": 120, "y": 80, "width": 600, "height": 400 }
      }
    ]
  }
}
```

---

### S14A-005 — Group Mode Controls on Header (Phase B)

**Files:** `SkillGroupNode.tsx`, `WorkflowCanvas.tsx`  
**What:** Three buttons on the group header that set all member nodes to a mode simultaneously.

- [x] Add `▶ Activate` | `🔇 Mute` | `→ Bypass` buttons to group header
- [x] On Mute click: set `ui.groups[id].mode = 'muted'`; set `mode: 'muted'` on all `nodeIds`
- [x] On Bypass click: set `ui.groups[id].mode = 'bypassed'`; set `mode: 'bypassed'` on all `nodeIds`
- [x] On Activate click: set `ui.groups[id].mode = 'active'`; restore `mode: 'active'` on all `nodeIds`
- [x] Mode badge in header updates to reflect current group mode
- [x] Save `ui.groups[].mode` in workflow JSON

---

### S14A-006 — Execution Engine: Group Mode Enforcement (Phase B)

**File:** WorkflowRunner / execution engine  
**What:** Execution engine checks group membership before running each node.

**Group mode precedence** (from paper §5.4):

| Priority | Rule |
|----------|------|
| 1 (highest) | Individual node `muted` always wins |
| 2 | Group `muted` → skip all members, emit null on all outputs |
| 3 | Group `bypassed` (and node not individually muted) → bypass node |
| 4 | Node's own `mode` field (existing logic) |

- [x] Before executing a node, resolve effective mode:
  - If node is in a group with `mode: 'muted'` → skip, emit null on all outputs (group wins)
  - If node is in a group with `mode: 'bypassed'` AND node's own mode is NOT `muted` → bypass
  - Otherwise, use node's own `mode` field (existing logic unchanged)
- [x] Add helper `resolveNodeEffectiveMode(node, groups[])` to keep logic clean
- [x] Log resolved mode to execution log when it differs from node's own mode (e.g. `"Muted by group: RFQ Generation"`)

---

### S14A-007 — Skill Group Controls Panel (Phase B)

**File:** `apps/web/src/components/canvas/SkillGroupControlsPanel.tsx` (new)  
**What:** Sidebar panel listing all groups with bulk toggle buttons — the rgthree "Fast Groups Muter/Bypasser" equivalent for Lados.

- [x] Floating canvas panel added for current implementation pass
- [x] Only visible when workflow has ≥ 1 group
- [x] One row per group: colour swatch, group name, node count badge, `▶` / `🔇` / `→` buttons
- [x] Clicking group name → `fitView` zooms canvas to centre on that group
- [x] Buttons trigger same logic as S14A-005 group header buttons

> Implementation note: panel is currently a floating canvas panel because group state lives inside `WorkflowCanvas`; moving it below the external Skill Library can be done when canvas state is lifted to the workflow page shell.

---

### S14A-008 — Toggle Restriction (Radio Mode) (Phase B)

**File:** `WorkflowCanvas.tsx`  
**What:** Optional `toggleRestriction` property on a group.

| Value | Behaviour |
|-------|-----------|
| `default` | No restriction — any combination of group modes allowed |
| `max-one` | At most one group in the workflow may be active at a time |
| `always-one` | Exactly one group must always be active; de-activation blocked if last active |

- [ ] Right-click group header → "Group settings" → modal with `toggleRestriction` dropdown
- [x] Save `toggleRestriction` to `ui.groups[].toggleRestriction`
- [x] `max-one` enforcement: when activating a group, auto-mute all other `max-one` groups in the workflow
- [x] `always-one` enforcement: block de-activation when this is the last active `always-one` group

---

### S14A-009 — Build Verification

- [ ] Select 2+ nodes → press `G` → group frame appears around them
- [ ] Group name editable inline; colour picker changes frame colour
- [ ] Drag a node inside group boundary → it joins the group
- [ ] Collapse group → single compact card; expand → nodes reappear
- [ ] Click 🔇 Mute on group header → all nodes show 🔇 badge; execution skips them
- [ ] Click → Bypass → nodes show dashed border; execution passes input through
- [ ] Group Controls Panel lists the group; clicking name zooms canvas to it
- [ ] Toggle restriction `max-one`: activate group A → group B auto-mutes
- [ ] Group state persists after workflow save + reload
- [x] TypeScript typecheck passes
- [x] Full workspace build passes
- [ ] Dev servers start without errors
- [ ] Git commit and push Sprint 14A

---

### Sprint 14A Progress Update — 2026-06-30

**What's done**

- Added persistent `ui.groups[]` workflow JSON support through `@lados/shared-types` and `@lados/workflow-json` validation.
- Added `SkillGroupNode` and `SkillGroupControlsPanel` for visual group frames, inline naming, colour, collapse, resize, group mode controls, and group focus.
- Wired `WorkflowCanvas` group creation from selected skills, keyboard `G`, toolbar action, drag-to-join / drag-to-leave membership, group save/load, and group mode propagation to member nodes.
- Added execution-engine effective mode resolution so individual `muted`, group `muted`, group `bypassed`, and node mode precedence is enforced at runtime.
- Verified `corepack pnpm typecheck` passes and rebuilt changed packages with `corepack pnpm --filter @lados/shared-types build`, `corepack pnpm --filter @lados/workflow-json build`, and `corepack pnpm --filter @lados/execution-engine build`.

**What's next**

- Browser verify group create, resize, collapse, membership, save/reload, and group mode execution behavior.
- Start Sprint 14B after Sprint 14A browser verification is signed off.

**Ad-hoc to complete**

- Add a visible group settings UI for `toggleRestriction`; stored-value enforcement is already implemented.
- Move the group controls panel below the Skill Library when group state is lifted out of `WorkflowCanvas`.
- Dev server launch was attempted; foreground run showed ports 3000 and 4000 were already in use at that time, so browser verification remains pending.

---

# SPRINT 14B — Selective Group Execution ("Run Group") (Phase C)

**Goal:** Allow designers to run only the nodes inside a named group, with user-supplied test inputs, without executing the entire workflow. This enables rapid iterative development of individual workflow segments.

**Reference:** `docs/Lados/V4/Design/Lados_rgthree_Canvas_Upgrade_Paper.md` §4.3, §5.3, §6.3

**Depends on:** Sprint 14A fully complete.

---

### S14B-001 — `group_run_logs` Table Migration

**File:** `supabase/migrations/0048_group_run_logs.sql`

```sql
CREATE TABLE group_run_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id   UUID NOT NULL REFERENCES workflows(id),
  group_id      TEXT NOT NULL,
  group_name    TEXT,
  triggered_by  UUID REFERENCES auth.users(id),
  run_at        TIMESTAMPTZ DEFAULT now(),
  status        TEXT DEFAULT 'running',  -- 'running' | 'completed' | 'failed'
  node_results  JSONB DEFAULT '{}',
  duration_ms   INTEGER,
  error         TEXT
);
```

- [x] Write migration file `supabase/migrations/0048_group_run_logs.sql`
- [ ] Apply via Supabase Dashboard SQL editor (free tier — cannot use `supabase link`)  
  Dashboard URL: `https://supabase.com/dashboard/project/fsrdasrwceuscrfglskd/sql/new`
- [x] Enable RLS: users can read/write their own org's logs only

---

### S14B-002 — Sub-graph Extraction Helper

**File:** `apps/api/src/workflow/group-execution.helper.ts` (new)  
**What:** Pure function that takes the full workflow JSON and a `groupId`, returns a sub-workflow containing only that group's nodes and the edges between them.

```typescript
function extractGroupSubgraph(
  workflow: WorkflowJSON,
  groupId: string
): WorkflowJSON
```

- [x] Find `ui.groups[groupId].nodeIds`
- [x] Filter `workflow.nodes` to only `nodeIds`
- [x] Filter canonical `workflow.connections` to only edges where both source and target are in `nodeIds`
- [x] Return a valid `WorkflowJSON` with `nodes` and `connections` sub-sets; preserve `config` per node

---

### S14B-003 — Test Input Injection

**File:** `apps/api/src/workflow/group-execution.helper.ts`  
**What:** Identify the group's entry ports (inputs with no source in the sub-graph) and inject `testInputs` as synthetic upstream outputs.

```typescript
interface GroupRunRequest {
  workflowId:  string;
  groupId:     string;                   // ui.groups[].id
  testInputs:  Record<string, unknown>;  // port id → value
  orgId:       string;
}
```

- [x] Detect entry ports from external inbound connections; fall back to root group nodes when no external inbound edge exists
- [x] Inject `testInputs` into the execution context as workflow-level inputs using scoped `nodeId.portId` and plain `portId` keys
- [ ] Validate required entry ports once backend manifest port metadata is available to the group helper

---

### S14B-004 — `POST /workflows/:id/run-group` Endpoint

**Files:** `apps/api/src/workflow/workflow.controller.ts`, `apps/api/src/workflow/workflow.service.ts`

```typescript
// POST /workflows/:id/run-group
// Body: { groupId: string; testInputs: Record<string, unknown> }
// Returns: { runId: string; groupId: string; status: string; nodeResults: Record<string, unknown> }
```

- [x] Add route to `WorkflowController`
- [x] `WorkflowService.runGroup()`:
  1. Load workflow JSON
  2. Call `extractGroupSubgraph()` to get sub-graph
  3. Call test input injection to pre-fill entry ports
  4. Run sub-graph via existing `WorkflowRunner.run()` (pass sub-graph, not full workflow)
  5. Write results to `group_run_logs` table
  6. Return `{ runId, groupId, status, nodeResults }`
- [x] JWT guard + org access check (reuse existing guards)

---

### S14B-005 — Run Group Modal Component

**File:** `apps/web/src/components/canvas/RunGroupModal.tsx` (new)  
**What:** Modal that opens when the designer right-clicks a group and selects "Run Group".

- [x] Modal title: "Run Group: [group name]"
- [x] Fetch group entry ports from `GET /projects/:projectId/workflows/:id/groups/:groupId/entry-ports`
- [x] For each entry port: label (port name + node name), type badge, text input for test value
- [ ] "Run" button → `POST /workflows/:id/run-group` → show loading state
- [ ] On success: close modal, switch Execution Console to "Group Runs" tab, show run results
- [x] On success: refresh History sidebar and auto-switch to "Group Runs"
- [x] On error: show error message inline

---

### S14B-006 — Execution Console "Group Runs" Tab

**File:** `apps/web/src/components/canvas/ExecutionConsole.tsx`  
**What:** Separate tab in the bottom Execution Console showing group run results.

- [x] Add "Group Runs" tab alongside "Workflow Runs" tab in the existing History sidebar panel
- [x] Fetch from `GET /projects/:projectId/workflows/:id/group-run-logs`
- [x] Each row: group name, triggered at, status badge, duration, expand to see per-node results
- [x] Auto-switch to this tab when a "Run Group" call completes

---

### S14B-007 — Right-click "Run Group" Context Menu

**File:** `apps/web/src/components/canvas/SkillGroupNode.tsx`  
**What:** Add "Run Group" to the right-click context menu on the group header.

- [ ] Right-click on `SkillGroupNode` header → context menu with "▶ Run Group" item
- [x] Header includes a compact visible "Run" button
- [x] Opens `RunGroupModal` with `groupId` passed as prop

---

### S14B-008 — Build Verification

- [ ] Right-click a named group → "Run Group" → modal opens
- [ ] Modal shows correct entry port inputs for the group
- [ ] Enter test values → click Run → execution runs only that group's nodes
- [ ] Execution Console "Group Runs" tab shows the result
- [ ] Full workflow run is not triggered; `workflow_run_logs` has no new entry
- [ ] `group_run_logs` table has a new row with `node_results` populated
- [ ] Invalid/missing test input → 400 error shown inline in modal
- [x] TypeScript typecheck passes
- [x] Full workspace build passes
- [ ] Dev servers start without errors
- [ ] Git commit and push Sprint 14B

---

### Sprint 14B Progress Update -- 2026-06-30

**What's done**

- Added `supabase/migrations/0048_group_run_logs.sql` with dedicated group run persistence, indexes, and RLS policies.
- Added `group-execution.helper.ts` to extract a group's subgraph and detect entry ports from external inbound connections or root group nodes.
- Added `RunGroupDto`, workflow controller routes for entry ports, group run logs, and `run-group`, plus `WorkflowService.runGroup()` using the real execution resolver through `ExecutionService.runDefinitionInline()`.
- Added `RunGroupModal`, a group header `Run` button, right-click "Run Group" menu, and History sidebar "Group Runs" tab.
- Verified `corepack pnpm typecheck` and `corepack pnpm build` pass on 2026-06-30.

**What's next**

- Apply migration `0048_group_run_logs.sql` to Supabase, then browser verify right-click/header Run Group, modal inputs, selective execution, and group run log expansion.
- Confirm required-entry-port validation once backend manifest port metadata is available to the group helper.

**Ad-hoc to complete**

- Group input injection currently uses workflow-level test inputs (`nodeId.portId` plus plain `portId`) because the runner has no per-port synthetic upstream API yet.
- The "Group Runs" tab is implemented in the existing History sidebar instead of a separate bottom `ExecutionConsole.tsx`, matching the current editor layout.

---

---

## Commit Messages

```bash
# Sprint 14A
git add apps/web/src/components/canvas/SkillGroupNode.tsx
git add apps/web/src/components/canvas/SkillGroupControlsPanel.tsx
git add apps/web/src/components/canvas/WorkflowCanvas.tsx
git add packages/workflow-json/src/validate.ts
git commit -m "feat(canvas): Sprint 14A — Canvas Skill Groups + Group Execution Modes (rgthree Phase A+B)"

# Sprint 14B
git add supabase/migrations/0048_group_run_logs.sql
git add apps/api/src/workflow/group-execution.helper.ts
git add apps/api/src/workflow/workflow.controller.ts
git add apps/api/src/workflow/workflow.service.ts
git add apps/web/src/components/canvas/RunGroupModal.tsx
git add apps/web/src/components/canvas/ExecutionConsole.tsx
git commit -m "feat(canvas): Sprint 14B — Selective Group Execution / Run Group (rgthree Phase C)"
```

---

*© 2026 EffortEdutech Sdn Bhd — Lados Platform*
## Sprint 14B Correction -- 2026-07-01

**Corrected intention:** Lados should follow rgthree's **Group + Fast Group Bypasser node** concept. Selective "Run Group" is useful as a diagnostic tool, but it is not the primary rgthree-inspired feature.

- [x] Added `WorkflowFastGroupBypasser` / `ui.fastGroupBypassers[]`.
- [x] Added `FastGroupBypasserNode.tsx` as the Lados "Group Mode Switcher" movable canvas utility node.
- [x] Registered React Flow node type `fastGroupBypasser`.
- [x] Added toolbar action `Group Switcher`.
- [x] Fast Group Bypasser lists current groups and toggles Active / Muted / Bypassed.
- [x] Fast Group Bypasser is filtered out of `workflow.nodes[]`, so it does not pollute runtime execution.
- [x] Removed the floating `SkillGroupControlsPanel`.
- [x] Fixed React Flow responsiveness loop by keeping selection-only updates out of group frame and Fast Bypasser persistence.
- [x] Added group deletion from group header, context menu, and Delete/Backspace without deleting member skills.
- [x] Made Group Mode Switcher movable via its header drag handle while preserving internal `fastGroupBypasser` compatibility.
- [x] Browser UI/UX verified for canvas placement, grouping, delete, and Group Mode Switcher movement.
- [x] Fixed first-add/first-move stability by inserting the Group Mode Switcher into React Flow state immediately and preserving live position during sync.
- [x] Added Lados favicon assets and metadata to resolve `/favicon.ico` 404.
- [x] Replaced app-shell sidebar `L` mark with Lados icon and updated browser title metadata.
- [x] Added transparent sidebar Lados icon asset so the app-shell mark follows the active theme/background.
- [x] Memoized React Flow `nodeTypes` and changed Group Mode Switcher drag persistence to final drag events.
- [x] Excluded Group Mode Switcher from drag-to-group membership logic so group frames do not capture it.
- [ ] Verify group mode toggles and full workflow execution behavior with a functional workflow.

---
