# Lados V4 Sprint Plan: P18 Polish to P20 Productization

**Document ID:** LADOS-V4-SPRINT-P18P-P20  
**Status:** Active planning document  
**Date:** 2026-07-02  
**Scope:** Phase 18 Polish, Phase 19 Data Pack Engine, Phase 20 Marketplace Knowledge Catalogue Documentation, Phase 20B Professional Lados Pack Bundles  
**Purpose:** Move Lados from V4 platform-complete into a polished, testable, professional product platform.

---

## Executive Summary

The V4 engine layers are now mostly present: workflow canvas, resource bindings, Explorer, state engine, execution queue, pack registry, and marketplace infrastructure. The next work is not another architecture foundation phase. It is productization.

This sprint turns Lados into a platform that can be demonstrated and tested using professional-grade packs, clean node designs, Data Packs, real workflows, and repeatable verification scripts.

The key correction is that **Data Packs are not a small Marketplace placeholder**. Data Packs are a major Lados product surface. They carry curated domain knowledge, rate references, standards, templates, evidence rules, and structured datasets used by nodes and workflows.

---

## Product Principles

1. Lados must remain pack-based: capabilities arrive through Pack Bundles and Data Packs.
2. Workspace Resources, Resource Bindings, Pack Bundles, and Data Packs must stay clearly named and distinct.
3. Official Lados packs must look and behave professionally before external marketplace claims are made.
4. Uploaded executor code must not run dynamically until a sandboxed verifier/runtime is built.
5. QS and contractor workflows must keep human approval guardrails for certification, entitlement, valuation, and legal decisions.
6. Every data item that influences commercial output must carry source, version, date, region, and applicability metadata.

---

## Naming Model

| Term | Meaning | Example | Storage direction |
|---|---|---|---|
| Workspace Resource | A real operational/business record in an organization | Invoice, BOQ, Claim, Vehicle, Defect | `lados_resources` |
| Resource Binding | A workflow mapping from node field to Workspace Resource | `invoice_id` bound to Invoice resource | `resource_bindings` |
| Capability Pack | A bundle of executable node capabilities and manifests | `lados.finance-pack` | `packs`, `registered_nodes`, registry bundle |
| Data Pack | A versioned dataset or knowledge pack consumed by nodes/workflows | MY Schedule of Rates 2026, Claim Evidence Rules | new Phase 19 tables |
| Lados Pack Bundle | The `.ladosPack` distribution unit for capability packs | `lados-finance-1.0.0.ladosPack` | `registry_packs`, storage |

UI copy must use these names consistently.

---

## Phase Overview

| Phase | Title | Goal | Status |
|---|---|---|---|
| 18P | External Marketplace Polish | Finish and verify Marketplace, restore Data Packs surface, clean registry UX | Complete |
| 19 | Data Pack Engine | Build Data Pack model, API, UI, binding, provenance, and official seed packs | Complete |
| 19C | Data Pack Runtime Provenance Logging | Log Data Pack item references during workflow execution | Implemented, pending migration/browser verification |
| 20 | Professional Lados Pack Bundles | Redesign official nodes and produce clean official bundles plus demo workflows | Planned |

Recommended order: **18P -> 19 -> 20**.

Phase 20 depends on Phase 19 because professional nodes need real Data Pack references for testing and demonstration.

---

## Phase 18P - External Marketplace Polish

### Goal

Complete the Phase 18 product surface so users can understand installed packs, registry packs, and Data Packs without confusion.

### Current Reality

Implemented:
- `registry_packs` migration file exists as `0050_registry_packs.sql`.
- Registry submit/browse/detail/verify/install APIs exist.
- Marketplace was rebuilt with Installed, Browse Registry, Publish Pack tabs.

Outstanding:
- Migration 0050 has been applied and browser-verified.
- Browser verification completed for publish, review, browse, and install.
- Data Packs tab has been restored as a first-class Phase 19 setup surface.
- A safe demo `.ladosPack` test bundle was created at `test-data/packs/lados-demo-pack-0.1.0.ladosPack`.
- CLI publish remains deferred until after Phase 19 unless CI/CD publishing becomes urgent.

### Scope

#### P18P-001 - Apply and verify registry migration

