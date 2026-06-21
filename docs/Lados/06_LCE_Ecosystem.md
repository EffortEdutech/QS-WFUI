# 06 LCE Ecosystem

**Layer 2 — Engine: "How does Lados work?"**

> This document covers the Pack Ecosystem — how packs are published, versioned, installed, and managed. Audience: platform engineers, pack authors, and solution builders.

---

## 1. What the Ecosystem Is

The Lados Ecosystem is the layer that turns the engine into a platform. It defines how capabilities are packaged, distributed, installed, and composed into solutions.

The vision (10-year horizon):

```
Lados Core Engine
       ↓
Lados Marketplace
       ↓
Thousands of Packs
       ↓
Hundreds of Solutions
       ↓
Millions of Workflow Instances
```

Similar in structure to: Unity Asset Store · VS Code Marketplace · ComfyUI node ecosystem — but focused on enterprise business operations.

**Current status:** Pack manifests are defined and packs are seeded via SQL migrations. The marketplace and runtime installer are Phase 8.

---

## 2. Pack Concept

A pack is an installable bundle that contributes:

| Contribution | Example |
|---|---|
| Resource types | Vehicle, Driver, FuelReceipt |
| Node implementations | `fleet.assign_vehicle`, `fleet.record_fuel` |
| Workflow templates | `fleet.daily_dispatch` |
| State machine definitions | `vehicle_lifecycle` |
| Event declarations | `VehicleAssigned`, `TripCompleted` |
| Permission policies | `fleet.assign`, `fleet.record` |
| Database migrations | `0001_create_fleet_resources.sql` |
| UI components (future) | Vehicle assignment drawer |

A pack is the unit of domain capability. The engine does not know about lorries — the Fleet Pack does.

---

## 3. Pack Lifecycle

```
Available
    ↓
Installing (validate dependencies → run migrations → register nodes)
    ↓
Installed
    ↓
Enabled ←→ Disabled
    ↓
Upgrading (validate compatibility → run incremental migrations)
    ↓
Enabled
    ↓
Uninstalling
    ↓
Removed
```

---

## 4. Foundation Pack (Mandatory)

Foundation Pack is the one pack every solution must install first. It provides universal building blocks that all other packs reuse instead of reimplementing:

```
Foundation Pack
│
├── Users, Roles, Permissions, Teams
├── Files, Attachments
├── Comments, Tags, Labels
├── Notifications
├── Approvals
├── Audit Logs
├── Search (cross-resource)
├── Settings
├── AI Context Builder
├── Reports (basic)
└── Dashboards (basic)
```

Every pack declares `"foundation-pack"` in its `dependencies`.

**Current status:** Foundation capabilities live in separate NestJS modules (FileModule, NotificationModule, etc.). Phase 7 packages them into a formal, installable Foundation Pack.

---

## 5. Official Packs (Target)

| Pack | Domain | Key Resources |
|---|---|---|
| Foundation Pack | Universal base | Users, Files, Approvals, Notifications, Audit |
| Authentication Pack | Auth provider integration | Sessions, API Keys |
| Job Pack | Work orders and scheduling | Customer, Job, Task, Schedule |
| Fleet Pack | Vehicles and drivers | Vehicle, Driver, Trip, FuelReceipt, MaintenanceRecord |
| Equipment Pack | Plant and machinery | Equipment, Operator, HoursLog, MaintenanceRecord |
| Finance Pack | Billing and payments | Invoice, Payment, Expense, Budget |
| HR Pack | People and payroll | Employee, Attendance, Leave, PayrollRun |
| Document Pack | File processing | Document, OCR result, PDF output |
| Dashboard Pack | Owner metrics | Widgets, KPI definitions |
| AI Pack | Intelligence capabilities | AI prompts, context templates, tool definitions |
| Procurement Pack | Purchasing | RFQ, PO, Supplier, Quotation |
| Project Pack | Project management | Project, Phase, Milestone, Task |
| Asset Pack | Asset tracking | Asset, Location, ServiceRecord |
| GIS Pack | Geographic data | Location, Route, Geofence |
| Scheduling Pack | Time and calendar | Shift, Roster, Appointment |
| Approval Pack | Workflow approvals | ApprovalPolicy, ApprovalChain |
| Integration Pack | External APIs | HTTP connector, Webhook receiver |
| Notification Pack | Comms channels | Email, SMS, WhatsApp, Push |

