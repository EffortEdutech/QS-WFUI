# LEOS / JKR — Deferred Blueprint
**Version:** 1.0  
**Date:** 2026-06-24  
**Phase:** Phase 13 — LEOS/JKR Layer Preparation  
**Status:** LOCKED — no code changes required to LCE V1 engine  

> This document is a design contract, not a build plan. It confirms that LCE V1 can represent everything LEOS needs without structural changes. When the Phase 13 gate is reached (Contractor Edition in production, at least one JKR/CIDB stakeholder confirmed), build begins from this document.

---

## 1. What This Document Confirms

Phase 13 answers five questions:

1. Can `lados_resources` represent all LEOS resource types? **Yes — confirmed.**
2. Can `lados_state_machines` represent all LEOS lifecycles? **Yes — confirmed.**
3. Does the pack system accommodate 300+ workflows without engine changes? **Yes — confirmed.**
4. Is multi-tier org hierarchy (JKR federal → state → district) achievable without schema surgery? **Yes — one column addition, no engine changes.**
5. Does `qs-pack` need to be rebuilt for LEOS? **No — it becomes a dependency, not a replacement.**

No engine schema changes are required. All LEOS resource types, state machines, and packs fit the LCE V1 model as designed.

---

## 2. LEOS Resource Type Catalogue

### 2.1 Confirmed Mapping

Every LEOS resource type stores in `lados_resources` using the existing schema:

```
lados_resources
  id              uuid
  organisation_id uuid       ← LEOS uses same multi-tenant column
  project_id      uuid       ← optional: some LEOS resources are programme-level
  type            text       ← resource type string (new values — no schema change)
  state           text       ← current lifecycle state
  data            jsonb      ← all type-specific fields live here
  created_by      uuid
  created_at      timestamptz
  updated_at      timestamptz
```

The `type` column is a free-text string with no DB constraint — adding new LEOS types requires zero migration.

### 2.2 Programme Layer

| Resource Type | `type` value | Key `data` fields | Notes |
|---|---|---|---|
| Programme | `leos.programme` | name, code, budget, start_date, end_date, sponsoring_agency | Top-level JKR initiative (e.g. Pan Borneo Highway) |
| Contract | `leos.contract` | contract_no, contractor_id, contract_sum, LOA_date, programme_id | Formal LOA/SPK |
| Package | `leos.package` | package_no, description, contract_id, budget_allocation | Scope subdivision |
| Milestone | `leos.milestone` | label, target_date, actual_date, contract_id, criteria | Key delivery events |
| Variation Order | `leos.variation_order` | vo_no, type, description, amount, contract_id, reason | Scope/price changes |

### 2.3 Site Layer

| Resource Type | `type` value | Key `data` fields | Notes |
|---|---|---|---|
| Site Location | `leos.site_location` | name, gps_boundary, contract_id | GPS-bounded zone |
| Site Diary | `leos.site_diary` | date, weather, workforce_count, activities, supervisor_id, site_id | Daily record |
| NCR | `leos.ncr` | ncr_no, description, raised_by, assigned_to, site_id, photos | Non-conformance report |
| RFI | `leos.rfi` | rfi_no, question, raised_by, routed_to, contract_id | Request for information |
| Submittal | `leos.submittal` | submittal_no, type, description, submitted_by, contract_id | Material/method submission |
| Inspection Record | `leos.inspection` | date, inspector_id, site_id, outcome, defects, photos | Site inspection |

### 2.4 Financial Layer

| Resource Type | `type` value | Key `data` fields | Notes |
|---|---|---|---|
| BOQ | `leos.boq` | contract_id, items (jsonb array), revision_no | Bill of Quantities |
| Progress Claim | `leos.progress_claim` | claim_no, period, contractor_id, contract_id, items, total | Monthly valuation |
| Interim Certificate | `leos.interim_certificate` | cert_no, claim_id, certified_amount, qs_id, issued_date | QS-certified payment |
| Final Certificate | `leos.final_certificate` | cert_no, contract_id, final_sum, qs_id, director_id | Final settlement |
| Retention Release | `leos.retention_release` | contract_id, amount, release_type (half/full), authorised_by | |
| Payment Certificate | `leos.payment_certificate` | cert_no, interim_cert_id, amount, finance_officer_id | Payment authorisation |
| Variation Account | `leos.variation_account` | contract_id, total_vos, approved_sum | Consolidated VO account |