**Files:**
- `supabase/migrations/0050_registry_packs.sql`
- `docs/Lados/V4/Tests/test_phase18_registry.ps1`

**Tasks:**
- [x] Apply migration 0050 in Supabase.
- [x] Confirm `registry_packs` table exists.
- [x] Confirm private storage bucket `lados-pack-bundles` exists.
- [x] Confirm RLS policies are present.
- [x] Run `GET /registry/packs` with authenticated JWT/browser session.

**Acceptance criteria:**
- Registry browse endpoint returns `{ success: true, data: [] }` or verified listings.
- API does not throw missing table or missing bucket errors.

#### P18P-002 - Restore Marketplace Data Packs tab

**File:** `apps/web/src/app/(app)/marketplace/page.tsx`

**Required tab layout:**

```text
Installed Packs | Browse Registry | Data Packs | Publish Pack
```

**Data Packs tab for Phase 18P:**
- Show "Official Data Packs" and "Organization Data Packs" sections.
- Make clear that Data Packs are datasets/knowledge packs, not executable node packs.
- Display planned official examples:
  - Lados QS Rate Library
  - Lados BOQ Item Library
  - Lados Claim Evidence Rules
  - Malaysian Construction Standards Index
  - Contractor Plant and Labour Productivity Library
- Mark as "Phase 19 setup" until Phase 19 APIs exist.

**Acceptance criteria:**
- User can see Data Packs in Marketplace again.
- Copy clearly separates Data Packs from Capability Packs.
- No fake install action unless backend exists.

#### P18P-003 - Add registry seed/test bundle

**Files:**
- `test-data/packs/lados-demo-pack/manifest.json`
- `test-data/packs/lados-demo-pack/README.md`
- optional `.ladosPack` test artifact generated locally

**Tasks:**
- [x] Create one safe demo manifest with no runtime executor.
- [x] Bundle as `.ladosPack`.
- [x] Submit through Publish Pack tab.
- [x] Verify listing through Review Queue.
- [x] Install from Browse Registry.
- [x] Confirm installed pack appears in Installed tab and node registry.

**Acceptance criteria:**
- One end-to-end registry install works on a clean test pack.

#### P18P-004 - Marketplace UX polish

**Tasks:**
- [ ] Add empty states for all tabs.
- [ ] Add install-disabled explanation when user role is not owner/admin.
- [ ] Add visible "verified only" note for Browse Registry.
- [ ] Add review status feedback after Publish Pack submission.
- [ ] Add "manifest-only install" warning in preview modal.
- [x] Add owner/admin Review Queue tab for pending registry submissions.

**Acceptance criteria:**
- Marketplace is understandable without developer explanation.

#### P18P-005 - Phase 18 closure decision

**Decision needed:**

| Option | Meaning | Recommendation |
|---|---|---|
| Close Phase 18 after UI/API verification | Keep CLI and dynamic runtime deferred | Recommended |
| Extend Phase 18 to include CLI publish | Adds DX work now | Optional |
| Extend Phase 18 to include dynamic executor runtime | High security risk if rushed | Not recommended |

**Recommended close condition:**
- Phase 18 closes when Marketplace registry and UI publish/install work with manifest-only external packs.
- Dynamic executor runtime becomes a later security/runtime phase.

---

## Phase 19 - Data Pack Engine

### Goal

Build Data Packs as a first-class Lados platform capability.

Data Packs provide structured, versioned, source-aware data and knowledge that workflows can use. They do not execute code. They are governed datasets.

### Product Definition

A Data Pack may contain:
- Rate libraries
- BOQ item libraries
- Measurement rule references
- Claim evidence checklists
- Standards/specification indexes
- Contract clause indexes
- Productivity norms
- Supplier/product catalogues
- Material price reference tables
- Regional benchmark data
- Workflow prompt/context datasets

### Phase 19 Architecture

```text
Data Pack Listing
  -> Data Pack Version
      -> Collections
          -> Items
              -> Fields, source, applicability, effective dates

Installed Data Pack
  -> Organization visibility
  -> Node/workflow consumption
  -> Audit trail
```

### Proposed Database Model

#### `data_packs`

Top-level pack identity.

