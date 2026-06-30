# QS-WFUI — Sprint Plan: Phases 13 → 15
**Version:** 1.0  
**Date:** 2026-06-30  
**Covers:** Phase 13 — Manifest-Driven Inspector · Phase 14 — Typed Connection Enforcement · Phase 15 — Resource Bindings  
**Architecture Direction:** V4 Build — Canvas UX Layer + Resource Binding Model

---

## Context: Why These Three Phases

The Lados V4 architecture document declares three pillars that are still **gaps in the current codebase**:

| Pillar (V4 Blueprint) | Current State | Phase to Close It |
|---|---|---|
| Manifest-driven UI — Inspector auto-generated from `NodeManifest.configSchema` with `ui:widget` hints | `PropertyPanel.tsx` has 650+ lines of hardcoded type-switches reading legacy `config_schema` from the DB; `ui:widget` and sections are ignored | **Phase 13** |
| Typed ports — port `PortDataType` is declared in manifests but the canvas enforces no connection rules | `onConnect` in `WorkflowCanvas.tsx` accepts any source→target pair; `isValidConnection` callback absent | **Phase 14** |
| Resource Bindings — workflows reference resources via a governed binding layer, not raw IDs in `config` | No `resource_bindings` table; nodes store resource IDs directly in `config: Record<string, unknown>` | **Phase 15** |

These three phases complete the V4 canvas identity: a **metadata-driven, type-safe, resource-governed workflow IDE**.

---

## Current Build State

```
Phase 0–12   ✅ COMPLETE
Phase 13     ← Manifest-Driven Inspector          (THIS PLAN)
Phase 14     ← Typed Port Connection Enforcement  (THIS PLAN)
Phase 15     ← Resource Bindings                  (THIS PLAN)
```

**Key architecture facts in the current codebase:**

- `packages/node-sdk/src/types.ts` — `NodeManifest` has `configSchema: ConfigField[]` where each `ConfigField` carries `'ui:widget'?: UiWidget` and `'ui:resourceType'?: string` and optional `validation` and section hints via `NodeUISchema.sections`.
- `PortDataType` = `'string' | 'number' | 'boolean' | 'object' | 'array' | 'file' | 'json' | 'boq' | 'any'` — defined in node-sdk types.
- `WorkflowConnection` in `packages/shared-types/src/workflow.ts` = `{ id, sourceNodeId, sourcePortId, targetNodeId, targetPortId }` — port IDs are plain strings.
- `GET /api/v1/nodes/:type` returns the DB-stored node definition including `config_schema[]` and `inputs[]` / `outputs[]` — this is the correct endpoint for manifest lookup.
- Last migration: `0045_phase9_test_seed.sql` — next migration number is `0046`.
- **SECURITY**: `.env` files with real Supabase credentials and `OPENAI_API_KEY` must never be committed.

---

## Phase 13 — Manifest-Driven Inspector

### Goal

Replace the hardcoded type-switch rendering in `PropertyPanel.tsx` with a fully manifest-driven component that reads `NodeManifest.configSchema`, respects `ui:widget` hints, renders sections from `uiSchema.sections`, and falls back gracefully for legacy nodes.

### What Changes

- `apps/web/src/components/canvas/PropertyPanel.tsx` — refactored (NOT deleted — in-place upgrade)
- `apps/web/src/components/canvas/fields/` — new directory for individual field components (one file per widget type)
- `packages/shared-types/src/workflow.ts` — no change required (config stays `Record<string, unknown>`)
- `packages/node-sdk/src/types.ts` — no change required (types already complete)
- `apps/api/` — no change required (`GET /nodes/:type` already returns the manifest)

### Tasks

#### P13-001 — Audit current PropertyPanel and map widget coverage

**File:** `apps/web/src/components/canvas/PropertyPanel.tsx`

