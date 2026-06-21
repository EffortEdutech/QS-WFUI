# 03 LCE SDK

**Layer 2 — Engine: "How does Lados work?"**

> This document covers the TypeScript SDK packages that define the contracts for building nodes, packs, and solutions. Audience: platform engineers and pack developers.

---

## 1. SDK Overview

The LCE SDK is five TypeScript packages published under `@lados/`:

| Package | Purpose |
|---|---|
| `@lados/node-sdk` | Contract, manifest types, and base class for node implementations |
| `@lados/pack-sdk` | Pack manifest, permission types, and node registration contract |
| `@lados/execution-engine` | DAG runner, graph planner, and checkpoint types |
| `@lados/shared-types` | Cross-layer type contracts used by all packages and apps |
| `@lados/workflow-json` | Workflow definition schema, builder, and validation |

All packages use strict TypeScript and are compiled to `dist/` before consumption.

---

## 2. @lados/node-sdk

The node SDK defines what every node implementation must look like.

### 2.1 Core Types

```typescript
// Status values a node can return
type ExecutionStatus =
  | 'success'
  | 'failure'
  | 'paused'            // signals runner to halt (human approval)
  | 'pending_approval'  // legacy alias — prefer 'paused'
  | 'skipped';

// What the runner passes to every node
interface NodeContext {
  nodeId: string;
  nodeType: string;
  config: Record<string, unknown>;
  inputs: Record<string, unknown>;   // resolved outputs from upstream nodes
  executionId?: string;
  workflowId: string;
  projectId: string;
  organizationId: string;
  userId: string;
  log: NodeLogger;
}

// What every node must return
interface NodeExecuteResult {
  status: ExecutionStatus;
  outputs: Record<string, unknown>;
  logs?: string[];
  summary?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
```

### 2.2 Node Manifest

Every node declares its contract via a manifest:

```typescript
interface NodeManifest {
  type: string;                      // unique dot-namespaced ID, e.g. 'fleet.assign_vehicle'
  name: string;                      // human-readable name
  description: string;
  category: NodeCategory;
  inputs: NodePort[];
  outputs: NodePort[];
  config: ConfigField[];             // drives the PropertyPanel form in the UI
  events?: string[];                 // events this node emits
  requiredPermissions?: string[];
}

type NodeCategory =
  | 'core' | 'resource' | 'event' | 'document' | 'ai'
  | 'procurement' | 'qs' | 'fleet' | 'finance' | 'integration';
```

### 2.3 Port Definition

```typescript
interface NodePort {
  id: string;
  name: string;
  dataType: PortDataType;
  required?: boolean;
  description?: string;
}

type PortDataType =
  | 'string' | 'number' | 'boolean'
  | 'object' | 'array' | 'file' | 'json' | 'boq' | 'any';
```

### 2.4 Config Field

Config fields drive the PropertyPanel form in the canvas UI:

```typescript
interface ConfigField {
  key: string;
  name: string;
  type: ConfigFieldType;            // 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'resource'
  required?: boolean;
  default?: unknown;
  options?: ConfigFieldOption[];    // for 'select' type
  description?: string;
}
```

### 2.5 BaseNode Abstract Class

Pack developers extend `BaseNode` for clean node structure:

```typescript
abstract class BaseNode {
  abstract get manifest(): NodeManifest;
  abstract execute(ctx: NodeContext): Promise<NodeExecuteResult>;

  // Default validation — override for custom rules
  validate(config: unknown): NodeValidationResult { ... }
}
```

### 2.6 Writing a Node

```typescript
import { BaseNode, NodeContext, NodeExecuteResult } from '@lados/node-sdk';

export class AssignVehicleNode extends BaseNode {
  get manifest(): NodeManifest {
    return {
      type: 'fleet.assign_vehicle',
      name: 'Assign Vehicle',
      description: 'Assigns a vehicle to a job and notifies the driver',
      category: 'fleet',
      inputs: [
        { id: 'jobId',     name: 'Job ID',     dataType: 'string', required: true },
        { id: 'vehicleId', name: 'Vehicle ID', dataType: 'string', required: true },
      ],
      outputs: [
        { id: 'assigned', name: 'Assigned', dataType: 'boolean' },
      ],
      config: [
        { key: 'notifyDriver', name: 'Notify Driver', type: 'boolean', default: true },
      ],
      events: ['VehicleAssigned'],
      requiredPermissions: ['fleet.assign'],
    };
  }

  async execute(ctx: NodeContext): Promise<NodeExecuteResult> {
    const { jobId, vehicleId } = ctx.inputs as { jobId: string; vehicleId: string };
    ctx.log.info(`Assigning vehicle ${vehicleId} to job ${jobId}`);
    // ... business logic ...
    return {
      status: 'success',
      outputs: { assigned: true },
      summary: `Vehicle ${vehicleId} assigned to job ${jobId}`,
    };
  }
}
```

---

## 3. @lados/pack-sdk

The pack SDK defines what an installable pack must declare.

### 3.1 PackManifest

```typescript
interface PackManifest {
  packKey: string;                   // unique slug, e.g. 'fleet-pack'
  name: string;
  version: string;                   // semver
  engineCompatibility: string;       // semver range, e.g. '>=1.0.0 <2.0.0'
  dependencies: string[];            // packKeys that must be installed first
  resources?: string[];              // resource types this pack introduces
  nodes: string[];                   // node types this pack registers
  workflows?: string[];              // workflow template IDs
  permissions: PackPermission[];
  events?: string[];                 // event types this pack declares
  states?: string[];                 // state machine IDs
  migrations?: string[];             // SQL migration filenames (applied in order)
}
```

