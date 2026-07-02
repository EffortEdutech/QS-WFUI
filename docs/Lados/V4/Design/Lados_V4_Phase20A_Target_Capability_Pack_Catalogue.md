# Lados V4 Phase 20A: Target Capability Pack Catalogue

**Document ID:** LADOS-V4-P20A-TARGET-CAPABILITY-CATALOGUE  
**Phase:** 20A  
**Status:** Draft target catalogue  
**Date:** 2026-07-03  
**Depends on:** `Lados_V4_Phase20A_Capability_Pack_Planning_and_Node_Taxonomy.md`  

---

## 1. Purpose

This document drafts the new target Capability Pack catalogue for Lados V4 and future versions.

It is intentionally not a direct copy of the current pack folders. The current packs are prototype and learning assets. The target catalogue is organized around business capability ownership, workflow template ownership, node discoverability, and long-term marketplace scale.

This catalogue answers:

- What official Capability Packs should Lados have?
- Which pack owns each business capability?
- Which packs are foundation, domain, solution, vendor, or template packs?
- Which packs depend on each other?
- Which Knowledge Packs are required or recommended?
- Which current prototype packs map into the future target?
- Which pack owns the first professional workflow templates?

---

## 2. Catalogue Principles

1. Capability Packs provide actions, nodes, workflow templates, config schemas, events, permissions, and approved runtime behavior.
2. Knowledge Packs provide governed knowledge, source references, standards, supplier catalogues, SOPs, rates, and evidence rules.
3. A Capability Pack must own a clear business capability boundary.
4. Higher-layer packs should depend on lower-layer packs instead of duplicating their nodes.
5. Solution packs should prefer templates and orchestration over new low-level nodes.
6. A node should exist once under the pack that owns its canonical capability.
7. UI and AI discovery must work from capability intent, not from a flat node list.
8. Test-era nodes must be classified before being accepted into official bundles.

---

## 3. Target Pack Layers

| Layer | Target layer name | Purpose | Allowed contents |
|---|---|---|---|
| L0 | Platform Foundation | Universal workflow primitives and platform resources | triggers, branching, approval, state, resource, artifact, logging |
| L1 | Core Business Domains | Reusable business actions used across industries | documents, AI, communication, finance, procurement, tasks |
| L2 | Professional Domains | Profession-specific operating actions | QS, contract admin, construction operations, asset/fleet |
| L3 | Solution Packs | End-to-end operating workflows for a role, sector, or business model | templates, orchestration, solution-specific dashboards |
| L4 | Vendor/Integration Packs | External system or supplier-specific connectors | accounting, ERP, email provider, storage, supplier portal |
| L5 | Template Packs | Workflow templates and playbooks with few or no new nodes | CIPAA pack, invoice approval pack, RFQ playbook |

Layer rule:

```text
L5 depends on L4/L3/L2/L1/L0.
L3 depends on L2/L1/L0.
L2 depends on L1/L0.
L1 depends on L0.
L0 depends on platform runtime only.
```

---

## 4. Target Official Capability Packs

### 4.1 L0 Platform Foundation Packs

| Target pack ID | Display name | Layer | Ownership boundary | Current prototype source |
|---|---|---|---|---|
| `lados.workflow-foundation` | Workflow Foundation | L0 | control flow, triggers, scheduling, delay, loop, branch, merge, logging | `core-pack` |
| `lados.resource-operations` | Resource Operations | L0 | create/read/update/bind workspace resources and artifacts | `core-pack`, `foundation-pack` |
| `lados.human-work` | Human Work | L0 | approval tasks, assignments, review checkpoints, human decision gates | `foundation-pack`, `core-pack` |

#### `lados.workflow-foundation`

Owns:

- start, webhook, scheduled, and manual triggers
- branch, condition, merge, parallel, loop, delay
- workflow logging
- subflow invocation, when implemented
- run metadata helpers

Must not own:

- domain approvals
- document parsing
- business-specific validation
- supplier or commercial decisions

Candidate canonical capabilities:

| Capability key | Candidate node type | Display name |
|---|---|---|
| `workflow.trigger.manual` | `lados.workflow.trigger_manual` | Manual Trigger |
| `workflow.trigger.schedule` | `lados.workflow.trigger_schedule` | Schedule Trigger |
| `workflow.control.condition` | `lados.workflow.condition` | Condition |
| `workflow.control.merge` | `lados.workflow.merge` | Merge |
| `workflow.control.parallel` | `lados.workflow.parallel` | Parallel |
| `workflow.control.delay` | `lados.workflow.delay` | Delay |
| `workflow.log.write` | `lados.workflow.write_log` | Write Log |