### 2.5 Compliance Layer

| Resource Type | `type` value | Key `data` fields | Notes |
|---|---|---|---|
| CIDB Worker Record | `leos.cidb_worker` | name, ic_no, cidb_no, category, expiry, photo_url, site_id | Green card validation |
| HIRARC | `leos.hirarc` | activity, hazards (jsonb), risk_level, controls, reviewed_by | Risk assessment |
| Accident Record | `leos.accident` | date, description, injured_parties, severity, DOSH_ref, site_id | |
| DLP Defect | `leos.dlp_defect` | defect_no, description, location, contract_id, deadline | Defects Liability Period |

### 2.6 Closure Layer

| Resource Type | `type` value | Key `data` fields | Notes |
|---|---|---|---|
| CPC | `leos.cpc` | contract_id, issued_date, certifying_officer, cpc_no | Certificate of Practical Completion |
| Final Account | `leos.final_account` | contract_id, original_sum, vo_total, final_sum, qs_id | Final financial settlement |
| Archive Record | `leos.archive` | contract_id, documents (jsonb), archived_by, archive_date | Long-term retention |

### 2.7 People Layer

| Resource Type | `type` value | Key `data` fields | Notes |
|---|---|---|---|
| Consultant | `leos.consultant` | name, firm, role, contract_id, accreditation | External consultants |
| Subcontractor | `leos.subcontractor` | name, reg_no, grade, specialisation, contract_id | |
| Inspector | `leos.inspector` | name, cidb_ref, site_id, assigned_by | |

**Total LEOS resource types: 26**  
**Engine schema changes required: 0**  
**Confirmation: all 26 types fit `lados_resources.type` as new string values with type-specific fields in `data` jsonb.**

---

## 3. LEOS State Machine Catalogue

### 3.1 Confirmed Mapping

All LEOS lifecycles store in `lados_state_machines`:

```
lados_state_machines
  id          uuid
  name        text          ← e.g. 'leos.contract'
  states      jsonb         ← array of state definitions
  transitions jsonb         ← allowed transitions with guards
  created_at  timestamptz
```

No schema changes. New state machines are inserted as rows.

### 3.2 Core Lifecycles

**Contract**
```
Draft → Awarded → Active → Suspended → Completed → Archived
                         ↑___________↓ (Suspend ↔ Active)
```
Terminal states: `Completed`, `Archived`  
Key guards: `Active → Completed` requires CPC to exist and be in state `issued`

---

**Progress Claim**
```
Draft → Submitted → Under Review → Certified → Payment Authorised → Paid
                                ↘ Disputed → Under Review (loop)
```
Terminal states: `Paid`, `Disputed` (if unresolved after deadline)  
Key guards: `Under Review → Certified` requires QS role; `Certified → Payment Authorised` requires Finance Officer role

---

**Interim / Final Certificate**
```
Draft → Issued → Acknowledged → Paid
      ↘ Void (admin cancel)
```
Key guards: `Draft → Issued` requires QS role with `qs.certify_interim` permission

---

**NCR**
```
Raised → Assigned → In Progress → Resolved → Closed
                               ↘ Escalated → Raised (re-open)
```
Terminal states: `Closed`  
Key guards: `Resolved → Closed` requires inspector sign-off

---

**RFI**
```
Submitted → Acknowledged → Under Review → Responded → Closed
```
Terminal states: `Closed`

---

**Submittal**
```
Submitted → Under Review → Approved → Superseded
                        ↘ Rejected → Resubmitted → Under Review (loop)
```

---

**Site Diary**
```
Draft → Submitted → Reviewed → Archived
```
Terminal state: `Archived` (immutable after PM review)

---

**Variation Order**
```
Proposed → Under Evaluation → Approved → Instructed → Completed
                           ↘ Rejected (terminal)
```
Key guards: `Under Evaluation → Approved` requires Director role

---

**CPC**
```
Draft → Issued → Acknowledged
```
Terminal state: `Acknowledged` (triggers DLP clock)