Audit checklist:
- [ ] List all `field.type` branches currently handled (string, number, boolean, select, multiselect, textarea, file, json, secret, library-picker, resource)
- [ ] List all `ui:widget` values defined in `UiWidget` type in node-sdk that are NOT yet rendered: `date`, `toggle`, `resource-picker`, `json`, `file-upload`
- [ ] Identify the `sections` rendering gap — `NodeUISchema.sections[]` groups fields by `fieldKeys[]` but PropertyPanel does not respect this grouping
- [ ] Note that `nodeDef.config_schema` from the API uses snake_case keys but the SDK types use camelCase `configSchema` — must normalise in the fetch layer

Output: a comment block at the top of `PropertyPanel.tsx` listing what was missing, for code review traceability.

---

#### P13-002 — Create atomic field components

**Directory:** `apps/web/src/components/canvas/fields/`

Create one file per widget type. Each file exports a single default component with the props interface:

```typescript
interface FieldProps {
  field: ConfigField;          // from @lados/node-sdk
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  organizationId: string;
  projectId: string;
}
```

Files to create:

| File | Widget(s) handled | Notes |
|---|---|---|
| `TextField.tsx` | `text`, `string` | Single-line input |
| `TextareaField.tsx` | `textarea` | Multi-line; respects `field.placeholder` |
| `NumberField.tsx` | `number` | Uses `validation.min` / `validation.max` if present |
| `ToggleField.tsx` | `toggle`, `boolean` | Checkbox with label |
| `SelectField.tsx` | `select` | `<select>` from `field.options[]` |
| `MultiSelectField.tsx` | `multiselect` | Checkbox group or tag-chip selector |
| `DateField.tsx` | `date` | `<input type="date">` returning ISO string |
| `SecretField.tsx` | `secret` | Password input with show/hide toggle |
| `JsonField.tsx` | `json` | `<textarea>` with JSON parse validation; red border on invalid JSON |
| `FileUploadField.tsx` | `file-upload`, `file` | Move existing `FileUploadField` from `PropertyPanel.tsx` into this file |
| `ResourcePickerField.tsx` | `resource-picker`, `resource` | Move existing `ResourcePickerField` from `PropertyPanel.tsx` into this file |

Each component must:
- Read `field.required` and show a red `*` in the label
- Read `field.description` and render as helper text below the label
- Read `field.placeholder` where applicable
- Apply `validation.pattern` regex check on blur for `TextField` and `TextareaField`
- Export a named `fieldTestId(key: string)` helper for future testing (`data-testid={fieldTestId(field.key)}`)

---

#### P13-003 — Create ManifestFieldRouter

**File:** `apps/web/src/components/canvas/ManifestFieldRouter.tsx`

This is the dispatcher — it receives a single `ConfigField` and selects the correct atomic component.

```typescript
import type { ConfigField } from '@lados/node-sdk';

interface Props {
  field: ConfigField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  organizationId: string;
  projectId: string;
}

export default function ManifestFieldRouter({ field, ...rest }: Props) {
  const widget = field['ui:widget'];
  const type   = field.type;

  if (widget === 'resource-picker' || type === 'resource') return <ResourcePickerField field={field} {...rest} />;
  if (widget === 'file-upload'     || type === 'file')     return <FileUploadField field={field} {...rest} />;
  if (widget === 'json'            || type === 'json')      return <JsonField field={field} {...rest} />;
  if (widget === 'textarea'        || type === 'textarea')  return <TextareaField field={field} {...rest} />;
  if (widget === 'toggle'          || type === 'boolean')   return <ToggleField field={field} {...rest} />;
  if (widget === 'number'          || type === 'number')    return <NumberField field={field} {...rest} />;
  if (widget === 'select'          || type === 'select')    return <SelectField field={field} {...rest} />;
  if (widget === 'multiselect'     || type === 'multiselect') return <MultiSelectField field={field} {...rest} />;
  if (widget === 'date')                                    return <DateField field={field} {...rest} />;
  if (widget === 'secret'          || type === 'secret')    return <SecretField field={field} {...rest} />;
  // Default fallback
  return <TextField field={field} {...rest} />;
}
```

