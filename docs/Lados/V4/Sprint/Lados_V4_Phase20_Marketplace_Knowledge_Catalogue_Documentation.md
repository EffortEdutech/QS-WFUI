# Lados V4 Phase 20 Sprint Plan: Marketplace Knowledge Catalogue Documentation

**Document ID:** LADOS-V4-SPRINT-P20-MARKETPLACE-KNOWLEDGE  
**Phase:** 20  
**Status:** Active documentation phase  
**Date:** 2026-07-02  

---

## 1. Phase 20 Objective

Document the future Lados Marketplace as an AI-ready knowledge catalogue platform, starting with a greenfield Capability Pack plan before Marketplace Knowledge Pack expansion.

Phase 20 should not start by coding more marketplace UI. It should first define the new target Capability Pack taxonomy and node governance model, then define the business, product, knowledge, screen, trust, and implementation model for supplier/seller Knowledge Packs.

The central decision:

> Lados Marketplace is not only a pack marketplace. It is a catalogue marketplace where suppliers and sellers subscribe to publish structured knowledge that AI agents and workflows can search, cite, compare, and use.

---

## 2. Why This Phase Exists

AI conversational search will reduce the value of traditional website-only strategies. A supplier page may still exist, but AI agents need structured, retrievable, source-aware knowledge.

Capability Packs are the operating grammar of Lados. Knowledge Packs become the carrier of marketplace knowledge.

Phase 20 prepares Lados to serve:

- suppliers
- sellers
- manufacturers
- subcontractors
- consultants
- QS data providers
- contractors and buyers
- AI agents searching for commercial/project knowledge

---

## 3. Phase 20 Scope

### In Scope

- Capability Pack planning and node taxonomy
- current prototype pack/node retirement plan
- canonical node ownership and overlap control
- workflow template ownership and indexing
- Marketplace strategy
- Supplier Knowledge Pack model
- Knowledge Pack publisher requirements
- AI search and retrieval requirements
- marketplace information architecture
- supplier profile model
- review and verification rules
- business model options
- Phase 21+ implementation backlog

### Out of Scope

- Executing uploaded external runtime code
- Payment/subscription implementation
- Public SEO pages
- Full vector search implementation
- Automated supplier onboarding
- Production billing

---

## 4. Key Product Decisions

| Decision | Position |
|---|---|
| Phase 20 ordering | New target Capability Packs first, Marketplace Knowledge Packs second |
| Capability Pack role | Actions, nodes, templates, workflow operating grammar |
| Current packs | Prototype/test assets, not binding target architecture |
| Marketplace direction | AI-ready knowledge catalogue, not only app store |
| Supplier unit | Supplier Profile plus Knowledge Pack Listings |
| Publishable product | Knowledge Pack version with collections and items |
| Runtime behavior | Data is non-executable and source-aware |
| AI behavior | Search, summarize, cite, compare, and hand off to workflow |
| Trust model | Verification status, source metadata, stale-data warnings |
| Commercial boundary | Advisory until human/project confirmation |

---

## 5. Documentation Work Packages

### P20-000 - Naming Lock

Lock the product terms before further marketplace planning:

- Capability Pack: workflow capabilities, nodes, templates, and action grammar
- Knowledge Pack: governed knowledge catalogues, supplier listings, standards references, SOPs, compliance rules, technical guidelines, rates, and evidence rules
- Data Pack: legacy Phase 19 technical implementation term for existing database/API/test identifiers

Output:

- `Design/Lados_V4_Phase20_Naming_Lock_Capability_Packs_Knowledge_Packs.md`

Acceptance:

- [x] Capability Pack term is locked.
- [x] Knowledge Pack term is locked.
- [x] Data Pack is documented as legacy technical terminology.
- [x] Active Phase 20 docs use Knowledge Pack for product language.

### P20-001 - Capability Pack Planning and Node Taxonomy

Create the Capability Pack planning paper explaining:

- how packs are layered
- how pack ownership boundaries work
- how nodes are indexed
- how canonical node capability keys prevent overlap
- how workflow templates are owned and indexed
- how users and AI find the right node among hundreds or thousands
- how current prototype packs/nodes are kept, renamed, merged, deprecated, or removed

Output:

- `Design/Lados_V4_Phase20A_Capability_Pack_Planning_and_Node_Taxonomy.md`

Acceptance:

- [x] Capability Pack taxonomy is documented.
- [x] Node indexing model is documented.
- [x] Overlap-control rules are documented.
- [x] Workflow template ownership is documented.
- [x] Manifest extension direction is documented.
- [x] Prototype reset policy is documented.

### P20-002 - Marketplace Strategy Paper

Create the strategic paper explaining:

- why AI search changes supplier websites
- why structured catalogues matter
- why Knowledge Packs are the Lados catalogue unit
- how Lados can become the agentic catalogue layer for suppliers/sellers

Output:

- `Design/Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Strategy.md`

Acceptance:

- [x] Explains AI-search business shift.
- [x] Defines Lados as supplier/seller knowledge catalogue agent.
- [x] Links Knowledge Packs to marketplace business model.