---

**CIDB Worker Record**
```
Pending Verification → Active → Expired → Renewed
                              ↘ Suspended → Reinstated
```

---

**DLP Defect**
```
Raised → Assigned → Rectified → Inspected → Cleared
                             ↘ Rejected → Assigned (loop)
```
Terminal state: `Cleared`

---

**Final Account**
```
Draft → Under Audit → Agreed → Approved → Closed
                   ↘ Disputed → Under Audit (loop)
```

**Total LEOS state machines: 12**  
**Engine schema changes required: 0**  
**Confirmation: all 12 machines fit `lados_state_machines` as new rows, using the existing states/transitions jsonb structure.**

---

## 4. LEOS Pack Architecture

### 4.1 Pack Dependency Tree

```
lados (core engine)
├── core-pack              (resource CRUD, events, approvals, artifacts)
├── foundation-pack        (notifications, approvals, user assignments)
├── contractor-pack        (jobs, trips, fuel receipts, invoices)
│   └── qs-pack            (BOQ, RFQ, classifications) ← existing, unchanged
│       └── leos-procurement-pack    (tender, contract award, VO management)
│           ├── leos-core-pack       (programme, org hierarchy, milestones)
│           ├── leos-site-pack       (NCR, RFI, submittal, site diary)
│           ├── leos-finance-pack    (claims, certificates, payment, retention)
│           ├── leos-closure-pack    (CPC, DLP, final account, archive)
│           └── leos-compliance-pack (CIDB, HIRARC, accident records)
```

### 4.2 Pack Specifications

| Pack | Namespace | Estimated Nodes | Estimated Workflows | Depends On |
|---|---|---|---|---|
| `leos-core-pack` | `leos.core` | 25–35 | 15–20 | core-pack, foundation-pack |
| `leos-procurement-pack` | `leos.procurement` | 40–60 | 50–70 | leos-core-pack, qs-pack |
| `leos-site-pack` | `leos.site` | 30–40 | 40–60 | leos-core-pack |
| `leos-finance-pack` | `leos.finance` | 35–50 | 60–80 | leos-procurement-pack |
| `leos-closure-pack` | `leos.closure` | 20–30 | 25–35 | leos-finance-pack |
| `leos-compliance-pack` | `leos.compliance` | 20–30 | 20–30 | leos-core-pack |
| **TOTAL** | | **170–245** | **210–295** | |

With contractor-pack and qs-pack included: **300–400 total workflows across full LEOS stack.**

### 4.3 Pack Contract Confirmation

Every LEOS pack will implement the same `PackManifest + resolveNode()` contract as `contractor-pack`:

```typescript
// Same interface — no SDK changes needed
export const manifest: PackManifest = {
  id:           'leos.site-pack',
  name:         'LEOS Site Pack',
  version:      '1.0.0',
  description:  'NCR, RFI, submittal, and site diary management',
  dependencies: ['leos.core-pack'],
  nodes:        [...],
  resources:    [...],
  stateMachines:[...],
  workflows:    [...],
};

export function resolveNode(nodeType: string): NodeHandler | null { ... }
```

**Pack SDK changes required: 0**  
**`buildRealNodeResolver()` changes required: 0** (add new pack calls to the chain)

---

## 5. QS Pack Boundary Validation

### 5.1 What qs-pack Does Today

`qs-pack` (existing, built, deployed) provides:
- `qs.classify_item` — AI-assisted BOQ line item classification
- `qs.generate_rfq` — RFQ document generation
- `qs.review_quotation` — Quotation comparison and analysis
- Procurement workflow templates

### 5.2 What leos-procurement-pack Will Add

`leos-procurement-pack` will add:
- `leos.procurement.create_tender` — Formal open/restricted tender process
- `leos.procurement.evaluate_tender` — Tender evaluation committee workflow
- `leos.procurement.issue_loa` — Letter of Award generation and signing
- `leos.procurement.create_contract` — Contract document management
- `leos.procurement.raise_vo` — Variation Order initiation and approval

### 5.3 Boundary Rule — No Overlap

