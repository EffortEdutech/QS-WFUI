# Lados — Sprint Plan: Phases 16 → 18
**Version:** 1.0  
**Date:** 2026-06-30  
**Covers:** Phase 16 — Full Explorer · Phase 17 — Frontend State Engine · Phase 18 — External Marketplace  
**Purpose:** Close the final three V4 architecture gaps and complete the Lados V4 platform identity.

---

## Master Status Tracker

> Update this table as each phase completes. Copy the ✅ emoji into the Status column.

| Phase | Title | Status | Est. Days |
|---|---|---|---|
| P16 | Full Explorer | ⬜ Not started | 3–4 days |
| P17 | Frontend State Engine | 🟡 In progress | 4–5 days |
| P18 | External Marketplace | ⬜ Not started | 5–7 days |
| — | **Total** | — | **12–16 days** |

---

## Architecture Context

### What exists today

The workflow builder page (`/projects/[projectId]/workflows/[workflowId]/page.tsx`) has:

- A left sidebar with 4 tabs: `nodes | documents | datapacks | history`
  - `nodes` → `NodePalette.tsx` — groups registered nodes by pack, supports search/filter
  - `documents` → `LibraryPanel.tsx` — file library
  - `datapacks` → `DataPackBrowser.tsx` — data pack browser
  - `history` → `RunHistoryPanel.tsx` — past run list
- A right panel → `PropertyPanel.tsx` — node inspector
- Execution state managed by ~15 individual `useState` hooks scattered in the page component
- No Zustand / Jotai / Redux — all state is local React state, prop-drilled or duplicated
- Marketplace (`/marketplace`) shows browse + install but has no publish, submit, or external registry URL flow

### What is missing

| Gap | Impact |
|---|---|
| Explorer (full) | Users cannot browse resources, templates, active executions, or workflow versions from inside the canvas — they must leave the page |
| Frontend State Engine | Canvas page has ~15 useState hooks; execution state, selection state, and panel state are tightly coupled to the page component making the architecture unmaintainable and untestable |
| External Marketplace | Pack authors cannot publish a pack to a hosted registry; organizations cannot install a pack by URL or from a hosted listing |

### Implementation order

Phase 17 (State Engine) should ideally precede Phase 16 (Explorer) because the Explorer panels will consume the unified store. However, since the State Engine is a significant refactor, it is safe to build Phase 16 first using local state, then migrate to the store in Phase 17. Phase 18 (Marketplace) is fully independent.

**Recommended order: P17 → P16 → P18**  
(If bandwidth allows, P18 can run in parallel with P16.)

---

## Phase 16 — Full Explorer

### Goal

Upgrade the left sidebar from a node-picker into a complete workspace Explorer — a persistent, searchable, tabbed panel that gives users one place to browse all assets available inside their project: nodes, resources, templates, executions, and packs. No page navigation required.

### What the Full Explorer Looks Like

```
╔══════════════════════════════════════╗
║  🔍 Search everything...            ║
╠══════════════════════════════════════╣
║  [Nodes] [Resources] [Templates]    ║
║  [Runs]  [Packs]    [Versions]      ║
╠══════════════════════════════════════╣
║                                      ║
║  Tab content (scrollable)            ║
║                                      ║
╚══════════════════════════════════════╝
```

Each tab is a focused, filterable list. Selecting an item in any tab surfaces a quick-preview or drag-to-canvas action without leaving the workflow editor.

### Current state to preserve

The existing 4 tabs (`nodes`, `documents`, `datapacks`, `history`) contain working components. Phase 16 does not delete any of these — it integrates them into the new Explorer shell and adds 2 new tabs.

### Tasks

---

#### P16-001 — Create ExplorerShell component

**File:** `apps/web/src/components/canvas/explorer/ExplorerShell.tsx`

This is the outer container that replaces the raw tab strip in the workflow page. It owns:
- The tab list (icon + label for each tab)
- The global search bar (shown above tabs; filters within the active tab)
- The active tab state
- Keyboard shortcut: `Cmd/Ctrl + E` toggles the Explorer collapsed/expanded

**Tab definitions:**

| Tab ID | Icon | Label | Component |
|---|---|---|---|
| `nodes` | ⬡ | Nodes | `NodePalette.tsx` (existing, unchanged) |
| `resources` | 📦 | Resources | `ExplorerResourcesTab.tsx` (new — P16-002) |
| `templates` | 📋 | Templates | `ExplorerTemplatesTab.tsx` (new — P16-003) |
| `runs` | ▶ | Runs | `RunHistoryPanel.tsx` (existing, reused) |
| `packs` | 🧩 | Packs | `ExplorerPacksTab.tsx` (new — P16-004) |
| `versions` | 🕐 | Versions | `VersionHistoryDrawer.tsx` (existing, reused inline, not as a drawer) |

**Global search behaviour:**
- When search term is non-empty, filter the visible list in the active tab by name/label
- `NodePalette` already supports its own search; pass the global search string as a prop override
- For other tabs, each component filters its own list by the search string

**Props:**
```typescript
interface ExplorerShellProps {
  workflowId: string;
  projectId: string;
  organizationId: string;
  readOnly?: boolean;
  // Search string is owned here, passed down to each tab
}
```

**Checklist:**
- [ ] `ExplorerShell.tsx` created with 6-tab navigation
- [ ] Global search bar above tabs
- [ ] `Cmd/Ctrl + E` toggles collapsed/expanded
- [ ] Tab state persists in `localStorage` under key `lados.explorer.activeTab`
- [ ] Collapsed state persists in `localStorage` under key `lados.explorer.collapsed`
- [ ] Workflow page updated to use `<ExplorerShell>` instead of raw sidebar tabs

---

#### P16-002 — ExplorerResourcesTab

**File:** `apps/web/src/components/canvas/explorer/ExplorerResourcesTab.tsx`

Displays workspace resources that belong to the current project. Users can drag a resource card onto the canvas; it creates a pre-configured node with the resource ID already set in config (as a resource binding if a resource-picker field exists on the target node).

**API calls:**
- `GET /resources?projectId=<projectId>&type=all` — list all resources in the project
- Response: `{ id, name, type, status, created_at }[]`

**UI:**