---

#### P13-004 — Create ManifestSection component

**File:** `apps/web/src/components/canvas/ManifestSection.tsx`

Renders a titled collapsible section of fields. Used when `uiSchema.sections[]` is present.

```typescript
interface ManifestSectionProps {
  title: string;
  fields: ConfigField[];
  config: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  organizationId: string;
  projectId: string;
  defaultOpen?: boolean;
}
```

Behaviour:
- Collapsed/expanded state managed with `useState(defaultOpen ?? true)`
- Section header: small uppercase label + chevron toggle
- Renders `ManifestFieldRouter` for each field
- If `fields` is empty, renders nothing (section is hidden)

---

#### P13-005 — Refactor PropertyPanel to use manifest components

**File:** `apps/web/src/components/canvas/PropertyPanel.tsx`

Replace the large `config_schema.map()` block with manifest-driven rendering:

1. **Normalise manifest data** — after fetching `GET /nodes/:type`, map `nodeDef.config_schema` (snake_case from API) to `ConfigField[]` (SDK format). The key difference: the API returns `config_schema` as an array; the field `'ui:widget'` and `'ui:resourceType'` keys use colon syntax which survives JSON round-trip.

2. **Section rendering logic:**
   ```
   if nodeDef.uiSchema?.sections exists:
     render each section via ManifestSection
     render any fields NOT in any section as an "Other" section
   else:
     render all fields flat via ManifestFieldRouter (backward-compatible)
   ```

3. **Remove inline field rendering** — delete all the `{field.type === 'string' && ...}` blocks. The atomic components replace them entirely.

4. **Keep the existing panel chrome** — node header, port list, save button, read-only mode — these do not change.

5. **Fallback** — if `GET /nodes/:type` returns 404 (unknown node type) or the response has no `config_schema`, render the existing "Could not load skill definition" message.

**Acceptance:** zero TypeScript errors; existing nodes render identically to before; `ui:widget: 'date'` fields now show a date picker instead of a raw text input.

---

#### P13-006 — Update shared-types to add UiWidget re-export

**File:** `packages/shared-types/src/index.ts`

Re-export `UiWidget`, `ConfigField`, `ConfigSchema`, `NodeManifest` from `@lados/node-sdk` so frontend components can import from `@lados/shared-types` without depending directly on node-sdk.

```typescript
export type { UiWidget, ConfigField, ConfigSchema, NodeManifest } from '@lados/node-sdk';
```

---

#### P13-X — Verify + checklist update

- [ ] `pnpm --filter @lados/web tsc --noEmit` — zero errors
- [ ] All existing nodes in the canvas still show their config fields
- [ ] `date` widget renders a date picker
- [ ] `toggle` widget renders a toggle, not a checkbox labelled "Enabled"
- [ ] `json` widget shows red border on invalid JSON and does not save until valid
- [ ] Sections from `uiSchema.sections` group fields with headers in the panel
- [ ] Mark Phase 13 complete in this checklist

---

## Phase 14 — Typed Port Connection Enforcement

### Goal

Prevent invalid connections on the canvas at interaction time using ReactFlow's `isValidConnection` callback, driven by port type metadata from the node manifest. Add visual type indicators on node handles so users can see port types before connecting.

### What Changes

- `apps/web/src/components/canvas/WorkflowCanvas.tsx` — add `isValidConnection`
- `apps/web/src/components/canvas/SkillNode.tsx` — add type-coloured handle rings and port type tooltips
- `packages/shared-types/src/workflow.ts` — add `PortTypeCompatibilityMatrix` (compile-time reference, not runtime)
- `apps/web/src/lib/portTypes.ts` — new utility: type lookup + compatibility check

### Port Type Compatibility Rules

