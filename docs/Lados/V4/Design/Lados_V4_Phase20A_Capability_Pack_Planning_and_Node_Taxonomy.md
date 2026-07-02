# Lados V4 Phase 20A: Capability Pack Planning and Node Taxonomy

**Document ID:** LADOS-V4-P20A-CAPABILITY-PACKS  
**Phase:** 20A  
**Status:** Draft for architecture alignment  
**Date:** 2026-07-02  

---

## 1. Purpose

Before Lados expands Marketplace Knowledge Packs, the Capability Pack system must be planned professionally from a clean target architecture.

Capability Packs are the operating grammar of Lados. They define what users can do, what AI can assemble, and what workflow templates can be generated. If Capability Packs are not well indexed and governed, a future marketplace with hundreds or thousands of nodes will become confusing, duplicated, and difficult to trust.

The current packs and nodes are not the target architecture. They are useful learning assets and implementation prototypes. Phase 20A should design the new official Capability Pack system for current and future business operations, then decide what to keep, rename, migrate, merge, or retire.

Phase 20A defines:

- the clean-slate target Capability Pack architecture
- how Capability Packs should be arranged
- how nodes should be indexed
- how overlap should be avoided
- how workflow templates should relate to packs
- how Lados can scale from dozens to thousands of nodes without overwhelming users
- how prototype/test-era packs and nodes should be retired or migrated

---

## 2. Core Principle

Capability Packs should be organized around business capability ownership, not current code folders or test-era pack names.

```text
Capability Pack
  -> owns a business capability area
  -> declares nodes
  -> declares workflow templates
  -> declares dependencies
  -> declares Knowledge Pack requirements
  -> declares events, resources, and permissions
```

Knowledge Packs provide knowledge. Capability Packs provide actions.

Workflow Templates combine actions and knowledge into repeatable business operations.

---

## 3. Naming Lock

Phase 20 locks two platform concepts:

- **Capability Pack**: actions, nodes, templates, workflow capabilities.
- **Knowledge Pack**: governed knowledge such as standards, regulations, SOPs, technical guidelines, supplier catalogues, rate libraries, and evidence rules.

The old term **Data Pack** is now legacy technical implementation language from Phase 19. New product and architecture documents should use **Knowledge Pack**.

See `Design/Lados_V4_Phase20_Naming_Lock_Capability_Packs_Knowledge_Packs.md`.

---

## 4. Prototype Reset Policy

The current Capability Packs must be treated as provisional.

### Policy

- Do not assume current pack names are final.
- Do not assume current node names are final.
- Do not keep a node only because it already exists.
- Do not create a future template around a prototype node if the business capability is unclear.
- Rebuild the official catalogue from business operations, capability ownership, and template needs.

### Current Asset Classification

Every existing pack/node should be classified:

| Classification | Meaning | Action |
|---|---|---|
| Keep | Correct capability, acceptable naming and contract | Move into target catalogue |
| Rename | Useful capability, poor name or wrong namespace | Rename with migration note |
| Merge | Duplicates or overlaps another capability | Merge into canonical node |
| Split | Node does too many unrelated things | Split into smaller canonical nodes |
| Deprecate | Useful only for prototype/demo | Hide from official catalogue |
| Remove | Test-only or obsolete | Remove from target bundle |

This prevents test-purpose work from becoming permanent product structure.

---

## 5. Capability Pack vs Knowledge Pack

| Item | Capability Pack | Knowledge Pack |
|---|---|---|
| Purpose | Adds workflow actions and tools | Adds structured knowledge/catalogue data |
| Contains | Nodes, manifests, templates, config schemas | Collections, items, source metadata, references |
| Executes logic | Yes, through approved/sandboxed node runtime | No |
| Marketplace role | Capability extension | Knowledge/catalogue publication |
| Example | `lados.procurement` | Supplier concrete catalogue |
| User sees | Nodes and templates | Searchable catalogue items |

The marketplace must keep these two assets clearly separated, while allowing them to work together.

---

## 6. Pack Layering Model

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

## 7. Target Capability Domains

This section is not a commitment to current pack families. It is a candidate planning map for the new official Capability Pack architecture.

Phase 20A should produce a final target catalogue only after capability discovery and overlap review.

Candidate target domains:

| Candidate domain | Business ownership question |
|---|---|
| Workflow Foundation | What universal triggers, control flow, state, and utility nodes are needed? |
| Document Intelligence | What document intake, parsing, extraction, and generation actions are needed? |
| Resource Operations | What project/workspace resources should workflows create, update, bind, or transform? |
| AI Operations | What AI actions are generic enough to be platform capabilities? |
| Communication | What notifications, reminders, and communication actions are needed? |
| Commercial Finance | What invoice, claim, payment, retention, certificate, and account-facing actions are needed? |
| Procurement | What supplier, RFQ, quotation, award, PO, and sourcing actions are needed? |
| Quantity Surveying | What BOQ, measurement, valuation, variation, cost planning, and contract-admin actions are needed? |
| Construction Operations | What site, progress, defect, inspection, handover, and field-report actions are needed? |
| Business Operations | What cross-domain approvals, tasks, cases, registers, and SOP actions are needed? |
| Integration/Vendor | What external systems need dedicated connector packs? |
| Solution/Template Packs | Which packs should provide templates and orchestration without duplicating nodes? |

The final pack catalogue may use different names, split domains differently, or introduce new families. The test-era pack names are references only.

### Capability Discovery Questions

For each proposed pack:

- What business capability does it own?
- Which user roles need it?
- Which workflow templates depend on it?
- Which resources does it create or consume?
- Which Knowledge Packs does it require or recommend?
- Which other packs should it depend on?
- Which current prototype nodes map into it?
- Which current prototype nodes should be removed?

---

## 8. Node Indexing Model

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
| Input pattern | manual, resource, event, Knowledge Pack, API | resource |
| Output pattern | resource, artifact, event, decision | decision |
| Template usage | workflow templates using it | RFQ to Comparison |
| Dependency | packs/Knowledge Packs required | supplier catalogue |

This index allows the UI and AI to filter nodes intelligently instead of showing one giant alphabetic list.

---

## 9. Node Naming and Type Rules

New target node types must be stable and namespaced:

```text
lados.<pack>.<verb>_<object>
```

Illustrative examples only:

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

## 10. Overlap Control

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

Phase 20A should define a canonical capability registry before any new official node catalogue is accepted:

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

Before a new node is accepted, it should be checked against canonical capability keys. Current prototype nodes must also be checked. Any prototype node without a clear canonical capability key should be deprecated or removed.

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

## 11. Workflow Templates at Scale

Hundreds or thousands of nodes should not be the main user experience.

Users should start from:

- business operation templates
- role-based templates
- industry templates
- AI-generated drafts constrained by installed packs
- search results grouped by business intent

### 11.1 Template Ownership

Templates should be owned by either:

| Owner | Template type |
|---|---|
| Capability Pack | pack-native examples |
| Solution Pack | full business operation templates |
| Organization | internal SOP workflows |
| Marketplace Publisher | specialized workflow packs |

### 11.2 Template Manifest Fields

Every workflow template should declare:

- template id
- display name
- business process
- owner pack
- required packs
- optional packs
- required Knowledge Packs
- required workspace resources
- expected inputs
- expected outputs
- user role
- industry/domain tags
- maturity level: demo, draft, production-ready
- verification status

### 11.3 Template Examples

| Template | Owner | Required packs | Required Knowledge Packs |
|---|---|---|---|
| Submit Invoice to Approval | target commercial/finance pack | commercial finance, resource, communication | invoice rules |
| RFQ to Quotation Comparison | target procurement pack | procurement, document intelligence, supplier | supplier catalogue |
| Progress Claim Evidence Check | target QS/contractor solution pack | QS, construction operations, document intelligence | claim evidence rules |
| Defect Report to Notification | target construction operations pack | construction operations, communication | defect classification rules |

---

## 12. UI Discovery Model

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
- "Requires these Knowledge Packs"

The AI designer should use the same index, so AI and UI produce consistent recommendations.

---

## 13. Capability Pack Manifest Extensions

Current `.ladosPack` manifest is enough for Phase 18 registry install, but it is not enough for the future official Capability Pack catalogue. Phase 20A should plan richer metadata:

```json
{
  "id": "lados.target-procurement",
  "displayName": "Lados Procurement",
  "version": "1.0.0",
  "layer": "domain",
  "domains": ["procurement"],
  "capabilities": ["rfq", "supplier", "quotation", "award"],
  "dependsOnPacks": ["lados.document-intelligence", "lados.communication"],
  "suggestedDataPacks": ["supplier.catalogue", "procurement.rules"],
  "nodes": [],
  "templates": [],
  "canonicalCapabilities": []
}
```

Node declarations should add:

```json
{
  "type": "lados.target-procurement.compare_quotations",
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

## 14. Greenfield Planning Workflow

Phase 20A should proceed in this order:

1. List business operation areas Lados must serve now and in the future.
2. Group operations into capability domains.
3. Define target pack boundaries.
4. Draft canonical capability keys.
5. Map workflow templates to capability keys.
6. Map Knowledge Pack requirements to templates and capabilities.
7. Audit current prototype packs/nodes against the target catalogue.
8. Mark each current node as keep, rename, merge, split, deprecate, or remove.
9. Draft target pack manifests and template manifests.
10. Only then start implementation/refactoring.

This keeps Lados from being trapped by early prototype structure.

---

## 15. Governance Checklist

Before a Capability Pack is accepted:

- [ ] Pack has a clear ownership boundary.
- [ ] Pack declares layer.
- [ ] Pack declares dependencies.
- [ ] Pack was designed from target capability map, not copied from prototype folders.
- [ ] Pack does not duplicate canonical nodes.
- [ ] Nodes have canonical capability keys.
- [ ] Nodes use professional display names.
- [ ] Prototype/test nodes have a keep/rename/merge/split/deprecate/remove decision.
- [ ] High-input nodes use resource/input strategy, not canvas clutter.
- [ ] Templates declare required packs and Knowledge Packs.
- [ ] Events/resources/permissions are declared.
- [ ] Pack has README and examples.
- [ ] Pack has smoke test or manual verification path.

---

## 16. Phase 20A Deliverables

- Capability Pack taxonomy.
- Target capability domain map.
- Node indexing model.
- Canonical capability registry model.
- Overlap-control rules.
- Template ownership and manifest model.
- UI discovery model.
- Manifest extension proposal.
- Prototype retirement/migration plan.
- Governance checklist.

---

## 17. Success Criteria

Phase 20A succeeds when Lados can answer:

- What are the new target Capability Packs?
- Which pack owns this capability?
- Is this node a duplicate?
- Which templates use this node?
- Which Knowledge Packs does this template need?
- How does a user find the right node among thousands?
- How does AI choose nodes consistently with the UI?
- Which current prototype nodes should be removed or migrated?

Only after this is clear should Phase 20B professional bundles and Phase 20C marketplace Knowledge Packs proceed.