```
╔═══════════════════════════════╗
║ Filter: [All ▼]  [🔍 search] ║
╠═══════════════════════════════╣
║ 📄 BOQ-2024-JKR-001           ║
║    Bill of Quantities · boq   ║
║    Active · updated 2d ago    ║
╠═══════════════════════════════╣
║ 📄 CONTRACT-JKRPK-2024        ║
║    Contract · contract        ║
║    Active · updated 5d ago    ║
╚═══════════════════════════════╝
```

**Features:**
- Filter dropdown: All / boq / contract / vehicle / material / supplier (driven by unique `type` values in response)
- Resource card shows: name, type chip, status chip, relative timestamp
- Click: opens resource detail page in a new tab (`/projects/:projectId/resources/:id`)
- Drag: provides `data-resource-id` and `data-resource-type` for canvas drop zones (Phase 15 Resource Bindings integration)
- Empty state: "No resources in this project. Create one from the Resources page."

**Checklist:**
- [ ] `ExplorerResourcesTab.tsx` created
- [ ] `GET /resources` call with projectId filter
- [ ] Type filter dropdown
- [ ] Search filter on name
- [ ] Resource cards with click-to-open
- [ ] Empty state message
- [ ] Drag data attributes set for canvas integration

---

#### P16-003 — ExplorerTemplatesTab

**File:** `apps/web/src/components/canvas/explorer/ExplorerTemplatesTab.tsx`

Displays workflow templates available to the organisation. A template is a saved `QSWorkflowDefinition` that can be applied to the current canvas (full replace) or used to seed a new workflow.

**API calls:**
- `GET /workflow-templates?orgId=<orgId>` — list available templates (official + org-custom)
- `GET /workflow-templates/:id` — fetch template definition JSON
- `POST /workflow-templates` — save current workflow as a template (owner/admin only)

> **Note:** If `/workflow-templates` endpoint does not yet exist, this task includes creating a minimal API endpoint. See P16-003-API below.

**UI:**

```
╔═══════════════════════════════╗
║ [Official] [My Org]           ║
╠═══════════════════════════════╣
║ ⚙️ Procurement Approval Flow  ║
║   6 nodes · lados.qs-pack     ║
║   [Preview] [Apply to canvas] ║
╠═══════════════════════════════╣
║ 📋 BOQ Review Workflow        ║
║   4 nodes · lados.document-pack║
║   [Preview] [Apply to canvas] ║
╚═══════════════════════════════╝
```

- **Preview:** opens a read-only mini-canvas in a modal (re-use `WorkflowCanvas` with `readOnly=true`)
- **Apply to canvas:** replaces current canvas definition after confirmation dialog ("This will replace your current workflow. Continue?")
- **Save as template button** (top right, admin only): saves current `QSWorkflowDefinition` as a named template

**P16-003-API (if endpoint missing):**  
Create `apps/api/src/workflow-templates/` module with:
- `GET /workflow-templates` — returns templates from `workflow_templates` table (or a seeded list)
- `POST /workflow-templates` — create template (owner/admin)
- Migration `0047_workflow_templates.sql`:
  ```sql
  CREATE TABLE IF NOT EXISTS workflow_templates (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id       uuid REFERENCES organizations(id),   -- NULL = official/global
    name         text NOT NULL,
    description  text,
    pack_id      text REFERENCES packs(id),
    node_count   int  NOT NULL DEFAULT 0,
    definition   jsonb NOT NULL,
    is_official  boolean NOT NULL DEFAULT false,
    created_by   uuid REFERENCES auth.users(id),
    created_at   timestamptz NOT NULL DEFAULT now()
  );
  ```

**Checklist:**
- [ ] Migration `0047_workflow_templates.sql` applied
- [ ] `WorkflowTemplatesModule` API created (GET + POST)
- [ ] `ExplorerTemplatesTab.tsx` created
- [ ] Official vs. Org tabs
- [ ] Template preview modal (read-only canvas)
- [ ] Apply to canvas with confirmation dialog
- [ ] Save current workflow as template (admin only)

---

#### P16-004 — ExplorerPacksTab

**File:** `apps/web/src/components/canvas/explorer/ExplorerPacksTab.tsx`

A compact pack browser inside the Explorer — summarises installed packs, their health, node count, and a link to the full `/packs` management page.

**API calls:**
- `GET /packs` — reuse existing endpoint

**UI:**

```
╔═══════════════════════════════╗
║ 9 packs installed             ║
╠═══════════════════════════════╣
║ ⚙️ Core Pack      ✓ Healthy   ║
║    14 nodes · v1.0.0          ║
╠═══════════════════════════════╣
║ 🏗️ Construction   ⚠ Degraded  ║
║    10 nodes · v1.0.0          ║
╚═══════════════════════════════╝
[Manage Packs →] [Marketplace →]
```

- Clicking a pack row expands to show its nodes inline (same format as NodePalette group)
- "Manage Packs →" links to `/packs`
- "Marketplace →" links to `/marketplace`
- No actions here — this is browse-only

**Checklist:**
- [ ] `ExplorerPacksTab.tsx` created
- [ ] Pack list from `GET /packs` with health badge
- [ ] Expandable pack row showing nodes
- [ ] Links to `/packs` and `/marketplace`

---

#### P16-005 — Wire ExplorerShell into workflow page

**File:** `apps/web/src/app/(app)/projects/[projectId]/workflows/[workflowId]/page.tsx`

Replace the existing tab strip + content block with:

```tsx
<ExplorerShell
  workflowId={workflowId}
  projectId={projectId}
  organizationId={organizationId}
  readOnly={saveState === 'error'}
/>
```

Remove the now-inlined `sidebarTab` state and `setSidebarTab` from the page component — this state moves into `ExplorerShell`.

**Checklist:**
- [ ] Page updated to use `<ExplorerShell>`
- [ ] `sidebarTab` state removed from page component
- [ ] `pnpm --filter @lados/web tsc --noEmit` — zero errors
- [ ] All 6 tabs reachable and functional

---

#### P16-X — Phase 16 Verification

