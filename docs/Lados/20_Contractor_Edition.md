# 20 Contractor Edition

**Layer 3 — Solution: "Lados deployed for a civil works contractor"**

> Contractor Edition is the first production solution running on the Lados platform. It is not a separate product or a customised fork — it is the standard Lados engine with `contractor-pack` installed. The platform UI, workflow engine, resource browser, and approval system are all unchanged. The pack contributes the domain: resource types, nodes, state machines, and workflow templates specific to Malaysian civil works operations.

---

## 1. Who This Is For

**Target user:** A Malaysian civil works contractor (earthworks, road laying, drainage, building) employing 5–200 workers — typically owner-operated. The owner is hands-on, checks the phone constantly, and manages drivers, operators, vehicles, and direct clients (other contractors or JKR).

**Problems it solves:**

| Problem | Without Lados | With Contractor Edition |
|---|---|---|
| Job tracking | WhatsApp + Excel | Structured jobs with lifecycle and billing |
| Fleet tracking | Driver self-report | Trip records tied to jobs and invoices |
| Fuel costs | Paper receipts | AI-extracted receipts, auditable per vehicle |
| Invoicing | Manual Word doc | Generated from job records, auto-totalled |
| Payroll | Spreadsheet guesswork | Attendance × rate with approval before release |
| Owner visibility | None until problems arise | Owner assistant: "How many trips today?" |
| Financial audit | Impossible | Every RM is traceable to source records |

---

## 2. Architecture Principle

**Contractor Edition is a pack solution, not a custom product.**

The Lados platform UI navigation is fixed at engine level and does not change per industry. What changes is the data and workflows inside:

```
Lados Platform (engine)
  ├── /dashboard       — contractor metrics widget (from pack)
  ├── /resources       — all contractor resource types (job, trip, vehicle, ...)
  ├── /workflows       — contractor workflow templates (create_job, dispatch_trip, ...)
  ├── /projects        — job projects (if project-scoped)
  ├── /approvals       — fuel receipts, invoices, payroll runs
  ├── /packs           — contractor-pack shown as installed
  └── /settings
```

**There are no hardcoded contractor pages.** Jobs are at `/resources?type=job`. Trips are at `/resources?type=trip`. Invoices are at `/resources?type=invoice`. The generic resource browser reads `contractor-pack`'s manifest to know what fields, states, and inline actions apply to each type.

---

## 3. Pack Composition

Contractor Edition installs three packs in dependency order:

```
core-pack          (execution engine, event bus, state engine, artifact store)
  └── foundation-pack    (notifications, approvals, file handling, user assignment)
       └── contractor-pack    (all contractor domain: nodes, resources, workflows)
```

**No separate Job Pack, Fleet Pack, Finance Pack, or HR Pack.** All contractor domain logic lives in `contractor-pack`. When the solution grows large enough to warrant splitting (e.g. a dedicated `finance-pack` or `hr-pack`), that is a future refactor — not the current design.

Future packs that may be added:
- `document-pack` — OCR, PDF generation (scaffold exists)
- `ai-pack` — LLM context builder, owner assistant, receipt extraction (scaffold exists)

---

## 4. Resource Model

### 4.1 Resource Types (in `lados_resources`)

All contractor data lives in the `lados_resources` table as typed resources. There are no separate domain tables.

**Phase 9 (built):**

| Resource Type | Key Relationships | States |
|---|---|---|
| `job` | → customer | draft → assigned → active → completed → invoiced → archived |
| `trip` | → job, → vehicle, → driver | pending → in_progress → completed → disputed → archived |
| `fuel_receipt` | → vehicle, → driver | uploaded → extracted → reviewed → approved → posted → archived |
| `invoice` | → job, → customer | draft → submitted → approved → paid → archived |
| `customer` | — | active, inactive |
| `vehicle` | → driver | available → assigned → in_service → maintenance → retired |
| `driver` | → vehicle | active, inactive |
| `equipment` | → operator | available → assigned → working → maintenance → retired |

**Planned (Phase 10+):**

| Resource Type | Key Relationships | States |
|---|---|---|
| `operator` | → equipment | active, inactive |
| `maintenance_record` | → vehicle or equipment | open → in_progress → completed → archived |
| `payment` | → invoice | pending → recorded → reconciled → archived |
| `expense` | → category | draft → approved → archived |
| `payroll_run` | → period | draft → reviewed → approved → paid → archived |

### 4.2 Relationship Rules

- A Vehicle can only be assigned to one Driver at a time
- A Trip must reference a Job and a Vehicle
- An Invoice references exactly one Job
- A FuelReceipt must reference a Vehicle and a Driver
- A Payment must reference an Invoice
- A PayrollRun references an array of employee IDs and their computed pay rows

All relationships are stored in `data` JSONB on the resource record. Cross-resource lookups use `resource.read` nodes with `data.parentId` or typed `data.*Id` fields.

---

## 5. Node Library (`contractor-pack`)

### 5.1 Built (Phase 9)