#### `lados.resource-operations`

Owns:

- Workspace Resource creation
- Workspace Resource read/update
- artifact read/write
- Resource Binding resolution helpers
- generic resource transformation

Must not own:

- document extraction logic
- domain-specific resource validation
- external system sync

Candidate canonical capabilities:

| Capability key | Candidate node type | Display name |
|---|---|---|
| `resource.read` | `lados.resource.read` | Read Resource |
| `resource.create` | `lados.resource.create` | Create Resource |
| `resource.update` | `lados.resource.update` | Update Resource |
| `resource.bind.resolve` | `lados.resource.resolve_binding` | Resolve Binding |
| `artifact.read` | `lados.artifact.read` | Read Artifact |
| `artifact.write` | `lados.artifact.write` | Write Artifact |

#### `lados.human-work`

Owns:

- approval request
- user assignment
- review checkpoint
- decision capture
- human handoff

Must not own:

- certifying claims
- approving commercial entitlement
- substituting statutory or contract-administrator decisions

Candidate canonical capabilities:

| Capability key | Candidate node type | Display name |
|---|---|---|
| `human.approval.request` | `lados.human.request_approval` | Request Approval |
| `human.assignment.assign` | `lados.human.assign_user` | Assign User |
| `human.review.checkpoint` | `lados.human.review_checkpoint` | Review Checkpoint |
| `human.decision.record` | `lados.human.record_decision` | Record Decision |

---

### 4.2 L1 Core Business Domain Packs

| Target pack ID | Display name | Layer | Ownership boundary | Current prototype source |
|---|---|---|---|---|
| `lados.document-intelligence` | Document Intelligence | L1 | file intake, parse, extract, classify, generate documents | `document-pack`, `ai-pack`, QS document nodes |
| `lados.ai-operations` | AI Operations | L1 | generic AI summarization, extraction, classification, comparison, risk detection | `ai-pack` |
| `lados.communication` | Communication | L1 | email, SMS, in-app, notification routing, reminders | `notifications-pack`, `foundation-pack` |
| `lados.task-case` | Task and Case Management | L1 | tasks, cases, checklists, status, reminders | partial `foundation-pack` |
| `lados.commercial-finance` | Commercial Finance | L1 | invoices, payments, purchase orders, retention, certificates, finance approvals | `finance-pack`, some `contractor-pack` |
| `lados.procurement` | Procurement | L1 | suppliers, RFQ, quotation, comparison, award, PO handoff | `procurement-pack` |

#### `lados.document-intelligence`

Owns:

- file upload/intake
- read Excel/CSV/PDF/DOCX
- document classification
- table extraction
- document generation
- document evidence attachment

Must not own:

- QS measurement rules
- procurement decisions
- supplier pricing authority

Recommended Knowledge Packs:

- document type library
- company document control SOP
- evidence rule packs

Candidate template families:

- Upload Document to Structured Resource
- Extract Invoice Fields
- Extract BOQ Table
- Generate Standard Letter
- Attach Evidence to Claim

#### `lados.ai-operations`

Owns:

- generic summarize
- generic extract
- generic classify
- compare texts/records
- detect risk
- generate draft response

Must not own:

- final approval
- professional certification
- statutory/legal conclusion
- hidden domain rules that belong in Knowledge Packs

Rule:

AI nodes are advisory by default and should expose confidence, assumptions, source references, and human-review flags.

#### `lados.communication`

Owns:

- send email
- send SMS
- send in-app message
- send reminder
- route notification by role
- notification templates

Must not own:

- approval decision
- task assignment ownership
- external CRM-specific behavior

#### `lados.task-case`

Owns:

- create task
- update task status
- open/close case
- checklist item tracking
- reminder scheduling through `lados.communication`
- action register updates

Must not own:

- domain-specific claim, RFQ, or defect logic
- human approval gate, which belongs to `lados.human-work`

#### `lados.commercial-finance`

Owns:

- submit invoice
- verify invoice
- approve invoice workflow action
- process payment
- create/approve purchase order finance step
- claim/release retention
- generate payment certificate shell
- update commercial ledger resource