### P20-003 - Supplier Knowledge Pack Specification

Define:

- supplier profile fields
- Knowledge Pack listing fields
- Knowledge Pack item fields
- product/service/rate/evidence catalogue structures
- source, assumption, and verification metadata

Acceptance:

- [ ] Required metadata fields are listed.
- [ ] Supplier catalogue examples are provided.
- [ ] Official vs supplier-provided data distinction is documented.

### P20-004 - AI Retrieval and Search Requirements

Define:

- natural language search behavior
- ranking factors
- freshness scoring
- verification scoring
- region and trade filters
- workflow compatibility scoring
- answer citation requirements

Acceptance:

- [ ] AI search requirements are written.
- [ ] Retrieval result shape is documented.
- [ ] AI answer provenance rules are documented.

### P20-005 - Marketplace Screen Specification

Define screens:

- Marketplace Home
- Knowledge Pack Browse
- Supplier Profile
- Knowledge Pack Detail
- Item Detail
- Publish Knowledge Pack
- Review Queue
- Installed Knowledge
- AI Search Preview

Acceptance:

- [ ] Each screen has purpose, primary actions, empty state, and data dependencies.
- [ ] Buyer and supplier journeys are both represented.

### P20-006 - Governance and Verification Checklist

Define:

- verification statuses
- stale data rules
- supplier-provided disclaimers
- QS/commercial advisory boundaries
- audit/provenance rules
- human approval requirements

Acceptance:

- [ ] Review checklist exists.
- [ ] Human approval language is standardized.
- [ ] Stale/expired data handling is documented.

### P20-007 - Business Model Notes

Define:

- subscription tiers
- supplier publishing rights
- featured listing ideas
- workflow-integrated supplier model
- marketplace analytics direction

Acceptance:

- [ ] Business tiers are documented.
- [ ] Buyer and supplier value propositions are documented.

### P20-008 - Phase 21+ Implementation Backlog

Convert documentation into implementable backlog:

- database migrations
- API endpoints
- frontend screens
- AI retrieval service
- admin review flow
- tests and browser verification

Acceptance:

- [ ] Phase 21+ backlog is created.
- [ ] Dependencies and sequencing are clear.

---

## 6. Proposed Future Architecture

```text
Capability Pack
  -> Pack taxonomy and ownership boundary
  -> Canonical capability keys
  -> Nodes
  -> Workflow templates
  -> Required lower-layer packs
  -> Suggested/required Knowledge Packs

Supplier Profile
  -> Knowledge Pack Listing
    -> Knowledge Pack Version
      -> Collections
        -> Items
          -> Source / Evidence / Region / Unit / Availability

Lados AI Search
  -> reads marketplace and installed Knowledge Packs
  -> ranks by relevance, region, freshness, verification, workflow fit
  -> cites Knowledge Pack provenance
  -> inserts selected item references into workflow nodes

Workflow Runtime
  -> resolves Knowledge Pack item ids
  -> logs data_pack_usages
  -> shows provenance in Execution Log
```

Note: `data_pack_usages` is the current Phase 19C technical column name. Product documentation should use **Knowledge Pack provenance** unless referring to existing database/API identifiers.

---

## 7. Phase 20 Done Criteria

- [x] Capability Pack planning paper complete.
- [x] Node taxonomy and overlap-control model drafted.
- [x] Marketplace strategy paper complete.
- [ ] Supplier Knowledge Pack specification complete.
- [ ] AI retrieval requirements complete.
- [ ] Marketplace screen specification complete.
- [ ] Governance checklist complete.
- [ ] Business model notes complete.
- [ ] Phase 21+ implementation backlog complete.
- [x] Existing P18P-P20 plan updated to show Phase 20 documentation pivot.
- [x] V4 README links updated.

---

## 8. Handover

### 2026-07-02 - Phase 20 documentation kickoff

Done:
- Reframed Phase 20 as Marketplace Knowledge Catalogue documentation.
- Added Capability Packs as the first Phase 20 documentation priority before Marketplace Knowledge Packs.
- Captured AI-search shift and supplier/seller Knowledge Pack marketplace thesis.
- Created strategy paper and sprint plan.
- Created Capability Pack planning and node taxonomy paper.

Next:
- Review and refine Capability Pack taxonomy and official pack boundaries.
- Draft the new target Capability Pack catalogue without being constrained by current pack families.
- Classify current prototype packs/nodes as keep, rename, merge, split, deprecate, or remove.
- Expand supplier Knowledge Pack specification after Capability Pack planning is accepted.
- Draft Marketplace screen specification.
- Draft AI retrieval result shape and governance checklist.

Ad-hoc:
- Phase 19C runtime provenance test remains deferred until a workflow can practically include a Knowledge Pack item.

Docs updated:
- `Design/Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Strategy.md`
- `Design/Lados_V4_Phase20_Naming_Lock_Capability_Packs_Knowledge_Packs.md`
- `Design/Lados_V4_Phase20A_Capability_Pack_Planning_and_Node_Taxonomy.md`
- `Sprint/Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Documentation.md`

Verification:
- Documentation-only phase; no code verification required.
