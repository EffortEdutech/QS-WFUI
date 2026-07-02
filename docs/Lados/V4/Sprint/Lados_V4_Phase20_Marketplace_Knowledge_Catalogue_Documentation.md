# Lados V4 Phase 20 Sprint Plan: Marketplace Knowledge Catalogue Documentation

**Document ID:** LADOS-V4-SPRINT-P20-MARKETPLACE-KNOWLEDGE  
**Phase:** 20  
**Status:** Active documentation phase  
**Date:** 2026-07-02  

---

## 1. Phase 20 Objective

Document the future Lados Marketplace as an AI-ready knowledge catalogue platform.

Phase 20 should not start by coding more marketplace UI. It should first define the business, product, data, screen, trust, and implementation model for supplier/seller Data Packs.

The central decision:

> Lados Marketplace is not only a pack marketplace. It is a catalogue marketplace where suppliers and sellers subscribe to publish structured knowledge that AI agents and workflows can search, cite, compare, and use.

---

## 2. Why This Phase Exists

AI conversational search will reduce the value of traditional website-only strategies. A supplier page may still exist, but AI agents need structured, retrievable, source-aware knowledge.

Data Packs become the carrier of that knowledge.

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

- Marketplace strategy
- Supplier Data Pack model
- Data Pack publisher requirements
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
| Marketplace direction | AI-ready knowledge catalogue, not only app store |
| Supplier unit | Supplier Profile plus Data Pack Listings |
| Publishable product | Data Pack version with collections and items |
| Runtime behavior | Data is non-executable and source-aware |
| AI behavior | Search, summarize, cite, compare, and hand off to workflow |
| Trust model | Verification status, source metadata, stale-data warnings |
| Commercial boundary | Advisory until human/project confirmation |

---

## 5. Documentation Work Packages

### P20-001 - Marketplace Strategy Paper

Create the strategic paper explaining:

- why AI search changes supplier websites
- why structured catalogues matter
- why Data Packs are the Lados catalogue unit
- how Lados can become the agentic catalogue layer for suppliers/sellers

Output:

- `Design/Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Strategy.md`

Acceptance:

- [x] Explains AI-search business shift.
- [x] Defines Lados as supplier/seller knowledge catalogue agent.
- [x] Links Data Packs to marketplace business model.

### P20-002 - Supplier Data Pack Specification

Define:

- supplier profile fields
- Data Pack listing fields
- Data Pack item fields
- product/service/rate/evidence catalogue structures
- source, assumption, and verification metadata

Acceptance:

- [ ] Required metadata fields are listed.
- [ ] Supplier catalogue examples are provided.
- [ ] Official vs supplier-provided data distinction is documented.

### P20-003 - AI Retrieval and Search Requirements

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

### P20-004 - Marketplace Screen Specification

Define screens:

- Marketplace Home
- Data Pack Browse
- Supplier Profile
- Data Pack Detail
- Item Detail
- Publish Data Pack
- Review Queue
- Installed Knowledge
- AI Search Preview

Acceptance:

- [ ] Each screen has purpose, primary actions, empty state, and data dependencies.
- [ ] Buyer and supplier journeys are both represented.

### P20-005 - Governance and Verification Checklist

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

### P20-006 - Business Model Notes

Define:

- subscription tiers
- supplier publishing rights
- featured listing ideas
- workflow-integrated supplier model
- marketplace analytics direction

Acceptance:

- [ ] Business tiers are documented.
- [ ] Buyer and supplier value propositions are documented.

### P20-007 - Phase 21+ Implementation Backlog

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
Supplier Profile
  -> Data Pack Listing
    -> Data Pack Version
      -> Collections
        -> Items
          -> Source / Evidence / Region / Unit / Availability

Lados AI Search
  -> reads marketplace and installed Data Packs
  -> ranks by relevance, region, freshness, verification, workflow fit
  -> cites Data Pack provenance
  -> inserts selected item references into workflow nodes

Workflow Runtime
  -> resolves Data Pack item ids
  -> logs data_pack_usages
  -> shows provenance in Execution Log
```

---

## 7. Phase 20 Done Criteria

- [ ] Marketplace strategy paper complete.
- [ ] Supplier Data Pack specification complete.
- [ ] AI retrieval requirements complete.
- [ ] Marketplace screen specification complete.
- [ ] Governance checklist complete.
- [ ] Business model notes complete.
- [ ] Phase 21+ implementation backlog complete.
- [ ] Existing P18P-P20 plan updated to show Phase 20 documentation pivot.
- [ ] V4 README links updated.

---

## 8. Handover

### 2026-07-02 - Phase 20 documentation kickoff

Done:
- Reframed Phase 20 as Marketplace Knowledge Catalogue documentation.
- Captured AI-search shift and supplier/seller Data Pack marketplace thesis.
- Created strategy paper and sprint plan.

Next:
- Expand supplier Data Pack specification.
- Draft Marketplace screen specification.
- Draft AI retrieval result shape and governance checklist.

Ad-hoc:
- Phase 19C runtime provenance test remains deferred until a workflow can practically include a Data Pack item.

Docs updated:
- `Design/Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Strategy.md`
- `Sprint/Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Documentation.md`

Verification:
- Documentation-only phase; no code verification required.