- [ ] Explorer renders with all 6 tabs
- [ ] Global search filters the active tab content
- [ ] `Cmd/Ctrl + E` collapses and expands the Explorer
- [ ] Active tab and collapsed state persist across page reloads
- [ ] Nodes tab: drag-to-canvas still works
- [ ] Resources tab: resources visible, filter by type works
- [ ] Templates tab: preview modal opens, Apply replaces canvas
- [ ] Runs tab: run history visible, click-to-expand works
- [ ] Packs tab: packs listed with health badge, expand shows nodes
- [ ] Versions tab: version history shown inline (not as drawer)
- [ ] Zero TypeScript errors
- [ ] Mark Phase 16 complete in Master Status Tracker above

---

## Phase 17 — Frontend State Engine

### Goal

Replace the ~15 scattered `useState` hooks in the workflow page component with a unified, reactive state store using **Zustand**. This gives every canvas component direct access to shared state without prop drilling, makes the codebase testable, and lays the foundation for cross-tab state sync (e.g., a running execution updates both the canvas node colours and the Execution Log panel without passing callbacks through 3 layers of props).

### Why Zustand

| Option | Decision |
|---|---|
| Zustand | ✅ Chosen — minimal boilerplate, TypeScript-first, works with Next.js App Router, no Provider wrapper required, 3KB bundle |
| Redux Toolkit | ❌ Too heavy for this scale; adds significant boilerplate |
| Jotai | ❌ Atom-per-value model becomes complex for interdependent canvas state |
| React Context + useReducer | ❌ Re-renders entire subtree on any state change; not suitable for frequent canvas updates |

### State Shape

The store is divided into 4 slices. Each slice is a separate Zustand store to avoid unnecessary re-renders across unrelated state.

```
WorkflowStore         — workflow metadata, save state, definition
CanvasStore           — ReactFlow nodes/edges, selection, viewport
ExecutionStore        — active run, node logs, SSE connection state
UIStore               — which panels/drawers are open, sidebar tab
```

### Tasks

---

#### P17-001 — Install Zustand

**File:** `apps/web/package.json`

```bash
pnpm --filter @lados/web add zustand
```

No other dependencies needed. Zustand has no peer dependencies.

**Checklist:**
- [x] Zustand added to `apps/web/package.json`
- [x] `pnpm install` succeeds

---

#### P17-002 — WorkflowStore

**File:** `apps/web/src/stores/workflowStore.ts`

Manages workflow identity and persistence state.

```typescript
import { create } from 'zustand';
import type { QSWorkflowDefinition } from '@lados/shared-types';

export type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

interface WorkflowState {
  // Data
  workflowId:   string | null;
  projectId:    string | null;
  workflowName: string;
  definition:   QSWorkflowDefinition | null;
  saveState:    SaveState;
  loadError:    string | null;

  // Actions
  setWorkflow:    (id: string, projectId: string, name: string, def: QSWorkflowDefinition) => void;
  setDefinition:  (def: QSWorkflowDefinition) => void;
  setWorkflowName:(name: string) => void;
  setSaveState:   (state: SaveState) => void;
  setLoadError:   (err: string | null) => void;
  reset:          () => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflowId:   null,
  projectId:    null,
  workflowName: '',
  definition:   null,
  saveState:    'saved',
  loadError:    null,

  setWorkflow:    (workflowId, projectId, workflowName, definition) =>
    set({ workflowId, projectId, workflowName, definition, saveState: 'saved', loadError: null }),
  setDefinition:  (definition) => set({ definition, saveState: 'unsaved' }),
  setWorkflowName:(workflowName) => set({ workflowName }),
  setSaveState:   (saveState) => set({ saveState }),
  setLoadError:   (loadError) => set({ loadError }),
  reset:          () => set({ workflowId: null, projectId: null, workflowName: '',
                               definition: null, saveState: 'saved', loadError: null }),
}));
```

**Checklist:**
- [x] `apps/web/src/stores/workflowStore.ts` created
- [x] All 5 workflow state fields + actions defined
- [x] TypeScript-clean (no `any`)

---

#### P17-003 — CanvasStore

**File:** `apps/web/src/stores/canvasStore.ts`

Manages the ReactFlow graph state and selection.

```typescript
import { create } from 'zustand';
import type { Node, Edge, Viewport } from 'reactflow';

interface CanvasState {
  nodes:           Node[];
  edges:           Edge[];
  selectedNodeId:  string | null;
  viewport:        Viewport;
  readOnly:        boolean;
  hasValidationErrors: boolean;

  setNodes:          (nodes: Node[]) => void;
  setEdges:          (edges: Edge[]) => void;
  setSelectedNodeId: (id: string | null) => void;
  setViewport:       (vp: Viewport) => void;
  setReadOnly:       (ro: boolean) => void;
  setHasValidationErrors: (v: boolean) => void;
  resetCanvas:       () => void;
}
```

> **Important:** ReactFlow manages its own internal node/edge state. `CanvasStore` holds the *canonical* graph state that is serialised into `QSWorkflowDefinition`. The two are kept in sync via `WorkflowCanvas`'s `onNodesChange` / `onEdgesChange` callbacks which call `setNodes` / `setEdges`.

**Checklist:**
- [x] `apps/web/src/stores/canvasStore.ts` created
- [x] Node/edge arrays, selection, viewport, readOnly, validation error fields defined

---

#### P17-004 — ExecutionStore

**File:** `apps/web/src/stores/executionStore.ts`

Manages active workflow run state. This is the most important slice — it currently powers both `ExecutionLogPanel` and live node status colouring on the canvas, and the state is duplicated between them via callbacks.

```typescript
import { create } from 'zustand';

export type NodeRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting';

export interface NodeLog {
  nodeId:   string;
  nodeType: string;
  nodeName: string;
  status:   NodeRunStatus;
  inputs?:  Record<string, unknown>;
  outputs?: Record<string, unknown>;
  error?:   { code: string; message: string };
  startedAt?:   string;
  completedAt?: string;
}

export type RunStatus = 'idle' | 'starting' | 'running' | 'completed' | 'failed' | 'paused';

interface ExecutionState {
  runId:       string | null;
  runStatus:   RunStatus;
  nodeLogs:    Record<string, NodeLog>;  // keyed by nodeId
  runError:    string | null;
  sseConnected: boolean;

  // Actions
  startRun:      (runId: string) => void;
  setRunStatus:  (status: RunStatus) => void;
  upsertNodeLog: (log: NodeLog) => void;
  setRunError:   (err: string | null) => void;
  setSseConnected: (connected: boolean) => void;
  resetRun:      () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  runId:       null,
  runStatus:   'idle',
  nodeLogs:    {},
  runError:    null,
  sseConnected: false,

  startRun:      (runId)   => set({ runId, runStatus: 'starting', nodeLogs: {}, runError: null }),
  setRunStatus:  (runStatus) => set({ runStatus }),
  upsertNodeLog: (log)     => set((s) => ({ nodeLogs: { ...s.nodeLogs, [log.nodeId]: log } })),
  setRunError:   (runError) => set({ runError }),
  setSseConnected: (sseConnected) => set({ sseConnected }),
  resetRun:      () => set({ runId: null, runStatus: 'idle', nodeLogs: {}, runError: null }),
}));
```