Key fields:
- `id uuid`
- `slug text unique`
- `display_name text`
- `description text`
- `publisher text`
- `domain text`
- `category text`
- `is_official boolean`
- `status text`
- `created_at timestamptz`
- `updated_at timestamptz`

#### `data_pack_versions`

Immutable version snapshots.

Key fields:
- `id uuid`
- `data_pack_id uuid`
- `version text`
- `source_summary text`
- `effective_from date`
- `effective_to date`
- `region text`
- `currency text`
- `unit_system text`
- `checksum text`
- `manifest_json jsonb`
- `published_at timestamptz`

#### `data_pack_collections`

Logical grouping inside a version.

Examples: `rates`, `boq_items`, `claim_evidence_rules`, `standards_index`.

Key fields:
- `id uuid`
- `version_id uuid`
- `key text`
- `display_name text`
- `schema_json jsonb`
- `item_count int`

#### `data_pack_items`

Searchable data rows.

Key fields:
- `id uuid`
- `collection_id uuid`
- `item_key text`
- `title text`
- `description text`
- `unit text`
- `value_json jsonb`
- `tags text[]`
- `source_name text`
- `source_url text`
- `source_date date`
- `region text`
- `effective_from date`
- `effective_to date`

#### `org_data_pack_installs`

Organization install state.

Key fields:
- `id uuid`
- `organization_id uuid`
- `data_pack_id uuid`
- `version_id uuid`
- `installed_by uuid`
- `status text`
- `installed_at timestamptz`

### Phase 19 API Plan

| Endpoint | Purpose |
|---|---|
| `GET /data-packs` | Browse available Data Packs |
| `GET /data-packs/:slug` | Pack details and versions |
| `GET /data-packs/:slug/versions/:version` | Version manifest |
| `POST /data-packs/:slug/install?organizationId=` | Install version to org |
| `DELETE /data-packs/:slug?organizationId=` | Disable/uninstall from org |
| `GET /org/data-packs?organizationId=` | Installed org Data Packs |
| `GET /data-pack-items/search` | Search installed data items |
| `GET /data-pack-items/:itemId` | Item detail and provenance |

### Phase 19 UI Plan

#### Marketplace Data Packs tab

Required panels:
- Installed Data Packs
- Browse Official Data Packs
- Browse Organization Data Packs
- Data Pack detail drawer
- Provenance/source panel

#### Explorer Data Packs panel

Required features:
- Search installed Data Pack items.
- Filter by collection, region, source, tag, effective date.
- Drag data item reference to canvas node config if accepted.
- Open detail with source/provenance.

#### Property Panel integration

New manifest field type:

```ts
{
  key: "rate_item",
  label: "Rate Item",
  type: "data_pack_item",
  dataPackCollection: "rates",
  required: true
}
```

### Official Phase 19 Seed Data Packs

| Data Pack | Purpose | Notes |
|---|---|---|
| `lados.qs-rate-library` | QS rates and cost references | Must carry source/date/region/unit and advisory status |
| `lados.boq-item-library` | Standard BOQ item templates | Helps clean node/workflow outputs |
| `lados.claim-evidence-rules` | Evidence requirements per claim/variation type | Must not certify; only checklist/advisory |
| `lados.construction-standards-index` | Searchable standards/spec reference index | Store references, not copyrighted full text |
| `lados.contractor-productivity-library` | Labour/plant productivity assumptions | Must expose assumptions |

### QS Guardrails

Data Pack values must not be treated as final contract rates unless the project contract or human user confirms them.

Every QS/commercial Data Pack item needs:
- source name
- source date
- region/state
- unit
- whether material-only, labour-only, plant-only, all-in, index, or benchmark
- applicability notes
- assumptions/exclusions
- human approval status where used in claims or valuations

### Phase 19 Done Criteria

- [x] Data Pack database migration exists and is applied.
- [x] Data Pack API browse/install/search works.
- [x] Marketplace Data Packs tab uses live data.
- [x] Explorer Data Packs panel uses live installed data.
- [x] PropertyPanel supports `data_pack_item` field type.
- [x] At least two official seed Data Packs exist.
- [x] Data Pack item detail shows provenance.
- [x] Data Pack usage is logged when workflow runs.
- [x] Typecheck passes.
- [x] Smoke test passes.