Must not own:

- RFQ or quotation comparison
- BOQ measurement
- progress claim assessment
- contractor logistics invoicing template logic

Recommended Knowledge Packs:

- invoice validation rules
- payment terms SOP
- tax/compliance references
- retention rules
- finance approval matrix

#### `lados.procurement`

Owns:

- supplier prequalification workflow action
- create RFQ
- issue RFQ
- receive quotation
- normalize quotation
- compare quotations
- recommend award shortlist
- create purchase order request
- procurement register update

Must not own:

- finance approval of PO
- supplier catalogue knowledge
- QS rate validation
- contract entitlement

Recommended Knowledge Packs:

- supplier catalogue packs
- procurement SOP
- preferred supplier rules
- material specification catalogue
- quotation comparison rules

---

### 4.3 L2 Professional Domain Packs

| Target pack ID | Display name | Layer | Ownership boundary | Current prototype source |
|---|---|---|---|---|
| `lados.qs-commercial` | QS Commercial | L2 | BOQ, measurement, valuation, cost planning, claims, variations, final accounts | `qs-pack`, `construction-pack`, `finance-pack` |
| `lados.contract-admin` | Contract Administration | L2 | instructions, notices, clauses, submissions, determinations, correspondence control | future/new |
| `lados.construction-operations` | Construction Operations | L2 | site progress, inspections, defects, handover, method/evidence capture | `construction-pack` |
| `lados.asset-fleet` | Asset and Fleet Operations | L2 | vehicle/equipment jobs, trips, maintenance, fuel, utilization | `contractor-pack` |
| `lados.people-payroll` | People and Payroll Operations | L2 | payroll preparation, employee records, expense approval handoff | `contractor-pack` |

#### `lados.qs-commercial`

Owns:

- read and normalize BOQ
- classify trade
- split work packages
- measure quantity
- prepare valuation
- assess progress claim evidence
- prepare variation valuation
- prepare final account reconciliation
- cost plan and budget comparison

Must not own:

- site inspection creation
- invoice payment processing
- supplier quotation issuance
- formal legal entitlement decision

Professional guardrail:

QS nodes produce measurements, valuations, checks, and recommendations. They do not certify payment, approve entitlement, or make legal determinations without human review.

Recommended Knowledge Packs:

- BOQ item library
- QS rate library
- claim evidence rules
- measurement rules
- contract clause reference
- standards reference packs

Candidate canonical capabilities:

| Capability key | Candidate node type | Display name |
|---|---|---|
| `qs.boq.read` | `lados.qs.read_boq` | Read BOQ |
| `qs.boq.normalize` | `lados.qs.normalize_boq` | Normalize BOQ |
| `qs.trade.classify` | `lados.qs.classify_trade` | Classify Trade |
| `qs.package.split` | `lados.qs.split_work_packages` | Split Work Packages |
| `qs.quantity.measure` | `lados.qs.measure_quantity` | Measure Quantity |
| `qs.claim.assess_evidence` | `lados.qs.assess_claim_evidence` | Assess Claim Evidence |
| `qs.variation.value` | `lados.qs.value_variation` | Value Variation |
| `qs.final_account.reconcile` | `lados.qs.reconcile_final_account` | Reconcile Final Account |

#### `lados.contract-admin`

Owns:

- contract instruction register
- notice preparation and tracking
- clause reference lookup
- submission register
- response due-date calculation
- correspondence evidence linking
- claim/variation entitlement review workflow shell

Must not own:

- legal advice
- final contract determination
- QS valuation arithmetic
- document generation primitives

Recommended Knowledge Packs:

- project contract reference pack
- PAM/JKR clause mapping metadata where allowed
- correspondence SOP
- notice requirement checklist

#### `lados.construction-operations`

Owns:

- create project/site operation resource
- create site inspection
- submit inspection report
- log defect
- update progress evidence
- handover checklist
- site diary capture
- method statement evidence routing

Must not own:

- QS valuation
- payment certification
- procurement sourcing

Recommended Knowledge Packs:

- defect classification rules
- inspection checklist packs
- construction standards index
- testing and commissioning checklist packs
- safety/compliance reference packs

#### `lados.asset-fleet`

Owns:

- create job
- dispatch trip
- complete trip
- create maintenance record
- clear maintenance
- upload fuel receipt
- extract fuel data
- vehicle/equipment utilization update

Must not own:

- finance ledger posting
- payroll approval
- supplier procurement

Recommended Knowledge Packs:

- fleet SOP
- maintenance schedule reference
- fuel receipt validation rules
- asset productivity library

#### `lados.people-payroll`

Owns:

- prepare payroll run
- validate timesheet evidence
- approve payroll handoff through `lados.human-work`
- record expense review result
- employee checklist workflows

Must not own:

- statutory payroll advice unless backed by a regulated Knowledge Pack
- payment processing
- HR legal determination

Recommended Knowledge Packs:

- company payroll SOP
- expense policy pack
- timesheet evidence rules

---

### 4.4 L3 Solution Packs

Solution Packs are opinionated business operating systems. They should contain templates, orchestration rules, dashboards, and only solution-specific nodes that cannot live cleanly in lower layers.

| Target pack ID | Display name | Layer | Target users | Main dependency packs |
|---|---|---|---|---|
| `lados.solution.contractor-ops` | Contractor Operations Suite | L3 | contractors, project owners, operations teams | QS Commercial, Construction Operations, Procurement, Commercial Finance, Communication |
| `lados.solution.qs-practice` | QS Practice Suite | L3 | contractor QS teams, consultants, commercial managers | QS Commercial, Contract Admin, Document Intelligence |
| `lados.solution.sme-ops` | SME Operations Suite | L3 | non-construction SMEs | Task and Case, Commercial Finance, Communication, Document Intelligence |

#### `lados.solution.contractor-ops`

Owns:

- full contractor workflow templates
- cross-pack orchestration
- role-based operating views
- recommended default setup for construction contractor operations

Does not own:

- canonical invoice, RFQ, BOQ, claim, or defect nodes
- supplier knowledge
- rate libraries

First template families:

| Template family | Required packs | Recommended Knowledge Packs |
|---|---|---|
| Submit Invoice to Approval | Commercial Finance, Human Work, Communication, Resource Operations | invoice validation rules, approval SOP |
| Progress Claim Evidence Check | QS Commercial, Construction Operations, Document Intelligence, Human Work | claim evidence rules, construction standards index |
| RFQ to Quotation Comparison | Procurement, Document Intelligence, Commercial Finance, Human Work | supplier catalogues, procurement SOP |
| Defect Report to Notification | Construction Operations, Communication, Task and Case | defect classification rules |
| Site Diary to Claim Evidence | Construction Operations, QS Commercial, Document Intelligence | claim evidence rules, site diary SOP |

#### `lados.solution.qs-practice`

Owns:

- QS practice workflow templates
- BOQ/claim/variation/final-account playbooks
- professional review gates
- QS evidence dashboards

First template families:

| Template family | Required packs | Recommended Knowledge Packs |
|---|---|---|
| BOQ Upload to Cost Summary | QS Commercial, Document Intelligence, AI Operations | BOQ item library, QS rate library |
| Variation Notice to Valuation | QS Commercial, Contract Admin, Document Intelligence | contract clause reference, variation evidence rules |
| Monthly Progress Claim Review | QS Commercial, Construction Operations, Human Work | claim evidence rules |
| Final Account Reconciliation | QS Commercial, Commercial Finance, Contract Admin | contract clause reference, payment certificate history |

#### `lados.solution.sme-ops`

Owns:

- general business workflow templates outside construction
- invoice/task/document approval patterns
- operational SOP templates

First template families:

| Template family | Required packs | Recommended Knowledge Packs |
|---|---|---|
| Vendor Invoice Approval | Commercial Finance, Human Work, Communication | approval SOP |
| Document Review and Signoff | Document Intelligence, Task and Case, Human Work | document control SOP |
| Customer Case Follow-up | Task and Case, Communication | customer service SOP |

---

### 4.5 L4 Vendor and Integration Packs

Vendor packs are optional. They should never own generic business logic.

| Target pack ID pattern | Display name pattern | Owns | Must not own |
|---|---|---|---|
| `lados.integration.accounting.<vendor>` | Accounting Vendor Connector | sync invoices, payments, contacts, accounts | invoice approval rules |
| `lados.integration.storage.<vendor>` | Storage Connector | upload/download/list files | document extraction |
| `lados.integration.messaging.<vendor>` | Messaging Connector | provider-specific email/SMS/WhatsApp send | notification routing logic |
| `lados.integration.erp.<vendor>` | ERP Connector | ERP record sync and mapping | procurement policy |
| `lados.integration.supplier.<vendor>` | Supplier Connector | supplier-specific catalogue/order/RFQ API | supplier marketplace rules |