```
PortDataType compatibility matrix (source → target):

'any'     → any                      ✅ always compatible
any       → 'any'                    ✅ always compatible
'string'  → 'string' | 'any'
'number'  → 'number' | 'any'
'boolean' → 'boolean' | 'any'
'object'  → 'object' | 'json' | 'any'
'json'    → 'json' | 'object' | 'any'
'array'   → 'array' | 'any'
'file'    → 'file' | 'any'
'boq'     → 'boq' | 'object' | 'any'   (BOQ is a subtype of object)
```

Connecting incompatible types shows a visual rejection and no edge is added.

### Port Type Colours

Consistent visual language for port types across the canvas:

| Type | Colour | Hex |
|---|---|---|
| `any` | grey | `#9CA3AF` |
| `string` | blue | `#3B82F6` |
| `number` | amber | `#F59E0B` |
| `boolean` | green | `#10B981` |
| `object` | purple | `#8B5CF6` |
| `json` | indigo | `#6366F1` |
| `array` | cyan | `#06B6D4` |
| `file` | orange | `#F97316` |
| `boq` | teal | `#14B8A6` |

### Tasks

#### P14-001 — Add portTypes utility

**File:** `apps/web/src/lib/portTypes.ts`

```typescript
import type { PortDataType } from '@lados/node-sdk';

export const PORT_COLORS: Record<PortDataType, string> = {
  any:     '#9CA3AF',
  string:  '#3B82F6',
  number:  '#F59E0B',
  boolean: '#10B981',
  object:  '#8B5CF6',
  json:    '#6366F1',
  array:   '#06B6D4',
  file:    '#F97316',
  boq:     '#14B8A6',
};

// Returns true if a connection from sourceType → targetType is valid
export function isPortCompatible(
  sourceType: PortDataType | undefined,
  targetType: PortDataType | undefined,
): boolean {
  if (!sourceType || !targetType) return true;  // unknown type → allow
  if (sourceType === 'any' || targetType === 'any') return true;
  if (sourceType === targetType) return true;
  if (sourceType === 'json'   && targetType === 'object') return true;
  if (sourceType === 'object' && targetType === 'json')   return true;
  if (sourceType === 'boq'    && targetType === 'object') return true;
  if (sourceType === 'boq'    && targetType === 'json')   return true;
  return false;
}
```

---

#### P14-002 — Extend WorkflowCanvas with port type registry

**File:** `apps/web/src/components/canvas/WorkflowCanvas.tsx`

The canvas needs to know the `PortDataType` for any port on any node. The node manifest already has `inputs[]` and `outputs[]` with `type: PortDataType`.

**Step 1 — Build a port type map from the node list:**

```typescript
// Map: nodeId → { portId → PortDataType }
const [portTypeMap, setPortTypeMap] = useState<Record<string, Record<string, PortDataType>>>({});
```

Populate `portTypeMap` when nodes are loaded/changed. For each node in `rfNodes`:
- Look up `node.data.nodeType` in `nodeDefinitions` (already fetched per-node for rendering)
- For each input port: `portTypeMap[node.id][port.id] = port.type`
- For each output port: `portTypeMap[node.id][port.id] = port.type`

**Step 2 — Add `isValidConnection` callback:**

```typescript
const isValidConnection = useCallback(
  (connection: Connection): boolean => {
    const { source, sourceHandle, target, targetHandle } = connection;
    if (!source || !target) return false;
    // Self-connection guard
    if (source === target) return false;
    // Type check
    const srcType = portTypeMap[source]?.[sourceHandle ?? 'out'];
    const tgtType = portTypeMap[target]?.[targetHandle ?? 'in'];
    return isPortCompatible(srcType, tgtType);
  },
  [portTypeMap],
);
```

Pass to `<ReactFlow isValidConnection={isValidConnection} ... />`.

**Step 3 — Visual rejection feedback:**

When ReactFlow calls `isValidConnection` and gets `false`, it prevents the edge drop. Add a brief toast/snackbar:

```typescript
const onConnectStart = useCallback(...)   // existing or add
const onConnectEnd = useCallback((event, connectionState) => {
  if (connectionState && !connectionState.isValid) {
    // show 2-second "Incompatible port types" toast
    setConnectionError('Incompatible port types');
    setTimeout(() => setConnectionError(null), 2000);
  }
}, []);
```

