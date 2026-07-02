# Lados V4 Phase 20A: Capability Pack Planning and Node Taxonomy

**Document ID:** LADOS-V4-P20A-CAPABILITY-PACKS  
**Phase:** 20A  
**Status:** Draft for architecture alignment  
**Date:** 2026-07-02  

---

## 1. Purpose

Before Lados expands Marketplace Data Packs, the Capability Pack system must be planned professionally.

Capability Packs are the operating grammar of Lados. They define what users can do, what AI can assemble, and what workflow templates can be generated. If Capability Packs are not well indexed and governed, a future marketplace with hundreds or thousands of nodes will become confusing, duplicated, and difficult to trust.

Phase 20A defines:

- how Capability Packs should be arranged
- how nodes should be indexed
- how overlap should be avoided
- how workflow templates should relate to packs
- how Lados can scale from dozens to thousands of nodes without overwhelming users

---

## 2. Core Principle

Capability Packs should be organized around business capability ownership, not only code ownership.

```text
Capability Pack
  -> owns a business capability area
  -> declares nodes
  -> declares workflow templates
  -> declares dependencies
  -> declares Data Pack requirements
  -> declares events, resources, and permissions
```

Data Packs provide knowledge. Capability Packs provide actions.

Workflow Templates combine actions and knowledge into repeatable business operations.

---

## 3. Capability Pack vs Data Pack

| Item | Capability Pack | Data Pack |
|---|---|---|
| Purpose | Adds workflow actions and tools | Adds structured knowledge/catalogue data |
| Contains | Nodes, manifests, templates, config schemas | Collections, items, source metadata, references |
| Executes logic | Yes, through approved/sandboxed node runtime | No |
| Marketplace role | Capability extension | Knowledge/catalogue publication |
| Example | `lados.procurement` | Supplier concrete catalogue |
| User sees | Nodes and templates | Searchable catalogue items |

The marketplace must keep these two assets clearly separated, while allowing them to work together.

---

## 4. Pack Layering Model

Lados should use layers so nodes do not overlap unnecessarily.

| Layer | Pack type | Purpose | Example |
|---|---|---|---|
| L0 | Foundation Packs | Primitive technical capabilities | core, document, notification |
| L1 | Domain Packs | Industry/business domain actions | finance, procurement, construction |
| L2 | Solution Packs | End-to-end operating workflows for a role or sector | contractor operations, QS practice |
| L3 | Vendor Packs | Vendor-specific integrations or specialist tools | accounting system connector, supplier portal |
| L4 | Template Packs | Workflow templates and playbooks with few/no new nodes | CIPAA claim pack, invoice approval pack |

Rule:

> A higher layer should depend on lower-layer packs instead of duplicating their nodes.

Example:

`lados.contractor` should not duplicate `lados.procurement.compare_quotations`. It should depend on `lados.procurement` and provide contractor-specific templates that use that node.

---

## 5. Official Capability Pack Families

Initial official pack families should be stable and predictable:

| Pack ID | Ownership boundary |
|---|---|
| `lados.core` | triggers, control flow, state, utility, HTTP |
| `lados.document` | file upload, parsing, document generation, extraction |
| `lados.resource` | workspace resources, resource bindings, resource transforms |
| `lados.ai` | AI assist, classification, extraction, summarization |
| `lados.notification` | email, in-app, SMS, reminders |
| `lados.finance` | invoice, payment, claim, retention, ledger-facing actions |
| `lados.procurement` | RFQ, supplier, quotation, award, PO |
| `lados.qs` | BOQ, measurement, valuation, variation, cost planning |
| `lados.construction` | site, progress, defects, inspections, handover |
| `lados.contractor` | contractor operating workflows that orchestrate other packs |

The exact pack list can grow, but each pack must have an ownership boundary and a dependency policy.

---

## 6. Node Indexing Model

Every node should be indexed by more than pack name.

Required node index dimensions:

| Dimension | Purpose | Example |
|---|---|---|
| Pack | installation and ownership | `lados.procurement` |
| Domain | business area | procurement |
| Capability | what the node does | quotation comparison |
| Stage | business lifecycle stage | tendering |
| Actor | typical user/role | procurement manager |
| Resource type | primary resource consumed/produced | quotation |
| Input pattern | manual, resource, event, Data Pack, API | resource |
| Output pattern | resource, artifact, event, decision | decision |
| Template usage | workflow templates using it | RFQ to Comparison |
| Dependency | packs/Data Packs required | supplier catalogue |

This index allows the UI and AI to filter nodes intelligently instead of showing one giant alphabetic list.

---

## 7. Node Naming and Type Rules

Node types must remain stable and namespaced:

```text
lados.<pack>.<verb>_<object>
```

Examples:

| Good | Why |
|---|---|
| `lados.procurement.create_rfq` | clear pack and action |
| `lados.finance.submit_invoice` | clear business action |
| `lados.qs.measure_boq_item` | clear QS ownership |

Avoid:

| Avoid | Reason |
|---|---|
| `submit_invoice` | no namespace |
| `contractor.submit_invoice` if finance owns invoice | duplicates ownership |
| `process_data` | vague |
| `smart_ai_node` | not business-readable |

Display names should be short and professional:

- Submit Invoice
- Create RFQ
- Compare Quotations
- Validate Claim Evidence
- Generate Payment Certificate

Long explanations belong in the inspector, not on the canvas.

---

## 8. Overlap Control