**Checklist:**
- [x] `apps/web/src/stores/executionStore.ts` created
- [x] `NodeLog` and `RunStatus` types exported
- [x] All execution lifecycle actions defined

---

#### P17-005 — UIStore

**File:** `apps/web/src/stores/uiStore.ts`

Manages panel open/closed state and global UI flags.

```typescript
import { create } from 'zustand';

type ExplorerTab = 'nodes' | 'resources' | 'templates' | 'runs' | 'packs' | 'versions';

interface UIState {
  explorerTab:         ExplorerTab;
  explorerCollapsed:   boolean;
  showExecutionLog:    boolean;
  showDesignStudio:    boolean;
  showVersionHistory:  boolean;
  showUploadPanel:     boolean;
  organizationId:      string | null;

  setExplorerTab:        (tab: ExplorerTab) => void;
  setExplorerCollapsed:  (v: boolean) => void;
  toggleExecutionLog:    () => void;
  setShowDesignStudio:   (v: boolean) => void;
  setShowVersionHistory: (v: boolean) => void;
  setShowUploadPanel:    (v: boolean) => void;
  setOrganizationId:     (id: string) => void;
}
```

**Checklist:**
- [x] `apps/web/src/stores/uiStore.ts` created
- [x] All panel open states covered

---

#### P17-006 — Create stores index

**File:** `apps/web/src/stores/index.ts`

```typescript
export { useWorkflowStore }  from './workflowStore';
export { useCanvasStore }     from './canvasStore';
export { useExecutionStore }  from './executionStore';
export { useUIStore }         from './uiStore';
export type { SaveState }     from './workflowStore';
export type { NodeLog, NodeRunStatus, RunStatus } from './executionStore';
```

**Checklist:**
- [x] `stores/index.ts` barrel export created

---

#### P17-007 — Migrate workflow page to stores

**File:** `apps/web/src/app/(app)/projects/[projectId]/workflows/[workflowId]/page.tsx`

Replace all `useState` hooks with store reads/writes. This is the largest single task in Phase 17.

Migration map:

| Old `useState` | Replaced by |
|---|---|
| `definition, setDefinition` | `useWorkflowStore(s => s.definition)` / `setDefinition` |
| `workflowName, setWorkflowName` | `useWorkflowStore` |
| `saveState, setSaveState` | `useWorkflowStore` |
| `error, setError` | `useWorkflowStore(s => s.loadError)` |
| `runId, setRunId` | `useExecutionStore` |
| `runStatus, setRunStatus` | `useExecutionStore` |
| `nodeLogs, setNodeLogs` | `useExecutionStore(s => s.nodeLogs)` |
| `runError, setRunError` | `useExecutionStore` |
| `sidebarTab, setSidebarTab` | `useUIStore` (→ `explorerTab`) |
| `showDesignStudio` | `useUIStore` |
| `showVersions` | `useUIStore(s => s.showVersionHistory)` |
| `showUploadPanel` | `useUIStore` |
| `organizationId` | `useUIStore` |
| `hasValidationErrors` | `useCanvasStore` |
| `bulkModeRequest` | `useCanvasStore` (add as needed) |

After migration, the page component becomes a thin orchestrator: it loads data, initialises stores, and renders the layout. All business logic lives in the stores and their consumers.

**Checklist:**
- [ ] All `useState` hooks in page component replaced with store hooks
- [ ] Page component reduced to <100 lines (layout + data loading only)
- [ ] `handleSave` callback reads from `useWorkflowStore` and writes back
- [ ] SSE event handler writes to `useExecutionStore` directly (not via prop callback chain)

---

#### P17-008 — Migrate WorkflowCanvas to CanvasStore

**File:** `apps/web/src/components/canvas/WorkflowCanvas.tsx`

`WorkflowCanvas` currently receives `definition` as a prop and manages internal ReactFlow state locally. After Phase 17:

- On mount: initialise `CanvasStore` nodes/edges from the definition
- `onNodesChange` / `onEdgesChange`: write back to `CanvasStore`
- `selectedNodeId`: read from `CanvasStore` instead of local state
- `isValidConnection` (Phase 14): reads `portTypeMap` from `CanvasStore`
- The `onSave` prop callback is retained (it still calls back to the page which triggers API save), but internal selection and validation state moves to the store

**Checklist:**
- [ ] `WorkflowCanvas.tsx` reads `selectedNodeId` from `useCanvasStore`
- [ ] Node/edge changes write to `useCanvasStore`
- [ ] `hasValidationErrors` reads from `useCanvasStore`

---

#### P17-009 — Migrate ExecutionLogPanel to ExecutionStore

**File:** `apps/web/src/components/canvas/ExecutionLogPanel.tsx`

Currently receives `runId`, `runStatus`, `nodeLogs` as props. After Phase 17, it reads directly from `useExecutionStore`. No props needed except `organizationId`.

Apply same pattern to `SkillNode.tsx` — it needs to colour itself based on node run status. Currently this comes via `data.runStatus` injected per-node by the page. After Phase 17:

```typescript
// In SkillNode.tsx
const nodeLog = useExecutionStore(s => s.nodeLogs[id]);
const status  = nodeLog?.status ?? 'pending';
```

This eliminates the need to re-inject run state into every ReactFlow node's `data` object on every SSE update (which currently triggers a full `setNodes()` cascade).

**Checklist:**
- [ ] `ExecutionLogPanel.tsx` reads from `useExecutionStore` directly
- [ ] `SkillNode.tsx` reads its run status from `useExecutionStore`
- [ ] Node re-render on status change no longer requires full `setNodes()` call