Add a small `connectionError` dismissible banner at top of canvas.

---

#### P14-003 — Add type-coloured handles to SkillNode

**File:** `apps/web/src/components/canvas/SkillNode.tsx`

Currently handles render as plain circles. Upgrade:

1. Each `<Handle>` gets a coloured ring based on `PORT_COLORS[port.type]`:
   ```tsx
   <Handle
     type="target"
     position={Position.Left}
     id={port.id}
     style={{
       background: PORT_COLORS[port.type as PortDataType] ?? PORT_COLORS.any,
       width: 10,
       height: 10,
       border: '2px solid white',
     }}
   />
   ```

2. Add a port label tooltip on hover — show `port.label` and `port.type`:
   ```tsx
   <div
     className="absolute left-4 text-[9px] text-gray-400 whitespace-nowrap pointer-events-none"
     style={{ top: '50%', transform: 'translateY(-50%)' }}
   >
     {port.label} <span className="font-mono opacity-60">({port.type})</span>
   </div>
   ```
   Only show on hover using `group-hover:opacity-100 opacity-0 transition-opacity`.

3. Port type chip in `PropertyPanel.tsx` port list — already shows port type string; add a 6px colour dot before the type label using `PORT_COLORS`.

---

#### P14-004 — Add PORT_COLORS to shared-types

**File:** `packages/shared-types/src/portTypes.ts` (new)

Re-export `PORT_COLORS` and `isPortCompatible` from a shared location so they can be used by both the canvas and any future CLI tooling.

```typescript
export { PORT_COLORS, isPortCompatible } from '../../apps/web/src/lib/portTypes';
```

⚠️ If circular dependency risk — keep in `apps/web/src/lib/portTypes.ts` only and do NOT add to shared-types. Document the decision in a comment. Evaluate per TypeScript compilation result.

---

#### P14-005 — Guard against same-node and duplicate connections

**File:** `apps/web/src/components/canvas/WorkflowCanvas.tsx`

Add to `isValidConnection`:

```typescript
// Duplicate connection guard — same source port can connect to same target port only once
const alreadyConnected = rfEdges.some(
  (e) => e.source === source && e.sourceHandle === sourceHandle
       && e.target === target && e.targetHandle === targetHandle,
);
if (alreadyConnected) return false;
```

---

#### P14-X — Verify + checklist update

- [ ] `pnpm --filter @lados/web tsc --noEmit` — zero errors
- [ ] Connecting `string` output → `number` input is blocked (no edge added)
- [ ] Connecting `string` output → `any` input is allowed
- [ ] Connecting `boq` output → `object` input is allowed
- [ ] Connecting a node to itself is blocked
- [ ] "Incompatible port types" toast appears on rejected drag-drop
- [ ] Handles show coloured rings — blue for string, amber for number, teal for boq, etc.
- [ ] Port type label shows on handle hover
- [ ] Mark Phase 14 complete in this checklist

---

## Phase 15 — Resource Bindings

### Goal

Implement the Resource Binding model: a governed indirection layer between workflow nodes and workspace resources. Instead of baking a resource ID directly into `node.config`, a node declares a **binding key** (e.g. `"boq_source"`) and the platform resolves which actual resource that key maps to at execution time.

This enables:
- One workflow definition reused across multiple projects with different resources
- Central resource governance — change the binding, all workflows using it update automatically
- Audit trail for resource access per workflow execution

### Architecture

```
WorkflowNodeInstance.config  ←  stores binding keys, not resource IDs
        │
        ▼
resource_bindings table
  workflow_id, node_id, binding_key, resource_id, resource_type
        │
        ▼
Execution engine resolves bindings at triggerRun() time
  → injects resolved resource_id into NodeContext.config
```

### Tasks

#### P15-001 — Migration 0046: resource_bindings table