Node overlap is the main scaling risk.

### 8.1 Overlap Categories

| Overlap type | Example | Decision |
|---|---|---|
| Exact duplicate | two packs both create RFQ | block or merge |
| Near duplicate | submit invoice vs lodge invoice | choose one canonical node, alias if needed |
| Domain variant | submit subcontractor claim vs submit supplier invoice | allow if business meaning differs |
| Integration variant | submit invoice to Xero vs submit invoice to SAP | allow as vendor/integration nodes |
| Template duplicate | two workflows use same node sequence | allow if template audience differs |

### 8.2 Canonical Node Registry

Phase 20A should define a canonical node registry:

```text
canonical capability key:
  domain.procurement.rfq.create
owner pack:
  lados.procurement
node type:
  lados.procurement.create_rfq
allowed aliases:
  issue_rfq, prepare_rfq
dependent packs:
  lados.contractor, lados.qs
```

Before a new node is accepted, it should be checked against canonical capability keys.

### 8.3 Dependency Instead of Duplication

If another pack needs the same capability, it should depend on the owner pack.

Example:

```text
lados.contractor
  depends on:
    lados.finance
    lados.procurement
    lados.construction
  provides:
    contractor-specific templates
    contractor orchestration nodes only where needed
```

---

## 9. Workflow Templates at Scale

Hundreds or thousands of nodes should not be the main user experience.

Users should start from:

- business operation templates
- role-based templates
- industry templates
- AI-generated drafts constrained by installed packs
- search results grouped by business intent

### 9.1 Template Ownership

Templates should be owned by either:

| Owner | Template type |
|---|---|
| Capability Pack | pack-native examples |
| Solution Pack | full business operation templates |
| Organization | internal SOP workflows |
| Marketplace Publisher | specialized workflow packs |

### 9.2 Template Manifest Fields

Every workflow template should declare:

- template id
- display name
- business process
- owner pack
- required packs
- optional packs
- required Data Packs
- required workspace resources
- expected inputs
- expected outputs
- user role
- industry/domain tags
- maturity level: demo, draft, production-ready
- verification status

### 9.3 Template Examples

| Template | Owner | Required packs | Required Data Packs |
|---|---|---|---|
| Submit Invoice to Approval | `lados.finance` | finance, resource, notification | invoice rules |
| RFQ to Quotation Comparison | `lados.procurement` | procurement, document, supplier | supplier catalogue |
| Progress Claim Evidence Check | `lados.contractor` | qs, construction, document | claim evidence rules |
| Defect Report to Notification | `lados.construction` | construction, notification | defect classification rules |

---

## 10. UI Discovery Model

The node palette should not behave like a flat list when node count grows.

Recommended discovery levels:

1. Search by business intent.
2. Browse by template first.
3. Browse by domain/capability.
4. Browse by pack.
5. Browse technical nodes last.

UI concepts:

- "Start from Operation"
- "Add Capability"
- "Browse Pack"
- "Show Advanced Nodes"
- "Related Templates"
- "Used by these workflows"
- "Requires these Data Packs"

The AI designer should use the same index, so AI and UI produce consistent recommendations.

---

## 11. Capability Pack Manifest Extensions

Current `.ladosPack` manifest is enough for Phase 18 registry install, but Phase 20A should plan richer metadata:

```json
{
  "id": "lados.procurement",
  "displayName": "Lados Procurement",
  "version": "1.0.0",
  "layer": "domain",
  "domains": ["procurement"],
  "capabilities": ["rfq", "supplier", "quotation", "award"],
  "dependsOnPacks": ["lados.document", "lados.notification"],
  "suggestedDataPacks": ["supplier.catalogue", "procurement.rules"],
  "nodes": [],
  "templates": [],
  "canonicalCapabilities": []
}
```

Node declarations should add:

```json
{
  "type": "lados.procurement.compare_quotations",
  "displayName": "Compare Quotations",
  "canonicalCapability": "procurement.quotation.compare",
  "businessStage": "tendering",
  "primaryResource": "quotation",
  "inputPattern": "resource",
  "outputPattern": "decision",
  "usedByTemplates": ["procurement.rfq_to_comparison"]
}
```

---

## 12. Governance Checklist

Before a Capability Pack is accepted:

- [ ] Pack has a clear ownership boundary.
- [ ] Pack declares layer.
- [ ] Pack declares dependencies.
- [ ] Pack does not duplicate canonical nodes.
- [ ] Nodes have canonical capability keys.
- [ ] Nodes use professional display names.
- [ ] High-input nodes use resource/input strategy, not canvas clutter.
- [ ] Templates declare required packs and Data Packs.
- [ ] Events/resources/permissions are declared.
- [ ] Pack has README and examples.
- [ ] Pack has smoke test or manual verification path.

---

## 13. Phase 20A Deliverables

- Capability Pack taxonomy.
- Node indexing model.
- Canonical capability registry model.
- Overlap-control rules.
- Template ownership and manifest model.
- UI discovery model.
- Manifest extension proposal.
- Governance checklist.

---

## 14. Success Criteria

Phase 20A succeeds when Lados can answer:

- Which pack owns this capability?
- Is this node a duplicate?
- Which templates use this node?
- Which Data Packs does this template need?
- How does a user find the right node among thousands?
- How does AI choose nodes consistently with the UI?

Only after this is clear should Phase 20B professional bundles and Phase 20C marketplace Data Packs proceed.