---

## Phase 20 - Marketplace Knowledge Catalogue Documentation

> Phase 20 has been reframed after the Data Pack Engine work. The new strategic position is that AI conversational search will reduce the value of website-only supplier discovery. Lados Marketplace should become an AI-ready supplier/seller knowledge catalogue, with Knowledge Packs as the structured catalogue unit.

**Primary Phase 20 documents:**

- `Design/Lados_V4_Phase20A_Capability_Pack_Planning_and_Node_Taxonomy.md`
- `Design/Lados_V4_Phase20_Naming_Lock_Capability_Packs_Knowledge_Packs.md`
- `Design/Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Strategy.md`
- `Sprint/Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Documentation.md`

### Goal

Document the Capability Pack architecture first, then the future Lados Marketplace as a supplier/seller knowledge catalogue platform before further marketplace implementation.

Lados Marketplace should support:

- greenfield target Capability Packs, not constrained by current test-era pack families
- well-indexed Capability Packs
- canonical node ownership and overlap control
- workflow templates owned by packs/solutions
- supplier profiles
- supplier/seller Knowledge Pack listings
- structured product, rate, evidence, compliance, and service catalogues
- AI retrieval and conversational search
- workflow insertion of Knowledge Pack item references
- provenance logging during workflow execution
- supplier subscription/business model planning

### Why Phase 20 Matters

Search is moving from link lists to AI answers. Suppliers will need machine-readable catalogues that AI agents can search, cite, compare, and apply inside workflows.

Knowledge Packs are the Lados answer to this shift. A supplier website may still exist, but the valuable marketplace asset becomes a versioned, source-aware, workflow-ready Knowledge Pack.

### Phase 20 Documentation Deliverables

- Capability Pack greenfield taxonomy and node indexing model.
- Prototype/test pack retirement and migration policy.
- Canonical capability registry and overlap-control rules.
- Workflow template ownership/indexing model.
- Marketplace knowledge-catalogue strategy.
- Supplier profile specification.
- Supplier Knowledge Pack listing specification.
- Knowledge Pack item metadata specification.
- AI retrieval and search requirements.
- Marketplace screen specification.
- Governance and verification checklist.
- Business model notes.
- Phase 21+ implementation backlog.

### Phase 20 Done Criteria

- [x] Capability Pack planning paper created.
- [x] Pack layering and node taxonomy drafted.
- [x] Current packs documented as prototype/test assets, not binding target architecture.
- [x] Strategy paper created.
- [x] Documentation sprint plan created.
- [x] Naming lock created for Capability Packs and Knowledge Packs.
- [ ] New target Capability Pack catalogue drafted.
- [ ] Current prototype packs/nodes classified for keep/rename/merge/split/deprecate/remove.
- [ ] Canonical capability registry drafted.
- [ ] Workflow template index drafted.
- [ ] Supplier Knowledge Pack specification complete.
- [ ] AI retrieval requirements complete.
- [ ] Marketplace screen specification complete.
- [ ] Governance checklist complete.
- [ ] Business model notes complete.
- [ ] Phase 21+ implementation backlog complete.
- [ ] V4 README and master checklist updated.

---

## Deferred Phase 20B - Professional Lados Pack Bundles

### Goal

Redesign official Lados packs into clean, professional, demonstrable bundles with consistent node naming, icons, categories, ports, configs, Data Pack references, and demo workflows.

### Why Phase 20 Matters

The platform is only believable if the official packs feel designed, not accumulated. Submit Invoice and similar nodes must be readable, aligned, well-sized, and connected to real user input patterns.

### Official Bundle Targets

| Bundle | Focus |
|---|---|
| `lados.core` | Triggers, control flow, HTTP, delays, state helpers |
| `lados.document` | Upload/read/parse/generate documents |
| `lados.qs` | BOQ, measurement, cost plan, claim/variation support |
| `lados.construction` | Project, site, defects, inspections, progress workflows |
| `lados.finance` | Invoice, payment, PO, retention |
| `lados.procurement` | RFQ, supplier, quotation comparison |
| `lados.notification` | Email, SMS, in-app |
| `lados.contractor` | Contractor operating workflows and field records |

### Node Design Standard