**File:** `supabase/migrations/0046_resource_bindings.sql`

```sql
-- ── resource_bindings ────────────────────────────────────────────────────────
-- Maps a workflow node's binding key to a concrete workspace resource.
-- The execution engine resolves these at run time and injects the resource_id
-- into NodeContext.config before the node executor fires.

CREATE TABLE IF NOT EXISTS resource_bindings (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid        NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  project_id    uuid        REFERENCES projects(id) ON DELETE CASCADE,
  workflow_id   uuid        NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  node_id       text        NOT NULL,          -- WorkflowNodeInstance.id
  binding_key   text        NOT NULL,          -- matches a key in node config_schema
  resource_id   uuid        NOT NULL,          -- target resource (any table)
  resource_type text        NOT NULL,          -- 'boq' | 'contract' | 'vehicle' | etc.
  created_by    uuid        REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workflow_id, node_id, binding_key)   -- one binding per key per node
);

-- Indexes
CREATE INDEX idx_resource_bindings_workflow ON resource_bindings (workflow_id);
CREATE INDEX idx_resource_bindings_org     ON resource_bindings (org_id);
CREATE INDEX idx_resource_bindings_resource ON resource_bindings (resource_id);

-- Updated_at trigger
CREATE TRIGGER set_resource_bindings_updated_at
  BEFORE UPDATE ON resource_bindings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE resource_bindings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org members can read bindings"
  ON resource_bindings FOR SELECT
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org members can write bindings"
  ON resource_bindings FOR ALL
  USING (
    org_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin', 'member')
    )
  );

COMMENT ON TABLE resource_bindings IS
  'Governed binding layer mapping workflow node config keys to workspace resources. '
  'Resolved at execution time by the LCE Execution Engine.';
```

Run via: `supabase db push` or apply in Supabase SQL editor.

---

#### P15-002 — Add ResourceBindingsModule to API

**Files to create:**

```
apps/api/src/resource-bindings/
  resource-bindings.module.ts
  resource-bindings.controller.ts
  resource-bindings.service.ts
  dto/
    upsert-binding.dto.ts
    binding-response.dto.ts
```

**`resource-bindings.service.ts`** — core operations:

```typescript
// GET /workflows/:workflowId/bindings
// Returns all bindings for a workflow (grouped by node_id)
async listBindings(workflowId: string, userId: string): Promise<ResourceBinding[]>

// PUT /workflows/:workflowId/bindings/:nodeId/:bindingKey
// Upsert a single binding
async upsertBinding(
  workflowId: string, nodeId: string, bindingKey: string,
  resourceId: string, resourceType: string, userId: string,
): Promise<ResourceBinding>

// DELETE /workflows/:workflowId/bindings/:nodeId/:bindingKey
// Remove a binding (node will fall back to config value)
async deleteBinding(
  workflowId: string, nodeId: string, bindingKey: string, userId: string,
): Promise<void>

// resolveBindings (internal — called by ExecutionService)
// Returns { [nodeId]: { [bindingKey]: resourceId } } for all nodes in a workflow
async resolveBindings(workflowId: string): Promise<Record<string, Record<string, string>>>
```

Each write operation must call `assertWorkflowAccess(workflowId, userId)` — uses `workflow.service.ts`'s `assertProjectAccess` pattern.

**`resource-bindings.controller.ts`** routes:

```
GET    /api/v1/workflows/:workflowId/bindings
PUT    /api/v1/workflows/:workflowId/bindings/:nodeId/:bindingKey
DELETE /api/v1/workflows/:workflowId/bindings/:nodeId/:bindingKey
```

All routes: `@UseGuards(SupabaseAuthGuard)`, `@ApiBearerAuth()`.

**`upsert-binding.dto.ts`**:
```typescript
export class UpsertBindingDto {
  @IsUUID()    resourceId: string;
  @IsString()  resourceType: string;
}
```

Wire `ResourceBindingsModule` into `AppModule`.

---

