# Lados V4 Phase 20 Naming Lock: Capability Packs and Knowledge Packs

**Document ID:** LADOS-V4-P20-NAMING-LOCK  
**Phase:** 20  
**Status:** Locked naming decision  
**Date:** 2026-07-02  

---

## 1. Locked Terms

Lados V4 now has two locked marketplace/platform package concepts:

| Locked term | Meaning | Primary contents | Executes workflow logic? |
|---|---|---|---|
| Capability Pack | Package of workflow capabilities | nodes, actions, templates, manifests, config schemas, events, permissions | Yes, through approved Lados runtime boundaries |
| Knowledge Pack | Package of governed knowledge | standards references, supplier catalogues, SOPs, compliance rules, technical guidelines, rate libraries, evidence rules | No |

These names should be used in product documentation, UI copy, planning documents, marketplace strategy, and user-facing language.

---

## 2. Why Data Pack Becomes Knowledge Pack

The old name **Data Pack** is too narrow.

It suggests tables, rates, or simple datasets only. Lados needs a broader concept that includes:

- industry standard references
- Malaysian Standards and ISO reference metadata
- regulatory/compliance requirements
- company and operational SOPs
- technical guidelines
- codes of practice
- white papers
- supplier and seller catalogues
- rate/cost references
- evidence and validation rules

The correct product concept is therefore **Knowledge Pack**.

Knowledge Packs are the governed knowledge layer of Lados.

---

## 3. Technical Compatibility Note

The existing Phase 19 implementation uses database/API names such as:

- `data_packs`
- `data_pack_versions`
- `data_pack_collections`
- `data_pack_items`
- `org_data_pack_installs`
- `data_pack_usages`
- `data_pack_item`

These are now considered **legacy technical identifiers** from the first implementation slice.

Product and architecture documents should use **Knowledge Pack** going forward. A future migration may rename database/API identifiers, but that should be handled deliberately in a compatibility phase because existing code, migrations, tests, and run logs already depend on the `data_pack_*` names.

Until that migration:

```text
Product/domain term: Knowledge Pack
Legacy technical implementation: data_pack_*
```

---

## 4. Knowledge Pack Types

Knowledge Packs should be typed. Not all knowledge has the same governance, licensing, or marketplace behavior.

| Knowledge Pack type | Purpose | Examples |
|---|---|---|
| Supplier Catalogue Pack | Supplier/seller product and service catalogue | concrete supplier catalogue, plant rental catalogue |
| Standards Reference Pack | Industry standard references and licensed/allowed metadata | MS references, ISO references, BS/ASTM metadata |
| Regulatory Compliance Pack | Statutory and regulatory obligations | CIDB, DOSH, Bomba, local authority requirements |
| Company SOP Pack | Private organization procedures and playbooks | procurement SOP, invoice approval SOP |
| Technical Guideline Pack | Technical guidance, codes of practice, white papers | waterproofing guide, method statement guide |
| Rate and Cost Pack | Rates, price references, cost libraries, indices | QS rate library, preliminaries assumptions |
| Evidence Rule Pack | Required evidence and validation logic for workflows | progress claim evidence rules, variation evidence checklist |
| Contract/Clause Reference Pack | Contract clauses, entitlement references, administration rules | PAM/JKR clause mapping, project-specific contract references |

---

## 5. Governance Separation

Capability Packs and Knowledge Packs must have separate governance.

### Capability Pack Governance

Capability Packs need:

- node ownership
- capability taxonomy
- canonical capability keys
- overlap control
- runtime safety
- event/resource/permission declarations
- template ownership
- executor testing

### Knowledge Pack Governance

Knowledge Packs need:

- source provenance
- versioning
- jurisdiction/region
- effective dates
- copyright/licensing status
- access control
- verification status
- stale/expired markers
- assumptions/exclusions
- human-review boundaries

---

## 6. Standards, Regulations, SOPs, and Copyright

Industry standards and regulations must be handled carefully.

Lados should not assume it can freely store or reproduce full protected documents such as ISO or Malaysian Standards. The safe default is:

- store metadata and references
- store allowed summaries/checklists where permitted
- store organization-owned SOP text where the organization has rights
- store licensed documents only behind access controls
- record source, publisher, date, jurisdiction, and licence basis
- cite references in AI answers and workflow logs

Knowledge Packs can point to full documents without copying them when licensing does not allow embedding.

---

## 7. Marketplace Meaning

Lados Marketplace should eventually contain both:

```text
Capability Packs
  -> What Lados can do
  -> Nodes, templates, workflow actions

Knowledge Packs
  -> What Lados can know/reference
  -> Standards, SOPs, catalogues, regulations, rules, rates
```

Supplier/seller marketplace strategy belongs primarily to **Knowledge Packs**, while workflow capability extension belongs to **Capability Packs**.

---

## 8. UI Naming Rules

Use these labels:

| UI area | Label |
|---|---|
| Marketplace tab for executable/action bundles | Capability Packs |
| Marketplace tab for knowledge/catalogue/reference bundles | Knowledge Packs |
| Supplier published catalogue | Supplier Knowledge Pack |
| Internal company SOP bundle | Organization Knowledge Pack |
| Installed governed knowledge | Installed Knowledge |
| Node field selecting governed knowledge | Knowledge Pack Item |

Avoid using "Data Pack" in new UI copy unless referring to legacy Phase 19 implementation or database/API identifiers.

---

## 9. Relationship to Workflow Runtime

Capability Packs and Knowledge Packs meet inside workflow execution:

```text
Capability Pack node
  -> consumes Workspace Resources
  -> resolves Resource Bindings
  -> references Knowledge Pack Items
  -> executes workflow action
  -> logs Knowledge Pack provenance
```

Knowledge Pack values are advisory/reference unless confirmed by project contract, licensed source, statutory authority, or human reviewer.

---

## 10. Locked Decision

From Phase 20 onward:

- **Capability Pack** is locked as the package for actions, nodes, templates, and workflow capabilities.
- **Knowledge Pack** is locked as the package for governed knowledge, catalogues, standards, SOPs, regulations, guidelines, rates, and evidence rules.
- **Data Pack** remains only as legacy technical implementation terminology until a future migration replaces or aliases `data_pack_*` identifiers.

This naming lock should be reflected in all new Phase 20+ planning documents.