| Node | What it does |
|---|---|
| `contractor.create_job` | Creates a `job` resource, sets state to `draft` |
| `contractor.dispatch_trip` | Creates a `trip` resource linked to job + vehicle + driver; transitions job to `active` |
| `contractor.complete_trip` | Transitions a trip to `completed`; updates job `data.tripCount` |
| `contractor.upload_fuel_receipt` | Creates a `fuel_receipt` resource with `fileUrl`; sets state to `uploaded` |
| `contractor.generate_invoice` | Creates an `invoice` resource from job record; calculates total from trip count × rate |

### 5.2 Planned (Phase 10+)

| Node | Domain |
|---|---|
| `contractor.record_payment` | Finance |
| `contractor.approve_expense` | Finance |
| `contractor.create_maintenance_record` | Fleet |
| `contractor.clear_maintenance` | Fleet |
| `contractor.prepare_payroll_run` | HR |
| `contractor.approve_payroll` | HR |

---

## 6. Workflow Library

Workflows are `lados_workflows` records seeded from JSON templates in `contractor-pack/workflow_templates/`. They run inside the standard Lados execution engine — no custom runner.

### 6.1 Built (Phase 9 — 3 templates)

| Template | Nodes |
|---|---|
| `job-creation.json` | cron trigger → `contractor.create_job` → `foundation.send_notification` |
| `trip-dispatch.json` | cron trigger → `contractor.dispatch_trip` → `foundation.send_notification` |
| `invoice-generation.json` | cron trigger → `contractor.generate_invoice` → `foundation.request_approval` → notification branch |

### 6.2 Planned (Phase 10+)

| Workflow | Trigger | Nodes |
|---|---|---|
| `fleet.upload_fuel_receipt` | Driver uploads image | `contractor.upload_fuel_receipt` → AI extract → human review → `state.change` to posted |
| `fleet.request_maintenance` | Manual or alert | `resource.create` (maintenance_record) → `foundation.send_notification` → assign workshop |
| `fleet.complete_maintenance` | Workshop action | `resource.update` → `state.change` (vehicle → available) |
| `finance.record_payment` | Payment received | `contractor.record_payment` → match invoice → `foundation.send_notification` |
| `finance.approve_expense` | Expense submitted | `foundation.request_approval` → `contractor.approve_expense` → event publish |
| `payroll.prepare_run` | Period end | collect attendance → `contractor.prepare_payroll_run` → human review |
| `payroll.approve_and_pay` | Owner approves | `foundation.request_approval` → `contractor.approve_payroll` → generate payslips |
| `ai.extract_fuel_receipt` | Receipt upload | AI extract → output review → post if approved |
| `ai.classify_expense` | Expense created | AI classify → human confirm → post |
| `ai.generate_rfq` | BOQ upload | read BOQ → clean → classify trades → generate RFQ per trade |

---

## 7. How the UI Serves Contractor Data

The Lados platform UI is unchanged. `contractor-pack` makes its resources visible through the pack manifest `resources[]` block, which the generic `/resources` page reads to know:

- What resource types exist (tabs across the top)
- What fields to show in the card (`primaryField`, `secondaryField`, `badgeField`, `counterField`)
- What inline actions are available per state (`inlineActions[].visibleInStates`)
- Which actions require confirmation before executing

**Example — Job resource card:**
```
💼 JOB-2024-001 — Jalan Bukit Timah Drainage         [active]  3 trips
   Scheduled: 15 Jul 2024
   [Dispatch Trip]  [Generate Invoice ⚠️]
```

The platform nav entry is `/resources` — a single generic page. The contractor simply switches tabs to move between Jobs, Trips, Vehicles, etc. There are no hardcoded `/jobs` or `/fleet` pages in the platform.

### 7.1 Contractor Dashboard (Planned)

The `/dashboard` page will display a contractor-specific metrics widget contributed by `contractor-pack`. Proposed metrics:

- Active jobs count
- Today's trips (completed vs pending)
- Outstanding invoices (total RM)
- Vehicles in maintenance
- Fuel receipts awaiting review

This widget is rendered by the platform dashboard engine — the pack provides the data query config, not a custom page.

---

## 8. Driver Interface (Planned)

Drivers use the same Lados platform but with a role-filtered view (driver role via Security Engine). They see:

- `/resources?type=trip` — their assigned trips only
- Inline action: **Record Trip** (single form, 3 fields)
- Inline action: **Upload Fuel Receipt** (camera capture)

**Driver UI principles:**
- No more than 3 taps to record a trip
- No financial figures visible — only their own operational tasks
- Notifications: push only for job assignment and approval decisions

Offline support is Phase 11+.

---

## 9. Acceptance Criteria

A Contractor Edition deployment is production-ready when all of the following pass:

### 9.1 Job Flow
- [ ] Owner can create a job via workflow and it appears in `/resources?type=job`
- [ ] Driver receives notification of assignment
- [ ] Driver can record trips against the job
- [ ] Owner can see trip count and progress on the job card
- [ ] Invoice is generated from job record (not manually entered)
- [ ] Invoice totals match trip count × rate