#### P15-003 — Execution engine binding resolution

**File:** `apps/api/src/execution/execution.service.ts`

In `triggerRun()`, after loading the workflow definition but before dispatching to `WorkflowRunner`:

```typescript
// Resolve resource bindings and merge into node configs
const bindings = await this.resourceBindingsService.resolveBindings(workflowId);

// For each node in the definition, overlay bound resource IDs onto config
const resolvedNodes = definition.nodes.map((node) => {
  const nodeBindings = bindings[node.id] ?? {};
  if (Object.keys(nodeBindings).length === 0) return node;
  return {
    ...node,
    config: { ...node.config, ...nodeBindings },
    // Mark as binding-resolved for audit
    _bindingsResolved: Object.keys(nodeBindings),
  };
});

// Pass resolvedNodes to WorkflowRunner instead of definition.nodes
```

Inject `ResourceBindingsService` via constructor DI.

**Audit log entry** — when bindings are resolved, emit an audit event:
```typescript
await this.auditService.log({
  orgId, userId,
  action: 'execution.bindings_resolved',
  resourceType: 'workflow_run',
  resourceId: runId,
  metadata: { workflowId, bindingCount: Object.values(bindings).flat().length },
});
```

---

#### P15-004 — ResourceBindingPanel frontend component

**File:** `apps/web/src/components/canvas/ResourceBindingPanel.tsx`

A panel tab shown in the Inspector when the selected node has `resource_requirements[]` declared in its manifest OR when `config_schema` contains fields with `'ui:widget': 'resource-picker'`.

**Purpose:** instead of setting a resource ID in the Config tab directly, the user can use the Bindings tab to bind the node's resource key to a workspace resource by name. The binding is saved server-side and resolved at run time.

**Layout:**

```
[Config] [Bindings] ← new tab next to Config in PropertyPanel

Bindings tab:
┌─────────────────────────────────────────────────────┐
│  boq_source                                          │
│  ┌────────────────────────────────────┐  [Remove]    │
│  │ BOQ-2024-JKRPK-001 (Bill of Qty.) │              │
│  └────────────────────────────────────┘              │
│  [+ Bind another resource]                           │
└─────────────────────────────────────────────────────┘
```

**Fetch:** on panel open, call `GET /workflows/:workflowId/bindings` filtered by `node_id`.

**Save:** on resource selection, call `PUT /workflows/:workflowId/bindings/:nodeId/:key` with `{ resourceId, resourceType }`.

**Resource picker:** reuse `ResourcePickerField` component from Phase 13 to render the resource dropdown.

**Props:**
```typescript
interface ResourceBindingPanelProps {
  workflowId: string;
  nodeId: string;
  bindableKeys: string[];     // config_schema fields where ui:widget === 'resource-picker'
  organizationId: string;
  projectId: string;
  readOnly?: boolean;
}
```

---

#### P15-005 — Integrate ResourceBindingPanel into PropertyPanel

**File:** `apps/web/src/components/canvas/PropertyPanel.tsx`

Add a `[Bindings]` tab next to the existing config rendering when the node has any `resource-picker` fields in its manifest.

Tab logic:
```typescript
const hasBindableFields = nodeDef?.config_schema.some(
  (f) => f['ui:widget'] === 'resource-picker' || f.type === 'resource',
);

// If true: show [Config | Bindings] tab strip at top of panel body
// Default tab: 'config'
```

Pass `bindableKeys` extracted from config_schema to `ResourceBindingPanel`.

---

#### P15-006 — Add ResourceBinding types to shared-types

**File:** `packages/shared-types/src/resourceBindings.ts`

```typescript
export interface ResourceBinding {
  id:           string;
  orgId:        string;
  projectId:    string | null;
  workflowId:   string;
  nodeId:       string;
  bindingKey:   string;
  resourceId:   string;
  resourceType: string;
  createdBy:    string | null;
  createdAt:    string;
  updatedAt:    string;
}

export interface ResolvedBindings {
  /** nodeId → bindingKey → resourceId */
  [nodeId: string]: Record<string, string>;
}
```