Every official node must have:
- clear display name
- short node description
- category and icon
- readable default canvas width
- no hidden duplicate handles
- typed input/output ports
- short port labels
- professional config fields
- resource binding strategy where needed
- Data Pack references where useful
- one example workflow usage
- one smoke test path or manual verification note

### Node Naming Rules

| Item | Rule | Example |
|---|---|---|
| Node type | machine-readable, stable | `finance.submit_invoice` |
| Display name | user-readable verb phrase | `Submit Invoice` |
| Input port | short noun | `Invoice`, `BOQ`, `Claim` |
| Output port | result noun | `Invoice`, `Status`, `Evidence` |
| Config field | business language | `Invoice Resource`, `Approval Threshold` |

Avoid long labels inside the canvas card. Detailed explanations belong in the inspector.

### Input Strategy for Many-Field Nodes

For nodes like Submit Invoice, the user should not manually connect or type every field on the canvas. Recommended pattern:

1. The node accepts one primary Workspace Resource input or Resource Binding, such as `Invoice`.
2. The inspector shows required fields and binding status.
3. The node can optionally accept supporting inputs: `Contract`, `PO`, `Evidence`.
4. Data Pack references supply rules, validation tables, and evidence checklists.
5. The workflow run uses resolved resource data and node config to execute.

This keeps the canvas readable and makes the PropertyPanel/Explorer do the heavy data work.

### Demo Workflow Pack

Phase 20 must produce demo workflows:

| Workflow | Purpose |
|---|---|
| Submit Invoice to Approval | Tests finance/resource binding/approval |
| Progress Claim Evidence Check | Tests construction/QS/Data Pack evidence rules |
| RFQ to Quotation Comparison | Tests procurement/supplier/data outputs |
| BOQ Upload to Cost Summary | Tests document/QS workflow |
| Defect Report to Notification | Tests construction/notification/event flow |

### Phase 20 Done Criteria

- [ ] Official node design standard documented.
- [ ] Node manifest audit completed for all official packs.
- [ ] Canvas readability verified for high-port nodes.
- [ ] Submit Invoice redesigned around Workspace Resource + Resource Binding, not dozens of visible tiny fields.
- [ ] Official packs exported or documented as clean Lados Pack Bundles.
- [ ] Demo workflows added.
- [ ] Demo workflows pass manual run verification where nodes are functional.
- [ ] Marketplace shows official packs and Data Packs professionally.
- [ ] Typecheck passes.
- [ ] Build passes.

---

## Cross-Phase Verification Gates

| Gate | Required before moving on |
|---|---|
| UX Gate | Browser verify Marketplace, Explorer, Canvas, PropertyPanel |
| Data Gate | Supabase migration applied and smoke test passes |
| QS Gate | Data values show source/date/region/assumptions |
| Security Gate | No dynamic uploaded executor execution without sandbox |
| Demo Gate | At least one real workflow can run end-to-end |
| Docs Gate | Sprint checklist, tech paper, and test guide updated |

---

## Immediate Next Steps

1. Apply migration 0052.
2. Run a workflow with a `data_pack_item` node config.
3. Run Phase 19C provenance smoke test.
4. Browser verify Execution Log provenance block.
5. Start Phase 20 Marketplace Knowledge Catalogue documentation.

### Phase 18P Handover - 2026-07-02

Done:
- Restored Marketplace `Data Packs` tab.
- Added official Data Pack planning cards and organization Data Pack empty state.
- Added visible distinction between Capability Packs and Data Packs.
- Created `test-data/packs/lados-demo-pack/manifest.json`.
- Created `test-data/packs/lados-demo-pack/README.md`.
- Generated `test-data/packs/lados-demo-pack-0.1.0.ladosPack`.
- Confirmed local parser can read `manifest.json` from the `.ladosPack`.
- Made duplicate submissions return `already_submitted` with existing listing id.
- Added owner/admin Review Queue tab to approve pending listings from Marketplace.
- Full `corepack pnpm typecheck` passed.

Next:
- Browser verify Marketplace four-tab layout.
- Submit the demo `.ladosPack` from Publish Pack.
- Verify listing through registry review endpoint.
- Or approve the listing from Marketplace -> Review Queue.
- Install from Browse Registry.
- Confirm installed pack and demo node appear.