Examples:

- `lados.integration.accounting.xero`
- `lados.integration.accounting.quickbooks`
- `lados.integration.storage.sharepoint`
- `lados.integration.messaging.whatsapp`
- `lados.integration.erp.sap`

---

### 4.6 L5 Template Packs

Template Packs package workflow playbooks without creating new canonical nodes unless absolutely necessary.

| Target pack ID | Display name | Purpose |
|---|---|---|
| `lados.template.invoice-approval` | Invoice Approval Templates | invoice intake, validation, approval, payment handoff |
| `lados.template.procurement-rfq` | Procurement RFQ Templates | RFQ issue, quotation comparison, award recommendation |
| `lados.template.progress-claim` | Progress Claim Templates | claim evidence, QS review, human approval gates |
| `lados.template.defect-management` | Defect Management Templates | defect report, assignment, reminder, closeout |
| `lados.template.cipaa-preparation` | CIPAA Preparation Templates | claim evidence register, notice chronology, document bundle prep |

Template Pack rule:

> If a template pack needs a new action, first check whether that action belongs in an L0, L1, or L2 Capability Pack.

---

## 5. Current Prototype Pack Mapping

| Current pack/folder | Target decision | Target destination |
|---|---|---|
| `core-pack` | Split and rename | `lados.workflow-foundation`, `lados.resource-operations`, `lados.human-work` |
| `foundation-pack` | Split and merge | `lados.human-work`, `lados.task-case`, `lados.communication` |
| `document-pack` | Rename and expand | `lados.document-intelligence` |
| `ai-pack` | Rename and govern | `lados.ai-operations` |
| `notifications-pack` | Rename and merge related foundation notification nodes | `lados.communication` |
| `finance-pack` | Rename and tighten boundary | `lados.commercial-finance` |
| `procurement-pack` | Rename and expand | `lados.procurement` |
| `qs-pack` | Rename and expand professionally | `lados.qs-commercial` |
| `construction-pack` | Split | `lados.construction-operations`, some nodes to `lados.qs-commercial` |
| `contractor-pack` | Convert into solution plus domain splits | `lados.solution.contractor-ops`, `lados.asset-fleet`, `lados.people-payroll`, lower-layer dependencies |

This mapping is directional only. Each node still needs a keep/rename/merge/split/deprecate/remove audit.

---

## 6. First Official Bundle Set

The first professional bundle set should be small enough to verify, but broad enough to show the Lados platform story.

### Bundle 1: Platform Foundation Bundle

Contains:

- `lados.workflow-foundation`
- `lados.resource-operations`
- `lados.human-work`
- `lados.communication`

Purpose:

- make workflows runnable
- keep approvals and notifications consistent
- keep Resource Binding and artifact patterns stable

### Bundle 2: Business Operations Bundle

Contains:

- `lados.document-intelligence`
- `lados.ai-operations`
- `lados.task-case`
- `lados.commercial-finance`
- `lados.procurement`

Purpose:

- support generic business workflows across many industries
- demonstrate invoice, RFQ, document, task, and approval flows

### Bundle 3: Contractor and QS Bundle

Contains:

- `lados.qs-commercial`
- `lados.contract-admin`
- `lados.construction-operations`
- `lados.asset-fleet`
- `lados.people-payroll`
- `lados.solution.contractor-ops`
- `lados.solution.qs-practice`

Purpose:

- showcase Lados' construction/QS strength
- provide professional contractor workflow demos
- use Knowledge Packs for rates, evidence, standards, SOPs, and supplier catalogues

### Bundle 4: Marketplace Starter Bundle

Contains:

- `lados.template.invoice-approval`
- `lados.template.procurement-rfq`
- `lados.template.progress-claim`
- `lados.template.defect-management`
- selected verified external `.ladosPack` examples

Purpose:

- demonstrate Capability Pack marketplace behavior
- keep uploaded runtime code disabled until sandboxed runtime is implemented
- prove manifest-only pack install and template discovery

---

## 7. Capability Ownership Matrix