---

#### P17-010 — Add SSE manager hook

**File:** `apps/web/src/hooks/useExecutionSSE.ts`

Extract the SSE subscription logic from the page component into a standalone hook. The hook connects to `GET /runs/:runId/stream`, parses events, and writes to `useExecutionStore`.

```typescript
export function useExecutionSSE(runId: string | null) {
  const { upsertNodeLog, setRunStatus, setSseConnected, resetRun } = useExecutionStore();

  useEffect(() => {
    if (!runId) return;
    const es = new EventSource(`/api/v1/runs/${runId}/stream`);
    setSseConnected(true);

    es.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'node_status') upsertNodeLog(data.log);
      if (data.type === 'run_status')  setRunStatus(data.status);
    };

    es.onerror = () => { setSseConnected(false); es.close(); };

    return () => { es.close(); setSseConnected(false); };
  }, [runId]);
}
```

Use this hook in the workflow page: `useExecutionSSE(runId)` — one line replaces 30+ lines of SSE setup code.

**Checklist:**
- [ ] `useExecutionSSE.ts` hook created
- [ ] Page component's SSE setup replaced with `useExecutionSSE(runId)`
- [ ] SSE connected state reflected in `ExecutionLogPanel` header

---

#### P17-X — Phase 17 Verification

- [ ] `pnpm --filter @lados/web tsc --noEmit` — zero errors
- [ ] Workflow page loads and renders without console errors
- [ ] Canvas edit → auto-save still works (definition flows store → API)
- [ ] Run workflow → node colours update during execution (SSE → store → SkillNode)
- [ ] Execution Log Panel shows live node logs without prop callbacks
- [ ] Explorer tab switching works (UIStore)
- [ ] Collapsing Explorer persists across page reload (localStorage via UIStore init)
- [ ] No `useState` for business data remains in the workflow page component
- [ ] Mark Phase 17 complete in Master Status Tracker above

---

## Phase 18 — External Marketplace

### Goal

Build the full Lados Pack Marketplace: a hosted registry where pack authors can publish packs, and organisations can discover, preview, and install packs directly from a URL or a browsable listing — without needing to manually copy pack files or run CLI commands.

### Architecture Overview

```
Pack Author
  └── pnpm run publish:pack
        └── POST /api/v1/registry/packs/submit
              └── registry_packs table (hosted listings)
                    └── GET /api/v1/registry/packs (public browse)
                          └── Marketplace UI (/marketplace)
                                └── POST /api/v1/packs/install-from-registry
                                      └── Pack downloaded + installed in org
```

The registry is part of the Lados platform API — not a separate service. Pack bundles are stored in Supabase Storage (`packs` bucket).

### What already exists

- `/marketplace` page with browse + local enable/disable
- `packs` table with `installed_from`, `checksum`, `previous_version` columns (migration 0036)
- `MarketplaceController` with `POST /marketplace/packs/:packId/install`
- No hosted registry table, no publish endpoint, no bundle storage flow

### Tasks

---

#### P18-001 — Migration 0048: registry_packs table

**File:** `supabase/migrations/0048_registry_packs.sql`

```sql
-- ── registry_packs ──────────────────────────────────────────────────────────
-- Hosted pack listings. A pack author submits a pack bundle; the platform
-- validates, stores the bundle in Supabase Storage, and creates a listing here.
-- Organisations install from the listing — the listing is not a live node,
-- it is a versioned, immutable snapshot.

CREATE TABLE IF NOT EXISTS registry_packs (
  id              uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id         text    NOT NULL,                        -- e.g. 'lados.qs-pack'
  version         text    NOT NULL,
  display_name    text    NOT NULL,
  description     text,
  author          text    NOT NULL,
  author_email    text,
  icon            text,
  color           text,
  is_official     boolean NOT NULL DEFAULT false,
  is_verified     boolean NOT NULL DEFAULT false,          -- reviewed by Lados team
  tags            text[]  NOT NULL DEFAULT '{}',
  node_count      int     NOT NULL DEFAULT 0,
  bundle_url      text    NOT NULL,                        -- Supabase Storage URL
  bundle_checksum text    NOT NULL,                        -- SHA-256
  manifest_json   jsonb   NOT NULL DEFAULT '{}',           -- pack manifest snapshot
  downloads       int     NOT NULL DEFAULT 0,
  published_by    uuid    REFERENCES auth.users(id),
  published_at    timestamptz NOT NULL DEFAULT now(),
  deprecated_at   timestamptz,
  deprecation_note text,

  UNIQUE (pack_id, version)
);

CREATE INDEX idx_registry_packs_pack_id ON registry_packs(pack_id);
CREATE INDEX idx_registry_packs_tags    ON registry_packs USING GIN(tags);

-- RLS: public read for all authenticated users; write restricted to platform admin
ALTER TABLE registry_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated users can read registry"
  ON registry_packs FOR SELECT TO authenticated USING (true);

-- Only platform admins write directly; authors go through submit endpoint
CREATE POLICY "service role can write registry"
  ON registry_packs FOR ALL TO service_role USING (true);

COMMENT ON TABLE registry_packs IS
  'Hosted pack marketplace listings. Each row is an immutable versioned snapshot. '
  'Bundle files are stored in Supabase Storage bucket ''packs''.';
```

**Checklist:**
- [ ] Migration `0048_registry_packs.sql` created
- [ ] Migration applied to Supabase project
- [ ] `registry_packs` table visible in Supabase dashboard
- [ ] Supabase Storage bucket `packs` created (via dashboard or migration)

---

#### P18-002 — Pack bundle format specification

**File:** `docs/V4/Pack_Bundle_Format.md` (documentation only — no code)

Define what a publishable pack bundle is:

```
my-pack-1.0.0.ladosPack
├── manifest.json          ← pack identity + node list + metadata
├── nodes/
│   ├── my-node.js         ← compiled executor (CommonJS)
│   └── my-node.manifest.json
├── README.md
└── CHANGELOG.md
```

`manifest.json` schema:
```json
{
  "id": "vendor.my-pack",
  "displayName": "My Pack",
  "version": "1.0.0",
  "author": "Vendor Name",
  "authorEmail": "dev@vendor.com",
  "description": "...",
  "icon": "package",
  "color": "#3B82F6",
  "tags": ["finance", "documents"],
  "nodes": [
    { "type": "vendor.my-pack.my-node", "file": "nodes/my-node.js" }
  ],
  "engines": { "lados": ">=4.0.0" }
}
```