| Capability | Pack | Justification |
|---|---|---|
| BOQ line item AI classification | `qs-pack` | QS-level tool, reused in LEOS |
| RFQ generation and distribution | `qs-pack` | Direct supplier quotes, SME context |
| Formal tender (open/restricted) | `leos-procurement-pack` | Government procurement regulation |
| LOA / SPK contract documents | `leos-procurement-pack` | LEOS-specific legal documents |
| Variation Order lifecycle | `leos-procurement-pack` | Requires Director approval chain |

**Ruling: `qs-pack` is a dependency of `leos-procurement-pack`, not replaced by it.**  
`leos-procurement-pack.json` manifest: `"dependencies": ["qs-pack"]`

**qs-pack rebuild required: No.**  
**qs-pack node changes required: No.**  
**qs-pack becomes a reused component in the LEOS stack as-is.**

---

## 6. Multi-Tier Organisation Hierarchy

### 6.1 JKR Org Structure

```
Federal Ministry (KKR)
  └── JKR Headquarters (Federal)
        └── JKR Negeri (State — 14 states + territories)
              └── JKR Daerah (District — 80+ districts)
                    └── Project Team (per contract)
```

### 6.2 Current Model

The current `organisations` table is flat — no parent relationship. Each organisation is independent with its own members and projects.

### 6.3 Required Extension (Deferred — Not Phase 13)

One column addition, no engine restructure:

```sql
-- Migration: add parent_org_id to organisations
ALTER TABLE organisations
  ADD COLUMN parent_org_id uuid REFERENCES organisations(id);

CREATE INDEX idx_organisations_parent ON organisations(parent_org_id);
```

### 6.4 Permission Inheritance Design

SecurityEngine extends to support hierarchy traversal:

```
Rule: A user with role X in org A inherits read access to all child orgs of A.
      Write/manage permissions do NOT propagate down by default.
      Explicit grants override inherited read.
```

Example: A JKR Federal PM can view all State and District projects. A State QS can only manage their own state's contracts.

### 6.5 Confirmation

- No `SecurityEngineService` rewrite needed — hierarchy check is additive
- No `lados_resources` schema changes — `organisation_id` already exists
- `buildRealNodeResolver()` unchanged — nodes already receive `orgId` in context
- This is a **Phase 15+ item** — not required for Contractor Edition or initial LEOS build

**Blockers to multi-tier hierarchy: 0**  
**Schema surgery required: 0 (one column addition when needed)**

---

## 7. Items That DO Require Engine Changes

After analysis, the following items require changes that are **not part of LCE V1** and must be planned separately:

| Item | Scope | Why Deferred |
|---|---|---|
| `parent_org_id` column on `organisations` | Single migration | Needed only when LEOS org hierarchy is activated |
| `lados_events` volume at LEOS scale | Redis Streams or message broker | Current in-process EventBus sufficient for Contractor Edition; at 10k+ events/day a broker is needed |
| `lados_resources` partitioning | Supabase table partitioning by `organisation_id` | Only relevant at 1M+ resource rows |
| Court-admissible audit record sealing | Cryptographic hash chain on `audit_log` | Phase 15+ governance requirement |
| BIM/IFC integration | New pack + file parsing | Not part of initial LEOS scope |
| GIS geofencing | PostGIS extension + new pack | Required for site boundary enforcement |

**LCE V1 engine blockers: 0**  
These are evolution items, not showstoppers. LEOS Phase 1 (core + procurement + finance) can be built entirely on LCE V1 without touching the engine.

---

## 8. Scale Validation

### 8.1 Pack Count vs Pack Loader Performance

`PackInstallerService` currently loads all packs synchronously on startup. At full LEOS scale:

| Metric | Contractor Edition | LEOS Full Stack |
|---|---|---|
| Packs | 5 | 11 |
| Total nodes | ~150 | ~400 |
| Startup sync time | < 500ms | < 2s (estimated) |

Verdict: **No performance concern.** Pack loader is O(n) on node count, not on workflow count. 300+ workflows are templates stored in the DB — they don't affect startup.

### 8.2 `buildRealNodeResolver()` at 400 Nodes

`buildRealNodeResolver()` is a chain of `if / else if` checks per pack. At 400 nodes this remains O(1) per resolution (string match). No refactor needed.