Ad-hoc:
- Live registry verification needs an authenticated owner/admin session or JWT.

### Phase 18P Completion - 2026-07-02

Done:
- Browser verified the full external Marketplace loop.
- Submitted `lados-demo-pack-0.1.0.ladosPack`.
- Approved listing `847acb03-ad6a-49a1-8c98-e282cf492e23` through Review Queue.
- Installed `Lados Demo Pack` from Browse Registry.
- Confirmed installed pack is active at `/packs/demo.lados-demo-pack`.

Next:
- Start Phase 19 Data Pack Engine.

Ad-hoc:
- `lados-pack publish` CLI deferred.
- Dynamic uploaded executor runtime deferred until sandboxed runtime design.

### Phase 19 Data Pack Engine Vertical Slice - 2026-07-02

Done:
- Added migration `supabase/migrations/0051_data_pack_engine.sql`.
- Upgraded `data_packs` with V4 metadata and added `data_pack_versions`, `data_pack_collections`, `data_pack_items`, and `org_data_pack_installs`.
- Seeded five official Lados Data Packs with source-aware sample items and commercial guardrails.
- Added `DataPacksModule` API endpoints for browse, detail, version manifest, install/disable, org installed list, item search, and item detail.
- Replaced Marketplace Data Packs static cards with live API cards, install/disable actions, and provenance detail modal.
- Replaced Explorer Data Pack stub with live installed-pack search.
- Added `data_pack_item` PropertyPanel field support.
- Added `docs/Lados/V4/Tests/test_phase19_data_packs.ps1`.

Next:
- Apply migration 0051 to Supabase.
- Run Phase 19 smoke test with authenticated owner/admin JWT.
- Browser verify Marketplace Data Packs and Explorer Data Packs.

Ad-hoc:
- Runtime logging of Data Pack item references during workflow execution remains outstanding.

Docs updated:
- Updated this sprint plan.
- Updated `Lados_V4_P18P-P20_Master_Checklist.md`.
- Added Phase 19 smoke test script.

Verification:
- Full `corepack pnpm typecheck` passed.
- Full `corepack pnpm build` passed with existing non-blocking web lint warnings.

### Phase 19 Verification Completion - 2026-07-02

Done:
- Applied migration 0051.
- Ran `docs/Lados/V4/Tests/test_phase19_data_packs.ps1` successfully.
- Browser verified Marketplace Data Packs.
- Browser verified Explorer Data Packs.
- Removed one unused workflow-page type import that blocked production build.

Next:
- Proceed to Phase 20 Marketplace Knowledge Catalogue documentation.

Ad-hoc:
- Workflow runtime logging for Data Pack item references remains deferred.

Docs updated:
- Updated this sprint plan.
- Updated `Lados_V4_P18P-P20_Master_Checklist.md`.

Verification:
- Phase 19 smoke test passed.
- Full `corepack pnpm typecheck` passed.
- Full `corepack pnpm build` passed.

### Phase 19C Runtime Provenance Logging - 2026-07-02

Done:
- Added migration `supabase/migrations/0052_data_pack_runtime_provenance.sql`.
- Added `execution_logs.data_pack_usages`.
- Added runtime provenance resolver to `DataPacksService`.
- Persisted Data Pack usage metadata from both `ExecutionService` fallback runs and `ExecutionWorker` queue runs.
- Rendered Data Pack provenance in `ExecutionLogPanel`.
- Added `docs/Lados/V4/Tests/test_phase19c_data_pack_provenance.ps1`.

Next:
- Apply migration 0052.
- Run a workflow where node config contains a Data Pack item id.
- Run Phase 19C smoke test with that run id.
- Browser verify Execution Log provenance block.

Ad-hoc:
- Future reporting can query `execution_logs.data_pack_usages` through the GIN index.

Docs updated:
- Updated this sprint plan.
- Updated `Lados_V4_P18P-P20_Master_Checklist.md`.
- Added Phase 19C smoke test script.

Verification:
- Full `corepack pnpm typecheck` passed.

### Phase 20 Marketplace Knowledge Catalogue Documentation Kickoff - 2026-07-02