### 9.2 Fleet Flow
- [ ] Vehicle state transitions correctly: available → assigned → in_service → maintenance → available
- [ ] Fuel receipt upload triggers AI extraction workflow
- [ ] AI-extracted receipt must be human-reviewed before posting to expenses
- [ ] Maintenance record blocks vehicle from assignment until cleared

### 9.3 Finance Flow
- [ ] Every RM in an invoice is traceable to a Trip resource
- [ ] Payment records match invoice and update balance
- [ ] Expense records are approved before posting
- [ ] AI cannot post an expense directly — human review always required

### 9.4 Payroll Flow
- [ ] Payroll run covers a defined period with correct employee list
- [ ] Owner must approve payroll before it is marked Paid
- [ ] Payslips reference the approved PayrollRun ID
- [ ] No money movement is initiated by the system — owner initiates actual bank transfer

### 9.5 AI Guardrails (non-negotiable)
- [ ] AI assistant answers are marked advisory
- [ ] AI cannot approve an invoice, payment, or payroll run
- [ ] AI-extracted receipt values are human-confirmed before posting
- [ ] Owner can accept or reject any AI output and the decision is recorded

### 9.6 Audit
- [ ] Every resource mutation has an actor and timestamp
- [ ] Every state transition is logged in `lados_state_history`
- [ ] Every approval decision (approved or rejected) is logged
- [ ] Every AI response is stored in the artifact store with source resource IDs

---

## 10. LCE Platform Phase Status

These phases are defined in the LCE Implementation Blueprint. Contractor Edition runs on top of the platform delivered by these phases.

| LCE Phase | Platform Feature | Status |
|---|---|---|
| Phase 1 | Workflow engine — publish, pause/resume, async run, approval inbox | ✅ Done |
| Phase 2 | Real nodes moved from API into packs | ✅ Done |
| Phase 3 | Resource Engine — `lados_resources`, ResourceService, resource nodes | ✅ Done |
| Phase 4 | Event Bus — `lados_events`, event publisher, state history | ✅ Done |
| Phase 5 | State Engine — state machines, transition rules, approval gating | ✅ Done |
| Phase 6 | Security Engine — fine-grained permissions, role expansion, API keys | ✅ Done |
| Phase 7 | Foundation Pack — notifications, approvals, assign_user | ✅ Done |
| Phase 8 | Pack Installer + Pack Manager UI | ✅ Done |
| Phase 9 | Contractor Edition Pack Build — contractor-pack scaffold, 5 nodes, 8 resource types, 3 workflow templates, generic /resources page | ✅ Done |
| Phase 10 | AI Runtime Upgrade — context builder, tool calling, output ledger | Pending |
| Phase 11 | Internal Registry Maturity — install/upgrade flow, node-level enable/disable | Pending |
| Phase 12 | Async Execution Queue | Pending |
| Phase 13 | LEOS / JKR Layer Preparation | Pending |

> Phase descriptions and scope are owned by `docs/LCE_V1/Lados_Core_Engine_V1_Implementation_Blueprint.md`. Do not edit phase definitions here.

---

## 11. Contractor Solution Delivery Milestones

These milestones track contractor-specific feature delivery within `contractor-pack`. They are independent of LCE phase numbering.

| Milestone | Scope | Status |
|---|---|---|
| **M1 — Core Operations** | 5 nodes, 8 resource types, 3 workflow templates, /resources page | ✅ Done (Phase 9) |
| **M2 — Finance** | `payment`, `expense` resource types; `record_payment`, `approve_expense` nodes; 2 workflow templates | Pending |
| **M3 — Fleet Maintenance** | `maintenance_record`, `operator` resource types; `create_maintenance_record`, `clear_maintenance` nodes; 2 workflow templates | Pending |
| **M4 — HR & Payroll** | `payroll_run` resource type; `prepare_payroll_run`, `approve_payroll` nodes; 2 workflow templates | Pending |
| **M5 — AI Integration** | Fuel receipt AI extraction, expense classifier — requires LCE Phase 10 AI Runtime | Pending |
| **M6 — Owner Dashboard** | Contractor metrics widget: active jobs, today trips, outstanding invoices, vehicles in maintenance | Pending |
| **M7 — Driver UI** | Role-filtered resource view for driver role; trip recording in 3 taps | Pending |

---

## 11. Scale Targets

### 11.1 Contractor Edition

| Area | Target | Current (Phase 9) |
|---|---|---|
| Workflows | 40–70 | 3 templates |
| Nodes (contractor-pack) | 30–50 | 5 |
| Resource types | 15–25 | 8 |
| Dashboards | 5–10 | 0 (planned Phase 12) |

### 11.2 Full LCE V1

| Area | Target | Current |
|---|---|---|
| Engine modules | 80–150 | ~40 |
| NestJS services | 30–60 | ~18 |
| REST API endpoints | 150–300 | ~60 |
| UI components | 150–250 | ~40 |
| Core nodes (Foundation) | 20–30 | 8 |
| Total nodes across packs | 80–120 | ~20 |
| System packs | 10–20 | 6 (scaffold); 3 (fully built) |

---

*Previous: [07 LCE Reference](07_LCE_Reference.md) · Next: [50 LEOS](50_LEOS.md)*