### 8.3 State Engine at 12+ State Machines

`StateEngineService` loads state machines from DB on each transition call (no in-memory cache). At LEOS scale with 100s of concurrent transitions, caching becomes worthwhile. Deferred — not a Phase 13 item.

---

## 9. Estimated Build Programme (Not Phase 13 — Reference Only)

When LEOS build begins (after Phase 13 gate):

| Phase | Content | Estimate |
|---|---|---|
| LEOS Phase 1 | leos-core-pack: programme, contract, milestone | 2–3 sessions |
| LEOS Phase 2 | leos-procurement-pack: tender, LOA, VO | 3–4 sessions |
| LEOS Phase 3 | leos-finance-pack: claims, certificates, payment | 3–4 sessions |
| LEOS Phase 4 | leos-site-pack: NCR, RFI, submittal, site diary | 2–3 sessions |
| LEOS Phase 5 | leos-compliance-pack: CIDB, HIRARC, accidents | 2 sessions |
| LEOS Phase 6 | leos-closure-pack: CPC, DLP, final account | 2 sessions |
| LEOS Phase 7 | Multi-tier org hierarchy + SecurityEngine extension | 1–2 sessions |
| LEOS Phase 8 | Programme dashboard + JKR integration connectors | 3–4 sessions |
| **Total** | | **18–26 sessions** |

---

## 10. Phase Gate Checklist

LEOS development begins only when all of the following are true:

- [ ] Contractor Edition is live with at least one paying contractor
- [ ] Phase 14 (Registry Maturity) is complete — pack install/upgrade works without a code deploy
- [ ] At least one JKR/CIDB/CITP stakeholder has confirmed initial requirements in writing
- [ ] A dedicated LEOS project budget is approved
- [ ] A QS consultant is engaged to validate BOQ and certificate workflows against JKR standards

---

## 11. Compatibility Statement

The following LCE V1 design decisions made today are confirmed as LEOS-compatible:

| Decision | LEOS Compatibility |
|---|---|
| `lados_resources` is multi-tenant by `organisation_id` | ✅ LEOS multi-org scoping works as-is |
| `type` column is free text with no DB constraint | ✅ New LEOS types require zero migration |
| `data` column is `jsonb` | ✅ All 26 LEOS type-specific fields fit here |
| State machines are declared in manifests as rows | ✅ 12 new LEOS machines = 12 new rows, no schema change |
| Packs follow `PackManifest + resolveNode()` contract | ✅ All 6 LEOS packs will implement this unchanged |
| `buildRealNodeResolver()` is a pack chain | ✅ Extend by adding LEOS pack calls — no rewrite |
| `qs-pack` exists and is deployed | ✅ Becomes a dependency of `leos-procurement-pack` |
| AI cannot approve or certify | ✅ Rule is permanent — reinforced in all LEOS finance nodes |
| Audit log is append-only | ✅ LEOS certificate audit entries are court-admissible design targets |
| `published_version_id` locks execution to snapshot | ✅ LEOS cannot allow live-draft execution at scale |
| Async queue (Phase 12) is in place | ✅ LEOS workflow volume requires async execution |

---

## 12. Acceptance Checklist

- [x] All LEOS resource types confirmed as representable in `lados_resources` (26 types, 0 schema changes)
- [x] All LEOS state machines confirmed as representable in `lados_state_machines` (12 machines, 0 schema changes)
- [x] LEOS pack architecture defined — 6 packs, ~230 nodes, ~300 workflows
- [x] `qs-pack` boundary validated — dependency, not replacement, no rebuild needed
- [x] Multi-tier org hierarchy path confirmed — one column addition, no engine surgery
- [x] Items requiring engine changes identified — 0 blockers, all are evolution items
- [x] Phase gate checklist defined
- [x] Phase 13 has zero code commits ✅

---

*Phase 13 complete. Next: Phase 14 — Registry: Operator-Grade Pack Management.*  
*Related: [50_LEOS.md](../Lados/50_LEOS.md) · [LCE Blueprint](../LCE_V1/Lados_Core_Engine_V1_Implementation_Blueprint.md)*