| Business capability | Owner pack | Dependent packs may use it | Notes |
|---|---|---|---|
| Workflow branch/merge/delay | Workflow Foundation | all packs | no duplication |
| Workspace Resource create/update | Resource Operations | all packs | domain packs should declare resource type |
| Approval gate | Human Work | finance, procurement, QS, construction | domain packs can configure approval reason |
| Send notification | Communication | all packs | provider-specific send belongs in integration pack |
| Read Excel/PDF/DOCX | Document Intelligence | QS, finance, procurement | domain packs consume structured result |
| Generic AI extraction/classification | AI Operations | document, QS, finance | advisory; must expose confidence |
| Submit invoice | Commercial Finance | contractor solution, SME solution | not owned by contractor pack |
| Create RFQ | Procurement | contractor solution, QS practice | not owned by finance |
| Compare quotations | Procurement | contractor solution | uses Supplier Knowledge Packs |
| Read/normalize BOQ | QS Commercial | QS practice, contractor solution | document pack only reads file |
| Assess claim evidence | QS Commercial | contractor solution | uses Evidence Rule Knowledge Packs |
| Log defect | Construction Operations | contractor solution | can create task/notification through dependencies |
| Site inspection | Construction Operations | QS claim templates | evidence can feed QS claim review |
| Contract notice tracking | Contract Administration | QS practice, contractor solution | not legal advice |
| Trip dispatch | Asset and Fleet Operations | contractor solution | not generic workflow |
| Payroll run preparation | People and Payroll Operations | contractor solution | approval uses Human Work |

---

## 8. Template Ownership Matrix

| Template | Owner pack | Required packs | Required Knowledge Packs | Maturity target |
|---|---|---|---|---|
| Submit Invoice to Approval | `lados.template.invoice-approval` | Commercial Finance, Human Work, Communication, Resource Operations | invoice validation rules, approval SOP | production-ready |
| RFQ to Quotation Comparison | `lados.template.procurement-rfq` | Procurement, Document Intelligence, Human Work, Communication | supplier catalogues, procurement SOP | production-ready |
| Progress Claim Evidence Check | `lados.template.progress-claim` | QS Commercial, Construction Operations, Document Intelligence, Human Work | claim evidence rules, standards index | production-ready with human review |
| BOQ Upload to Cost Summary | `lados.solution.qs-practice` | QS Commercial, Document Intelligence, AI Operations | BOQ item library, QS rate library | demo-to-production |
| Defect Report to Notification | `lados.template.defect-management` | Construction Operations, Task and Case, Communication | defect classification rules | production-ready |
| Site Diary to Claim Evidence | `lados.solution.contractor-ops` | Construction Operations, QS Commercial, Document Intelligence | site diary SOP, claim evidence rules | demo-to-production |
| Variation Notice to Valuation | `lados.solution.qs-practice` | Contract Administration, QS Commercial, Document Intelligence | contract clause reference, variation evidence rules | advisory |
| Final Account Reconciliation | `lados.solution.qs-practice` | QS Commercial, Commercial Finance, Contract Administration | contract reference, payment history | advisory |
| Fleet Job to Invoice | `lados.solution.contractor-ops` | Asset and Fleet, Commercial Finance, Communication | fleet SOP, invoice rules | demo-to-production |
| Payroll Prepare to Approval | `lados.solution.contractor-ops` | People and Payroll, Human Work, Commercial Finance | payroll SOP, expense policy | advisory |

---

## 9. Knowledge Pack Dependency Map

Capability Packs should declare Knowledge Pack requirements as recommendations unless the workflow cannot operate safely without them.

| Capability Pack | Required Knowledge Packs | Recommended Knowledge Packs |
|---|---|---|
| Workflow Foundation | none | organization workflow SOP |
| Resource Operations | none | resource naming SOP |
| Human Work | approval matrix for production templates | company approval SOP |
| Document Intelligence | none | document type library, document control SOP |
| AI Operations | none | prompt policy, AI review policy |
| Communication | none | communication templates, escalation SOP |
| Task and Case | none | case management SOP |
| Commercial Finance | invoice validation rules for invoice templates | payment terms, retention rules, tax references |
| Procurement | procurement SOP for award templates | supplier catalogue, quotation comparison rules |
| QS Commercial | claim evidence rules for claim templates | BOQ library, QS rate library, measurement rules |
| Contract Administration | project contract reference for notice templates | clause reference pack, correspondence SOP |
| Construction Operations | inspection checklist for inspection templates | standards index, defect classification rules |
| Asset and Fleet | none | fleet SOP, maintenance schedule, fuel receipt rules |
| People and Payroll | payroll SOP for payroll templates | expense policy, timesheet evidence rules |