---

## 6. Pack Installer (Phase 8 Target)

`PackInstaller` service:

```typescript
interface PackInstaller {
  install(manifest: PackManifest): Promise<InstallResult>
  upgrade(packKey: string, newManifest: PackManifest): Promise<UpgradeResult>
  enable(packKey: string): Promise<void>
  disable(packKey: string): Promise<void>
  uninstall(packKey: string): Promise<void>
  resolveDependencies(manifest: PackManifest): Promise<DependencyGraph>
  validateCompatibility(manifest: PackManifest): Promise<CompatibilityResult>
}
```

**Install sequence:**

1. Validate engine compatibility (`engineCompatibility` semver range)
2. Resolve and validate dependencies — all must be already installed
3. Run pack migrations in declared order
4. Register nodes in `registered_nodes`
5. Register resource type metadata
6. Register state machine definitions
7. Register event declarations
8. Mark pack as `enabled` in `packs` table

---

## 7. Dependency Rules

- Foundation Pack is always installed first — no pack may declare itself without depending on it
- Circular dependencies are rejected at validation time
- Upgrading a dependency triggers compatibility checks on all dependent packs
- Disabling a pack that others depend on is blocked unless dependents are also disabled

---

## 8. Pack Registry (Current)

| Pack Key | Status | Installed Via |
|---|---|---|
| `core-pack` | Enabled | SQL seed (migration) |
| `ai-pack` | Enabled | SQL seed |
| `document-pack` | Enabled | SQL seed |
| `procurement-pack` | Enabled | SQL seed |
| `qs-pack` | Enabled | SQL seed |

These are seeded directly — no runtime install flow exists yet. Phase 8 will migrate them to the runtime installer.

---

## 9. Internal Registry UI (/packs)

Current pack browser at `/packs` and `/packs/[packId]` shows installed packs and their registered nodes.

Phase 8 adds:
- Available pack catalog (packs that can be installed but aren't yet)
- Install / upgrade / enable / disable actions
- Dependency graph view
- Compatibility warnings for engine version mismatches
- Pack version and changelog display

---

## 10. Publishing a Pack (Future)

In the future, pack authors will be able to:

1. Write a pack with manifest, nodes, migrations, and tests
2. Run `lados publish` — validates, signs, and uploads to the Lados Marketplace
3. Users discover and install the pack from the Marketplace UI
4. Pack updates flow through the upgrade lifecycle

Pack versioning follows semver. Breaking changes require a major version bump and a migration plan.

---

## 11. Contractor Edition Pack Composition

```
Contractor Edition
├── Foundation Pack     (mandatory base)
├── Job Pack            (customers, jobs, scheduling)
├── Fleet Pack          (vehicles, drivers, fuel, maintenance)
├── Equipment Pack      (backhoe, operator, hours)
├── Finance Pack        (invoices, payments, expenses)
├── HR Pack             (attendance, payroll)
├── Document Pack       (upload, OCR, PDF)
├── Dashboard Pack      (owner metrics)
└── AI Pack             (owner assistant, document extraction)
```

Installing Contractor Edition means installing these packs in dependency order: Foundation → Core → Document → AI → Job → Fleet → Equipment → Finance → HR → Dashboard.

---

*Previous: [05 LCE Intelligence](05_LCE_Intelligence.md) · Next: [07 LCE Reference](07_LCE_Reference.md)*