Done:
- Reframed Phase 20 from immediate professional bundle implementation to Marketplace documentation strategy.
- Added Phase 20A Capability Pack planning as the first documentation priority.
- Confirmed current Capability Pack families are not the target architecture.
- Captured the strategic thesis that AI conversational search will favor structured knowledge catalogues over website-only discovery.
- Locked the Phase 20 product language: Capability Packs provide the operating grammar and Knowledge Packs provide the governed knowledge catalogue.
- Defined Knowledge Packs as the supplier/seller knowledge catalogue unit.
- Documented Data Pack as the legacy Phase 19 technical implementation term until a future compatibility migration.
- Created `Design/Lados_V4_Phase20_Naming_Lock_Capability_Packs_Knowledge_Packs.md`.
- Created `Design/Lados_V4_Phase20A_Capability_Pack_Planning_and_Node_Taxonomy.md`.
- Created `Design/Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Strategy.md`.
- Created `Sprint/Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Documentation.md`.
- Updated this sprint plan to make Phase 20 documentation-first.

Next:
- Draft the new target Capability Pack catalogue for current and future business operations.
- Classify current prototype packs/nodes as keep, rename, merge, split, deprecate, or remove.
- Draft canonical capability registry and workflow template index.
- Complete supplier Knowledge Pack specification.
- Complete AI retrieval/result-shape requirements.
- Complete Marketplace screen specification.
- Complete governance checklist and business model notes.
- Convert the accepted documentation into Phase 21+ implementation backlog.

Ad-hoc:
- Phase 19C runtime provenance smoke test remains deferred because building a functional Knowledge Pack-consuming workflow is not yet ergonomic.
- Marketplace Knowledge Pack documentation proceeds after the new Capability Pack ownership and indexing are accepted.
- Professional Lados Pack Bundles are deferred to Phase 20B after Phase 20A greenfield planning is accepted.

Docs updated:
- `Design/Lados_V4_Phase20A_Capability_Pack_Planning_and_Node_Taxonomy.md`
- `Design/Lados_V4_Phase20_Naming_Lock_Capability_Packs_Knowledge_Packs.md`
- `Design/Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Strategy.md`
- `Sprint/Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Documentation.md`
- `Sprint/Lados_V4_P18P-P20_Master_Checklist.md`
- `docs/Lados/V4/README.md`

Verification:
- Documentation-only update. No code verification required.

### Phase 20 Naming Lock - 2026-07-02

Done:
- Locked the product language: Capability Pack means workflow capabilities, nodes, templates, and action grammar.
- Locked Knowledge Pack as the new product name for governed knowledge catalogues, supplier listings, standards references, SOPs, compliance rules, technical guidelines, rates, and evidence rules.
- Documented Data Pack as the legacy Phase 19 technical implementation name until a future compatibility migration.
- Updated the Phase 20 strategy paper, active documentation sprint plan, Capability Pack planning paper, productization sprint plan, master checklist, and V4 README.

Next:
- Continue with the new target Capability Pack catalogue.
- Draft the canonical capability registry and workflow template index.
- Expand the Supplier Knowledge Pack specification and Marketplace screen specification.

Ad-hoc:
- Current code, migrations, smoke tests, and runtime logs may still use `data_pack_*` identifiers.
- Product UI and new planning documents should use Knowledge Pack unless they are referring to legacy technical identifiers.

Docs updated:
- `Design/Lados_V4_Phase20_Naming_Lock_Capability_Packs_Knowledge_Packs.md`
- `Design/Lados_V4_Phase20A_Capability_Pack_Planning_and_Node_Taxonomy.md`
- `Design/Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Strategy.md`
- `Sprint/Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Documentation.md`
- `Sprint/Lados_V4_Sprint_P18P-P20_Productization_DataPacks_ProfessionalBundles.md`
- `Sprint/Lados_V4_P18P-P20_Master_Checklist.md`
- `README.md`

Verification:
- Documentation-only update. Text scan completed for active Phase 20 terminology.

---

## Handover Format

At the end of every task, update:
- this sprint plan
- `Lados_V4_P18P-P20_Master_Checklist.md`
- any affected tech paper
- any affected test script/playbook

Use this handover block:

```text
Done:
Next:
Ad-hoc:
Docs updated:
Verification:
```