### 3.2 Pack Permission

```typescript
interface PackPermission {
  key: string;                       // e.g. 'fleet.assign'
  description: string;
  defaultRoles: string[];            // roles that get this permission by default
}
```

### 3.3 Pack Node Resolver Contract

Every pack must export a `resolveNode` function. The execution engine calls this to find real executors:

```typescript
// Required export from every pack's index
export function resolveNode(type: string): ((ctx: NodeContext) => Promise<NodeExecuteResult>) | null {
  switch (type) {
    case 'fleet.assign_vehicle': return (ctx) => new AssignVehicleNode().execute(ctx);
    case 'fleet.record_fuel':    return (ctx) => new RecordFuelNode().execute(ctx);
    default: return null;  // runner falls back to mock
  }
}
```

### 3.4 Example Pack Manifest

```json
{
  "packKey": "fleet-pack",
  "name": "Fleet Pack",
  "version": "1.0.0",
  "engineCompatibility": ">=1.0.0 <2.0.0",
  "dependencies": ["foundation-pack"],
  "resources": ["Vehicle", "Driver", "FuelReceipt", "MaintenanceRecord"],
  "nodes": [
    "fleet.assign_vehicle",
    "fleet.record_fuel",
    "fleet.maintenance_alert",
    "fleet.complete_trip"
  ],
  "workflows": ["fleet.daily_dispatch", "fleet.maintenance_review"],
  "permissions": [
    { "key": "fleet.assign",    "description": "Assign vehicles to jobs",   "defaultRoles": ["owner", "admin"] },
    { "key": "fleet.record",    "description": "Record trip and fuel data",  "defaultRoles": ["owner", "admin", "driver"] }
  ],
  "events": ["VehicleAssigned", "TripCompleted", "FuelReceiptUploaded", "MaintenanceDue"],
  "states": ["vehicle_lifecycle", "trip_lifecycle"],
  "migrations": ["0001_create_fleet_resources.sql"]
}
```

---

## 4. @lados/execution-engine

The execution engine package exposes the runner, planner, and all Phase 1 types.

### 4.1 Entry Points

```typescript
// Run a workflow
function runWorkflow(options: RunnerOptions): Promise<ExecutionResult>

// Plan a workflow (used internally — useful for testing)
function planWorkflow(definition: QSWorkflowDefinition): ExecutionPlan

// Class form for advanced usage
class WorkflowRunner {
  constructor(options: RunnerOptions)
  run(): Promise<ExecutionResult>
}
```

### 4.2 RunnerOptions

```typescript
interface RunnerOptions {
  executionId?: string;             // DB run ID
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
```

### 4.3 ExecutionResult

```typescript
interface ExecutionResult {
  status: RunStatus;
  outputs: Record<string, unknown>;
  logs: NodeLogEntry[];
  error?: { code: string; message: string };
  startedAt: string;
  completedAt: string;
  durationMs: number;
  // Phase 1 pause fields:
  pausedAtNodeId?: string;
  checkpointOutputs?: Record<string, Record<string, unknown>>;
  pendingApprovalTaskId?: string;
}

type RunStatus =
  | 'created' | 'running' | 'completed' | 'failed'
  | 'paused' | 'waiting' | 'cancelled' | 'timed_out';
```

### 4.4 ResumeCheckpoint (Phase 1)

```typescript
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

---

## 5. @lados/shared-types

Cross-layer contracts used by all packages and both apps:

```typescript
// API response envelope
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error: string | null;
}

// Workflow definition — imported by runner, API, and web
interface QSWorkflowDefinition {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables?: VariableDefinition[];
  trigger?: TriggerConfig;
}
```

---

## 6. @lados/workflow-json

Provides the complete workflow definition toolkit:

| Export | Purpose |
|---|---|
| `QSWorkflowDefinition` | Full JSON schema type |
| `WorkflowBuilder` | Fluent API for constructing definitions in code |
| `validateWorkflow(def)` | Returns validation errors — run before execution |
| `serializeWorkflow(def)` | JSON string with schema version header |
| `deserializeWorkflow(json)` | Parses and validates JSON string |

Example — `WorkflowBuilder`:

```typescript
const definition = new WorkflowBuilder()
  .addNode({ type: 'core.logger', label: 'Start', config: { message: 'Job started' } })
  .addNode({ type: 'fleet.assign_vehicle', label: 'Assign', config: { notifyDriver: true } })
  .addEdge('node-1', 'node-2')
  .build();
```

---

## 7. Node Migration Path (Phase 2)

Currently, real node implementations live in `apps/api/src/execution/real-nodes/`. Phase 2 moves each into its pack:

```
Before (transitional):
  apps/api/src/execution/real-nodes/
    fleet-assign-vehicle.ts
    procurement-generate-rfq.ts
    ...

After (Phase 2):
  packs/fleet-pack/src/nodes/
    assign-vehicle.ts
    record-fuel.ts
    ...
  packs/procurement-pack/src/nodes/
    generate-rfq.ts
    generate-po.ts
    ...
```

`buildRealNodeResolver()` in `ExecutionService` is updated to call each pack's `resolveNode()` instead of importing from local files.

---

*Previous: [02 LCE Runtime](02_LCE_Runtime.md) · Next: [04 LCE Platform](04_LCE_Platform.md)*
