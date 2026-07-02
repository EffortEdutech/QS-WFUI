# Lados V4 Technical Paper: Data Packs and Professional Pack Bundles

**Document ID:** LADOS-V4-TECH-DATAPACKS-BUNDLES  
**Status:** Draft for implementation  
**Date:** 2026-07-02  
**Related phases:** 18P, 19, 20  

---

## 1. Purpose

This paper defines the next product layer for Lados V4:

1. Data Packs as versioned, governed datasets.
2. Professional Lados Pack Bundles as clean capability bundles.
3. The relationship between Workspace Resources, Resource Bindings, Capability Packs, and Data Packs.

The goal is to stop Lados from becoming a collection of loosely connected features. The platform must feel intentional, commercial-grade, and testable.

---

## 2. Conceptual Model

```text
Capability Pack
  provides nodes and workflow capabilities

Data Pack
  provides trusted data, references, rules, templates, and knowledge

Workspace Resource
  stores real business objects belonging to an organization

Resource Binding
  connects a workflow node field to a Workspace Resource

Workflow Run
  resolves Resource Bindings, reads Data Pack references, executes nodes, logs provenance
```

---

## 3. Why Data Packs Are Major

Data Packs are not simple files. They are how Lados becomes useful in real industries.

For construction and QS workflows, Data Packs can represent:
- BOQ item libraries
- measurement rules
- rate references
- cost benchmarks
- evidence checklists
- variation valuation rules
- claim submission requirements
- standards/specification indexes
- plant/labour productivity assumptions

For other industries, the same engine can hold:
- policy libraries
- compliance rules
- product catalogues
- pricing references
- medical protocol references
- HR policy datasets
- SOP libraries

The Data Pack Engine is therefore cross-domain infrastructure, not QS-only infrastructure.

---

## 4. Data Pack Requirements

### 4.1 Data Pack Identity

Each Data Pack needs:
- stable slug
- display name
- publisher
- domain/category
- current version
- official/community/private status
- description
- tags

### 4.2 Versioning

Data Pack versions must be immutable. A workflow run must know exactly which version and item were used.

Required metadata:
- version string
- effective dates
- source summary
- checksum
- region
- currency where relevant
- unit system

### 4.3 Collections

A Data Pack version can contain multiple collections.

Examples:

| Data Pack | Collections |
---|---|
| QS Rate Library | `material_rates`, `labour_rates`, `plant_rates`, `composite_rates` |
| BOQ Item Library | `architectural_items`, `structural_items`, `mep_items` |
| Claim Evidence Rules | `progress_claim`, `variation`, `loss_expense`, `final_account` |
| Standards Index | `malaysia`, `british_standard`, `sirim`, `authority_submission` |

### 4.4 Items

Every item must be searchable and auditable.

Recommended fields:
- item key
- title
- description
- unit
- value payload JSON
- tags
- region
- source name
- source URL where permitted
- source date
- effective date range
- assumptions
- exclusions
- review status

---

## 5. QS and Contractor Guardrails

Data Packs may support commercial recommendations, but they must not become automatic certification.

Required guardrails:
- Mark Data Pack rates as reference/advisory unless contract-confirmed.
- Separate material-only, labour-only, plant-only, index, benchmark, and all-in rates.
- Do not treat public schedules as project-applicable contract rates without human confirmation.
- Require evidence for claim-related recommendations.
- Human approval remains required for payment certification, entitlement decisions, and contractual conclusions.

---

## 6. Proposed Data Pack Manifest

```json
{
  "slug": "lados.qs-rate-library",
  "displayName": "Lados QS Rate Library",
  "version": "2026.1.0",
  "publisher": "Lados Platform",
  "domain": "construction",
  "category": "rates",
  "region": "MY",
  "currency": "MYR",
  "effectiveFrom": "2026-01-01",
  "sourceSummary": "Curated internal reference library for demo and workflow validation.",
  "collections": [
    {
      "key": "composite_rates",
      "displayName": "Composite Rates",
      "schema": {
        "unit": "string",
        "rate": "number",
        "basis": "string"
      }
    }
  ]
}
```

---

## 7. Runtime Consumption

Nodes should consume Data Packs through explicit references, not hidden global lookup.

Recommended node config:

```json
{
  "rateItemRef": {
    "dataPackSlug": "lados.qs-rate-library",
    "version": "2026.1.0",
    "collection": "composite_rates",
    "itemKey": "CONC-G25-M3"
  }
}
```

At runtime:
1. Execution resolves Resource Bindings.
2. Execution resolves Data Pack references.
3. Node receives resolved item payload plus provenance metadata.
4. Execution log records the Data Pack reference.

---

## 8. Professional Pack Bundle Standard

Official Lados Pack Bundles must be clean enough to demonstrate.

### 8.1 Pack-Level Requirements

Each official pack must include:
- `manifest.json`
- README
- node manifest list
- dependencies
- resource requirements
- Data Pack requirements where applicable
- demo workflows
- verification notes

### 8.2 Node-Level Requirements

Every official node must include:
- display name
- short description
- category
- icon
- color
- typed ports
- concise port labels
- inspector config schema
- examples
- resource binding guidance
- Data Pack item guidance where applicable

### 8.3 High-Input Node Rule

High-input nodes should not expose every business field as a tiny canvas port.

Use this hierarchy:

1. Primary Workspace Resource binding.
2. Supporting resource inputs where needed.
3. Inspector fields for configuration.
4. Data Pack references for rules/rates/templates.
5. Optional advanced ports only for composition use cases.

Example: `Submit Invoice`

Bad canvas design:
- 15 visible input fields as small ports.

Good canvas design:
- One primary `Invoice` Workspace Resource binding.
- Optional `Contract`, `PO`, `Evidence` inputs.
- Inspector shows invoice field completeness.
- Data Pack supplies validation/evidence rules.

---

## 9. Marketplace Information Architecture

Marketplace should have four tabs:

```text
Installed Packs | Browse Registry | Data Packs | Publish Pack
```

### Installed Packs

Shows local Capability Packs.

### Browse Registry

Shows verified external Capability Pack listings.

### Data Packs

Shows official and organization Data Packs.

### Publish Pack

Submits `.ladosPack` Capability Pack bundles for verification.

Do not mix Capability Pack install buttons with Data Pack install buttons unless labels are explicit.

---

## 10. Recommended Phase Boundaries

### Phase 18P

Polish existing Marketplace and restore Data Packs surface. No new Data Pack backend yet.

### Phase 19

Build Data Pack backend and live UI.

### Phase 20

Clean official node/packs using Data Packs and professional demo workflows.

---

## 11. Security Boundary

Phase 18 registry install is manifest-only. It registers pack and node declarations. It does not dynamically execute uploaded JavaScript.

Dynamic external executor loading requires:
- sandbox runtime
- permission manifest review
- dependency scanning
- network/filesystem policy
- CPU/memory/time limits
- audit log of external executor invocation
- rollback/disable path

This should be a future dedicated phase.

---

## 12. Success Criteria

Lados is product-ready when:
- official packs are clean and readable on canvas
- Data Packs are visible, searchable, and source-aware
- workflows can use Data Pack items
- one real QS/contractor workflow runs end-to-end
- external Marketplace can submit/install a safe pack
- user can understand the distinction between packs, data packs, resources, and bindings without an explanation from the developer