**Checklist:**
- [ ] `Pack_Bundle_Format.md` written and saved in `docs/V4/`
- [ ] Bundle format reviewed and agreed

---

#### P18-003 — Pack submit API endpoint

**File:** `apps/api/src/marketplace/registry.controller.ts`

```
POST /api/v1/registry/packs/submit
  Content-Type: multipart/form-data
  Body: bundle (file, .ladosPack), authorEmail (string)
```

Steps performed by the endpoint:
1. Validate file extension is `.ladosPack`
2. Unzip bundle in memory, read and parse `manifest.json`
3. Validate manifest schema (pack ID format, version semver, required fields)
4. Check if `(pack_id, version)` already exists in `registry_packs` — reject duplicates
5. Compute SHA-256 checksum of bundle bytes
6. Upload bundle to Supabase Storage: `packs/{pack_id}/{version}.ladosPack`
7. Insert row into `registry_packs` with `is_verified = false` (awaits review)
8. Return `{ listingId, packId, version, status: 'pending_review' }`

**Required npm packages:** `adm-zip` (unzip bundle), `@supabase/storage-js` (already available via SupabaseService)

```typescript
@Post('packs/submit')
@UseGuards(SupabaseAuthGuard)
@UseInterceptors(FileInterceptor('bundle'))
async submitPack(
  @UploadedFile() file: Express.Multer.File,
  @Body('authorEmail') authorEmail: string,
  @Req() req: AuthRequest,
): Promise<RegistrySubmitResponseDto>
```

**Checklist:**
- [ ] `registry.controller.ts` created with `POST /registry/packs/submit`
- [ ] Bundle validation (extension, manifest schema)
- [ ] Duplicate version check
- [ ] SHA-256 checksum computed
- [ ] Bundle uploaded to Supabase Storage `packs` bucket
- [ ] `registry_packs` row inserted with `is_verified = false`
- [ ] Returns `{ listingId, packId, version, status }`

---

#### P18-004 — Registry browse API endpoint

**File:** `apps/api/src/marketplace/registry.controller.ts` (add to existing)

```
GET /api/v1/registry/packs
  Query params:
    q         — search by name/description/tags
    tag       — filter by tag
    official  — boolean filter
    verified  — boolean filter (default: true)
    page      — pagination (default: 1)
    pageSize  — (default: 20, max: 100)

GET /api/v1/registry/packs/:packId
  Returns: all versions of a pack (latest first)

GET /api/v1/registry/packs/:packId/:version
  Returns: single listing row + manifest_json
```

Response shape for listing:
```typescript
interface RegistryPackListing {
  id:          string;
  packId:      string;
  version:     string;
  displayName: string;
  description: string;
  author:      string;
  icon:        string;
  color:       string;
  isOfficial:  boolean;
  isVerified:  boolean;
  tags:        string[];
  nodeCount:   number;
  downloads:   number;
  publishedAt: string;
  bundleUrl:   string;
}
```

**Checklist:**
- [ ] `GET /registry/packs` with search + filter + pagination
- [ ] `GET /registry/packs/:packId` (all versions)
- [ ] `GET /registry/packs/:packId/:version` (single)
- [ ] Results sorted by `downloads DESC` by default
- [ ] `is_verified = true` filter applied by default (can be overridden by admin)

---

#### P18-005 — Install-from-registry API endpoint

**File:** `apps/api/src/marketplace/marketplace.controller.ts` (add to existing)

```
POST /api/v1/marketplace/registry/:listingId/install
  Body: { orgId: string }
```

Steps:
1. Fetch listing from `registry_packs` by `listingId`
2. Download bundle from `bundleUrl` (Supabase Storage)
3. Verify SHA-256 checksum matches `bundle_checksum`
4. Unzip and load node executors into the running API process (same mechanism as `PackInstallerService.installPack()`)
5. Upsert row in `packs` table with `installed_from = 'registry'`, `checksum`, `previous_version`
6. Upsert node manifests into `registered_nodes`
7. Increment `registry_packs.downloads` counter
8. Return `{ packId, version, nodeCount, status: 'installed' }`

**Checklist:**
- [ ] `POST /marketplace/registry/:listingId/install` endpoint created
- [ ] Bundle downloaded from Storage
- [ ] SHA-256 verified before installation
- [ ] `PackInstallerService` used to load executors
- [ ] `packs` table upserted with `installed_from = 'registry'`
- [ ] `registered_nodes` updated
- [ ] Download counter incremented
- [ ] Returns install confirmation

---

#### P18-006 — Pack admin review endpoint

**File:** `apps/api/src/marketplace/registry.controller.ts`

```
PATCH /api/v1/registry/packs/:listingId/verify
  Body: { approved: boolean; note?: string }
  Guard: platform admin only (new permission: 'registry.verify')
```

Sets `is_verified = true/false` and optionally sets `deprecation_note`. This is the manual review gate before a submitted pack appears in public search results.

**Checklist:**
- [ ] `PATCH /registry/packs/:listingId/verify` endpoint
- [ ] Permission check: `registry.verify` role
- [ ] `is_verified` and `deprecation_note` updated

---

#### P18-007 — Marketplace page upgrade

**File:** `apps/web/src/app/(app)/marketplace/page.tsx`

The current marketplace page shows the org's installed packs with enable/disable. Upgrade it into a full browsable registry:

**Tab layout:**
```
[Installed Packs]  [Browse Registry]  [Publish a Pack]
```

**Installed Packs tab** (existing behaviour — keep as-is):
- List of packs installed in the org
- Enable/disable toggle
- Health badge
- Sync button

**Browse Registry tab** (new):
```
🔍 Search packs...   [All] [Official] [Verified]

🧩 Construction Pack          ✓ Verified  ⭐ Official
   10 nodes · v1.2.0 · 847 installs
   A comprehensive pack for construction project workflows.
   [Preview Nodes]  [Install]

🤖 AI Analysis Pack           ✓ Verified
   5 nodes · v1.0.3 · 124 installs
   [Preview Nodes]  [Install]
```