---

## 10. Naming Standard

Target pack IDs:

```text
lados.<capability-area>
lados.solution.<solution-name>
lados.integration.<vendor-category>.<vendor-name>
lados.template.<template-family>
```

Target node types:

```text
lados.<short-pack>.<verb>_<object>
```

Examples:

| Target node type | Display name |
|---|---|
| `lados.finance.submit_invoice` | Submit Invoice |
| `lados.procurement.create_rfq` | Create RFQ |
| `lados.qs.assess_claim_evidence` | Assess Claim Evidence |
| `lados.construction.log_defect` | Log Defect |
| `lados.human.request_approval` | Request Approval |

Display-name rule:

> Use professional, short names on the canvas. Put detailed explanation, assumptions, and field descriptions in the inspector.

---

## 11. Acceptance Gate for a Target Pack

Before a target Capability Pack can become official:

- [ ] Pack has one clear owner boundary.
- [ ] Pack declares layer.
- [ ] Pack declares dependencies.
- [ ] Pack declares canonical capabilities.
- [ ] Pack declares node index metadata.
- [ ] Pack declares template ownership or confirms it owns no templates.
- [ ] Pack declares required/recommended Knowledge Packs.
- [ ] Pack declares resource types it consumes or writes.
- [ ] Pack declares events it emits or listens to.
- [ ] Pack has no duplicated canonical capability.
- [ ] High-input nodes use Workspace Resources, Resource Bindings, grouped config, or Knowledge Pack references instead of canvas clutter.
- [ ] AI-related actions are marked advisory where applicable.
- [ ] Human approval boundaries are explicit.
- [ ] Current prototype nodes mapped to this pack are classified.
- [ ] README, examples, tests, and browser verification path are defined.

---

## 12. Immediate Next Work

After accepting this draft catalogue:

1. Create the first canonical capability registry table.
2. Create the target workflow template index.
3. Audit current prototype nodes against this catalogue.
4. Classify each node as keep, rename, merge, split, deprecate, or remove.
5. Decide the first professional bundle set for implementation.
6. Draft manifest examples for the first target packs.
7. Update Marketplace UI planning from prototype names to target pack names.

---

## 13. Open Decisions

| Decision | Current recommendation |
|---|---|
| Should `lados.human-work` and `lados.task-case` be separate? | Yes. Approval/decision gates are security-sensitive; tasks/cases are operational records. |
| Should `lados.contract-admin` be separate from QS? | Yes. QS uses contract references, but contract administration has its own notice/register/correspondence boundary. |
| Should `lados.asset-fleet` stay under contractor solution? | No. Asset/fleet can serve logistics, plant hire, maintenance, and non-construction operations. |
| Should current `contractor-pack` remain official? | Not as-is. Convert it into `lados.solution.contractor-ops` plus lower-layer domain packs. |
| Should Capability Packs include Knowledge Pack data? | No. They should declare required/recommended Knowledge Packs and consume item references. |
| Should vendor packs contain business policy? | No. Vendor packs connect systems; policy belongs in domain packs or Knowledge Packs. |

---

## 14. Draft Catalogue Summary

The target official Capability Pack catalogue is:

```text
L0 Platform Foundation
  lados.workflow-foundation
  lados.resource-operations
  lados.human-work

L1 Core Business Domains
  lados.document-intelligence
  lados.ai-operations
  lados.communication
  lados.task-case
  lados.commercial-finance
  lados.procurement

L2 Professional Domains
  lados.qs-commercial
  lados.contract-admin
  lados.construction-operations
  lados.asset-fleet
  lados.people-payroll

L3 Solution Packs
  lados.solution.contractor-ops
  lados.solution.qs-practice
  lados.solution.sme-ops

L4 Vendor/Integration Packs
  lados.integration.accounting.*
  lados.integration.storage.*
  lados.integration.messaging.*
  lados.integration.erp.*
  lados.integration.supplier.*

L5 Template Packs
  lados.template.invoice-approval
  lados.template.procurement-rfq
  lados.template.progress-claim
  lados.template.defect-management
  lados.template.cipaa-preparation
```

This catalogue gives Lados a professional base for hundreds or thousands of future nodes without letting prototype folders, test nodes, or overlapping business names become permanent architecture.