Export from `packages/shared-types/src/index.ts`.

---

#### P15-007 — PowerShell smoke test

Test the full Resource Binding flow end-to-end from PowerShell (API must be running on `http://localhost:4000`):

```powershell
# 1. Get JWT
$body = @{ email="contractor-owner@lados.dev"; password="testpass123" } | ConvertTo-Json
$auth = Invoke-RestMethod -Uri "https://fsrdasrwceuscrfglskd.supabase.co/auth/v1/token?grant_type=password" `
  -Method POST -Body $body -ContentType "application/json"
$token = $auth.access_token

$headers = @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" }

# 2. List bindings for a workflow
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/workflows/<WORKFLOW_ID>/bindings" `
  -Headers $headers

# 3. Create a binding
$bindingBody = @{ resourceId = "<RESOURCE_UUID>"; resourceType = "boq" } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/workflows/<WORKFLOW_ID>/bindings/<NODE_ID>/boq_source" `
  -Method PUT -Body $bindingBody -Headers $headers

# 4. Delete a binding
Invoke-RestMethod -Uri "http://localhost:4000/api/v1/workflows/<WORKFLOW_ID>/bindings/<NODE_ID>/boq_source" `
  -Method DELETE -Headers $headers
```

---

#### P15-X — Verify + checklist update

- [ ] `pnpm tsc --noEmit` (full monorepo) — zero errors
- [ ] Migration 0046 applied — `resource_bindings` table exists in Supabase
- [ ] `GET /workflows/:id/bindings` returns `[]` for a new workflow
- [ ] `PUT /workflows/:id/bindings/:nodeId/:key` creates a binding, returns 200
- [ ] `DELETE /workflows/:id/bindings/:nodeId/:key` removes binding, returns 204
- [ ] Triggering a workflow run with a binding → execution engine merges resource_id into node config
- [ ] Audit log shows `execution.bindings_resolved` event after a run with bindings
- [ ] Inspector shows `[Config] [Bindings]` tabs for nodes with resource-picker fields
- [ ] Bindings tab shows existing binding with resource name, and [Remove] button works
- [ ] Mark Phase 15 complete in this checklist

---

## Implementation Order

Phases must be completed in sequence — Phase 14 depends on Phase 13's refactored component structure; Phase 15 is independent but benefits from Phase 13's ResourcePickerField being extracted.

```
Phase 13 (Inspector)        → 2–3 days
Phase 14 (Typed Ports)      → 1–2 days
Phase 15 (Resource Bindings) → 3–4 days
                               ─────────
Total estimate               → 6–9 days
```

Phase 15 API work (P15-001 through P15-003) can be parallelised with Phase 14 frontend work if two streams are running.

---

## Completion Criteria

All three phases are complete when:

1. `PropertyPanel.tsx` renders every `ui:widget` type declared in the SDK — no hardcoded type switches remain
2. ReactFlow canvas blocks incompatible port connections at drag time with visual feedback
3. `resource_bindings` table exists, CRUD API is live, execution engine resolves bindings before each run, and the Inspector shows a Bindings tab for resource-picker nodes
4. `pnpm tsc --noEmit` passes across the full monorepo with zero errors
5. This checklist has all items marked ✅

---

## Security Reminders

- `apps/api/.env`, `apps/api/.env.local`, `apps/web/.env.local` — **never commit**. Contain real Supabase project ref `fsrdasrwceuscrfglskd`, `OPENAI_API_KEY`, Upstash `REDIS_URL`.
- `resource_bindings` API routes must enforce `assertProjectAccess` — no binding read/write without org membership check.
- AI nodes cannot call `approval.decide` — this restriction is in place and must not be bypassed during binding resolution.
- Never use `bash cat >>` to append to files in the FUSE-mounted workspace. Always use the file tools (Read/Edit/Write). The sandbox byte-limit bug will corrupt files.