- Calls `GET /api/v1/registry/packs`
- **Preview Nodes** button: opens a modal listing the pack's nodes from `manifest_json`
- **Install** button: calls `POST /marketplace/registry/:listingId/install` then refreshes Installed tab
- Install button shows "Installed ✓" if already installed (check against installed pack IDs)

**Publish a Pack tab** (new):
```
Submit a Pack to the Lados Registry

Pack Bundle (.ladosPack)  [Choose file]
Author Email              [____________]

[Upload and Submit]

ℹ️ Submissions are reviewed before appearing in public search.
   Review usually takes 1–2 business days.
```

- File input for `.ladosPack`
- Calls `POST /api/v1/registry/packs/submit` (multipart)
- Shows submission status: `{ packId, version, status: 'pending_review' }`

**Checklist:**
- [ ] Marketplace page rebuilt with 3-tab layout
- [ ] Installed Packs tab — existing behaviour preserved
- [ ] Browse Registry tab — calls `GET /registry/packs`, search + filter works
- [ ] Preview Nodes modal shows node list from `manifest_json`
- [ ] Install button calls install endpoint, success refreshes installed list
- [ ] "Already installed" state shown correctly
- [ ] Publish tab — file upload + email field
- [ ] Submit button calls `POST /registry/packs/submit`, shows confirmation

---

#### P18-008 — Pack SDK: publish command

**File:** `packages/pack-sdk/src/cli/publish.ts`

Add a `lados-pack publish` CLI command that:
1. Reads `pack.manifest.json` from the current directory
2. Runs `tsc` to compile node executors
3. Zips into a `.ladosPack` bundle
4. Uploads to `POST /api/v1/registry/packs/submit`

```bash
# Usage (from inside a pack directory):
pnpm lados-pack publish --api-url http://localhost:4000 --token <JWT>
```

> This is a DX convenience. Pack authors can also submit via the UI (P18-007). The CLI is for CI/CD pipelines.

**Checklist:**
- [ ] `packages/pack-sdk/src/cli/publish.ts` created
- [ ] Reads `pack.manifest.json`
- [ ] Compiles TypeScript via `tsc`
- [ ] Zips into `.ladosPack`
- [ ] POSTs to submit endpoint
- [ ] Error output on validation failure
- [ ] Add `lados-pack` bin entry to `packages/pack-sdk/package.json`

---

#### P18-009 — PowerShell smoke test for registry

```powershell
# Get JWT
$body = @{ email="contractor-owner@lados.dev"; password="testpass123" } | ConvertTo-Json
$auth = Invoke-RestMethod -Uri "https://fsrdasrwceuscrfglskd.supabase.co/auth/v1/token?grant_type=password" `
  -Method POST -Body $body -ContentType "application/json"
$token = $auth.access_token
$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

# 1. Browse registry
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/registry/packs" -Headers $headers

# 2. Get single pack listing
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/registry/packs/lados.qs-pack" -Headers $headers

# 3. Install from registry (use a listingId from step 1)
$installBody = @{ orgId = "eeeeeeee-0001-0000-0000-000000000001" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/marketplace/registry/<LISTING_ID>/install" `
  -Method POST -Body $installBody -Headers $headers
```

**Checklist:**
- [ ] Browse registry returns listings
- [ ] Single pack returns version history
- [ ] Install from registry succeeds, pack appears in `GET /packs`

---

#### P18-X — Phase 18 Verification

- [ ] `pnpm tsc --noEmit` (full monorepo) — zero errors
- [ ] Migration `0048` applied — `registry_packs` table exists
- [ ] Supabase Storage `packs` bucket exists
- [ ] `POST /registry/packs/submit` accepts a `.ladosPack` file, stores it, creates listing
- [ ] `GET /registry/packs` returns listings (with `is_verified = true` filter)
- [ ] `POST /marketplace/registry/:listingId/install` installs pack into org
- [ ] Marketplace page shows Browse Registry tab with listings
- [ ] Preview Nodes modal shows nodes from manifest
- [ ] Install button installs pack, Installed tab updates
- [ ] Publish tab submits a bundle, shows pending_review confirmation
- [ ] `lados-pack publish` CLI command bundles and submits a pack
- [ ] Mark Phase 18 complete in Master Status Tracker above

---

## Full V4 Architecture Gap Closure

---

## Phase 18 Implementation Addendum - 2026-07-02

**Done in code:**
- Created `supabase/migrations/0050_registry_packs.sql` for `registry_packs` and the private `lados-pack-bundles` Supabase Storage bucket.
- Added `RegistryService` and `RegistryController` with:
  - `POST /registry/packs/submit`
  - `GET /registry/packs`
  - `GET /registry/packs/:packId`
  - `GET /registry/packs/:packId/:version`
  - `PATCH /registry/packs/:listingId/verify`
- Added `POST /marketplace/registry/:listingId/install`.
- Added `registry.verify` permission for owner/admin roles.
- Rebuilt `/marketplace` into three tabs: Installed, Browse Registry, Publish Pack.
- Added registry preview modal and installed-state detection.
- Added `docs/Lados/V4/Pack_Bundle_Format.md`.
- Added `docs/Lados/V4/Tests/test_phase18_registry.ps1`.
- Full `corepack pnpm typecheck` passed on 2026-07-02.

**Important execution boundary:**
- Phase 18 installs external registry packs by registering the pack row and node manifests from `manifest.json`.
- Uploaded JavaScript executor code is stored with the bundle but is not dynamically loaded or executed yet.
- Dynamic executor loading is deferred until Lados has a sandboxed verifier/runtime boundary.

**Not done yet:**
- Apply migration `0050_registry_packs.sql` to Supabase.
- Browser verify `/marketplace` Browse Registry and Publish Pack tabs against the live API.
- Smoke test submit/install using a real `.ladosPack` bundle.
- `lados-pack publish` CLI remains deferred; UI upload is the Phase 18 publish path currently implemented.

**Next:**
- Apply migration 0050.
- Create or submit one test `.ladosPack`, verify it, then install it from Browse Registry.
- Decide whether Phase 18B should implement the `lados-pack publish` CLI or move directly to the sandboxed external executor runtime.

After all three phases complete, the summary table becomes:

| Document Claim | Reality | Closed by |
|---|---|---|
| Workspace → Project → Workflow model | ✅ True | — (was already true) |
| Node Manifest V2 + executor | ✅ True | — |
| Pack SDK | ✅ True | — |
| Execution versioning | ✅ True | — |
| Native approvals + pause/resume | ✅ True | — |
| Live execution feedback | ✅ True | — |
| Event Bus | ✅ True | — |
| Audit Trail | ✅ True | — |
| Backend State Engine | ✅ True | — |
| Business Resources | ✅ True | — |
| Multi-user org-aware | ✅ True | — |
| Manifest-driven Inspector | ✅ True | Phase 13 |
| UI generated from Manifest UI Schema | ✅ True | Phase 13 |
| Typed connection enforcement | ✅ True | Phase 14 |
| Resource Bindings (formal layer) | ✅ True | Phase 15 |
| Explorer (full) | ✅ True | **Phase 16** |
| Frontend State Engine | ✅ True | **Phase 17** |
| External Marketplace distribution | ✅ True | **Phase 18** |

**All 18 V4 architecture claims verified. Platform complete.**

---

## Security Reminders

- `.env` files — **never commit**. Contain real Supabase project ref `fsrdasrwceuscrfglskd`, `OPENAI_API_KEY`, Upstash `REDIS_URL`.
- Registry submit endpoint must validate bundle content before storage upload. Reject bundles with executors that call `approval.decide` or attempt to escalate permissions.
- Bundle storage in Supabase Storage — use a private bucket (not public). `bundleUrl` is a signed URL generated at install time, not a permanent public link.
- Never use `bash cat >>` on FUSE-mounted files. Always use Read/Edit/Write tools.
- AI guardrail: AI nodes cannot call `approval.decide`. This restriction applies to executors loaded from the registry — validate during submit.
---

## Phase 17 Completion Addendum - 2026-07-01

**Status:** Code complete; live browser verification pending.

**Completed:**
- [x] `WorkflowStore`, `CanvasStore`, `ExecutionStore`, and persisted `UIStore` are wired into the workflow page.
- [x] Workflow metadata, workflow definition, save state, load error, execution state, execution logs, sidebar tab, panel visibility, organization id, canvas validation state, bulk mode requests, and draft requests now use stores instead of page-local business state.
- [x] `WorkflowCanvas.tsx` syncs ReactFlow nodes, edges, selected node id, read-only state, and validation state into `CanvasStore`.
- [x] `ExecutionLogPanel.tsx` reads run summary, node logs, and loading state from `ExecutionStore`, while preserving optional props for compatibility.
- [x] `useExecutionRunMonitor.ts` extracts run monitoring from the workflow page and updates `ExecutionStore` through authenticated `apiClient` polling.
- [x] `corepack pnpm --filter web typecheck` passed on 2026-07-01.
- [x] `corepack pnpm --filter @lados/shared-types typecheck` passed on 2026-07-01.

**Deferred / follow-up:**
- [ ] True browser SSE remains deferred. `GET /runs/:runId/stream` is currently protected by JWT `Authorization` header auth, while native browser `EventSource` cannot send custom auth headers.
- [ ] Live per-node canvas colouring via `SkillNode.tsx` remains pending until the backend stream path can safely deliver per-node status events to the browser.
- [ ] Workflow page is not yet reduced below 100 lines; it is now a thinner orchestrator, but full page slimming should be done after Phase 16 Explorer lands.
- [ ] Full monorepo `corepack pnpm typecheck` should be retried. The first run hit a transient Node native assertion inside `shared-types`; focused checks passed individually.
- [ ] Browser verify workflow load, edit/save, execution log panel, persisted sidebar tab/collapse state, and run monitoring against a live API session.

**Decision note:** The original P17-010 called for `useExecutionSSE.ts`. The implemented hook is named `useExecutionRunMonitor.ts` because the current backend/browser auth contract makes direct SSE unreliable. This is a deliberate stabilization step, not a feature removal.
## Phase 16 Completion Addendum - 2026-07-02

**Status:** Code complete; browser verification pending.

**Completed:**
- [x] `ExplorerShell.tsx` created and wired into the workflow page.
- [x] Explorer owns global search, active tab state, collapse state, and `Cmd/Ctrl + E` collapse/expand shortcut.
- [x] Explorer persists active tab to `localStorage` key `lados.explorer.activeTab`.
- [x] Explorer persists collapsed state to `localStorage` key `lados.explorer.collapsed`.
- [x] Existing Nodes, Files, Data Packs, and Runs panels are preserved inside Explorer.
- [x] Added Resources tab with project resource listing, type filter, global search, click-through, and drag metadata.
- [x] Added Templates tab with template list, category/search filtering, read-only canvas preview modal, and Apply-to-canvas flow.
- [x] Added minimal `GET /workflow-templates/:id` API route to fetch template definitions for preview/apply.
- [x] Added Packs tab with installed pack list, status badges, `/packs` and `/marketplace` links, and expandable node lists.
- [x] Added inline Versions tab with save snapshot and restore flow, replacing the previous drawer-only version workflow.
- [x] Workflow page no longer renders the raw 4-tab sidebar.
- [x] `corepack pnpm --filter web typecheck` passed on 2026-07-02.
- [x] `corepack pnpm --filter api typecheck` passed on 2026-07-02.
- [x] Full `corepack pnpm typecheck` passed on 2026-07-02.

**Implementation decision:**
- The Explorer ships with 8 tabs instead of only 6: Nodes, Resources, Templates, Runs, Packs, Versions, Files, and Data. This preserves the existing working `documents` and `datapacks` panels while adding the new Phase 16 Explorer capabilities.

**Pending browser verification:**
- [ ] Explorer renders on the live workflow page without console errors.
- [ ] Global search filters Nodes, Resources, Templates, Packs, and Versions.
- [ ] `Cmd/Ctrl + E` collapses and expands Explorer.
- [ ] Active tab and collapsed state persist after reload.
- [ ] Nodes drag-to-canvas still works.
- [ ] Resources list/filter/drag metadata works with live data.
- [ ] Templates preview modal opens and Apply replaces the canvas.
- [ ] Runs tab loads workflow/group history.
- [ ] Packs tab expands and shows pack nodes.
- [ ] Versions tab saves/restores snapshots inline.

---
