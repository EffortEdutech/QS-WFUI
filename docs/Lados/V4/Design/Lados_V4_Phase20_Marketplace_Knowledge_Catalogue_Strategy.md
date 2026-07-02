# Lados V4 Phase 20 Strategy: Marketplace as AI Knowledge Catalogue

**Document ID:** LADOS-V4-P20-KNOWLEDGE-CATALOGUE  
**Phase:** 20  
**Status:** Draft for implementation alignment  
**Date:** 2026-07-02  

---

## 1. Strategic Thesis

Search is shifting from "user types query, search engine returns links" to "user asks an AI agent, AI agent searches structured knowledge and answers conversationally."

In that world, a conventional supplier website is no longer enough. The winning asset is not only a web page. The winning asset is a structured, trusted, continuously updated knowledge catalogue that AI systems can understand, cite, filter, compare, and act on.

Lados Data Packs become that catalogue layer.

Lados Marketplace should therefore evolve from a simple pack store into a governed knowledge marketplace where suppliers, sellers, manufacturers, consultants, and service providers publish structured Data Packs that can be discovered by:

- Lados workflow agents
- Lados marketplace search
- project workflows
- QS/commercial workflows
- future external AI search engines and agentic procurement systems

The marketplace is not only for downloading tools. It is a commercial knowledge distribution network.

---

## 2. Future Business Position

Lados becomes an agent for supplier/seller knowledge catalogues.

The business pattern is close to an Alibaba/AliExpress-style discovery marketplace, but optimized for AI-era procurement and professional workflows:

| Old marketplace model | Lados AI knowledge catalogue model |
|---|---|
| Seller uploads product page | Seller publishes structured Data Pack |
| User browses pages manually | AI agent searches, filters, ranks, and explains |
| SEO targets human search engine result pages | Knowledge catalogue targets AI retrieval and workflow use |
| Product data is mostly text/images | Product data is schema-rich, source-aware, versioned, and comparable |
| Website conversion is the main goal | Workflow selection, RFQ, quotation, compliance, and procurement action are the goals |

This means suppliers can subscribe to Lados not only for visibility, but for machine-readable commercial presence inside construction, QS, procurement, and operating workflows.

---

## 3. Data Pack as Marketplace Unit

A Data Pack is a non-executable, versioned knowledge product.

For Phase 20, the important marketplace unit is not only `.ladosPack`. It is:

```text
Supplier / Seller
  -> Marketplace Profile
  -> Data Pack Listing
  -> Data Pack Version
  -> Collections
  -> Items
  -> Evidence, pricing, compliance, availability, region, source metadata
```

Example supplier Data Packs:

| Supplier type | Data Pack examples |
|---|---|
| Material supplier | Concrete grades, steel bars, waterproofing systems, delivery zones |
| Plant supplier | Excavators, cranes, rental rates, capacity, location, availability |
| Specialist subcontractor | Trade capabilities, certifications, past project types, productivity assumptions |
| Manufacturer | Product systems, warranties, technical sheets, compliance certificates |
| Consultant | Standard details, checklists, advisory rules, scope templates |
| QS/contract library provider | Rates, preliminaries, measurement rules, evidence rules |

---

## 4. Naming Boundaries

The marketplace must keep these names distinct:

| Name | Meaning | Executes code? |
|---|---|---|
| Capability Pack | Adds nodes, tools, workflow capabilities, manifests | Not from uploaded runtime in current phase |
| Data Pack | Adds structured knowledge, catalogues, rates, rules, product data | No |
| Workspace Resource | Project-owned file/data uploaded or created inside a workspace | No |
| Resource Binding | Mapping between workflow/node config and project resources | No |
| Supplier Profile | Commercial identity that owns or publishes catalogue listings | No |
| Marketplace Listing | Public/commercial wrapper around a pack or Data Pack | No |

This naming is important because Lados must not confuse executable capability with supplier knowledge.

---

## 5. AI Search Readiness Requirements

Every marketplace Data Pack should be designed for AI retrieval.

### 5.1 Required Listing Metadata

- supplier/seller name
- legal or trading name
- region/country/city coverage
- trade/category classification
- product/service taxonomy
- keywords and synonyms
- supported units
- currency
- update frequency
- source type
- verification status
- contact or RFQ route
- commercial terms summary

### 5.2 Required Item Metadata

- item key
- item title
- item description
- category path
- region
- unit
- price/rate/value where applicable
- effective date
- source name
- source date
- source URL or document reference
- assumptions
- exclusions
- compliance tags
- warranty/certification references
- availability status
- lead time where applicable
- human-review advisory flag

### 5.3 Retrieval Requirements

The marketplace should support:

- natural-language search
- structured filters
- semantic tags
- region-aware ranking
- source-aware ranking
- freshness scoring
- supplier verification scoring
- workflow compatibility scoring
- RFQ readiness scoring

---

## 6. Marketplace User Journeys

### 6.1 Supplier Publishes Catalogue

1. Supplier creates marketplace profile.
2. Supplier uploads or edits a Data Pack.
3. Lados validates schema and required fields.
4. Lados marks missing evidence, stale dates, or unclear assumptions.
5. Supplier submits for verification.
6. Admin verifies listing.
7. Data Pack becomes searchable and installable.

### 6.2 Buyer Searches Through AI

1. User asks: "Find waterproofing suppliers for basement works in Klang Valley."
2. Lados searches installed and marketplace Data Packs.
3. Lados returns suppliers, products, assumptions, and source evidence.
4. User selects items into workflow or RFQ.
5. Workflow logs Data Pack provenance.

### 6.3 Workflow Consumes Supplier Knowledge

1. Node config references Data Pack items.
2. Runtime resolves item metadata.
3. Execution uses item values as advisory/contextual data.
4. Execution log records source, supplier, version, and assumptions.
5. Human reviewer approves or rejects commercial use.

---

## 7. Marketplace Product Surfaces

Phase 20 documentation should define these future screens before implementation:

| Surface | Purpose |
|---|---|
| Marketplace Home | Search-first entry for Capability Packs and Data Packs |
| Data Pack Browse | Search supplier and official catalogues |
| Supplier Profile | Commercial identity, verification, contact/RFQ route |
| Data Pack Detail | Versioned collections, provenance, install/subscribe |
| Item Detail | Source-aware product/rate/rule/evidence record |
| Publish Data Pack | Supplier upload/editor flow |
| Review Queue | Admin verification of supplier catalogues |
| Installed Knowledge | Organization-installed Data Packs |
| AI Search Preview | Shows how Lados agent will interpret the catalogue |

---

## 8. Commercial Model

Potential supplier/seller subscription tiers:

| Tier | Capability |
|---|---|
| Free Listing | Supplier profile and limited catalogue visibility |
| Catalogue Publisher | Publishes verified Data Packs |
| Featured Supplier | Boosted marketplace ranking and richer profile |
| Workflow Integrated Supplier | Items can be inserted into RFQ/procurement workflows |
| Enterprise Catalogue API | Automated catalogue updates through API/import |

Buyer-side value:

- faster supplier discovery
- structured RFQ preparation
- source-aware rate/product comparison
- reduced manual searching
- workflow-ready procurement data

Supplier-side value:

- AI-search visibility
- workflow-level commercial presence
- structured lead generation
- product data distribution without building custom integrations
- improved trust through verification and provenance

---

## 9. Governance and Trust

Data Pack Marketplace must not become a blind advertising surface.

Rules:

- Supplier-provided data is labelled supplier-provided.
- Official/reference data is labelled official/reference.
- Rates and prices are advisory until confirmed.
- Every commercial item needs source/date/assumptions.
- AI answers must cite Data Pack provenance.
- Workflows must log Data Pack versions used.
- Verification status must be visible.
- Expired/stale items must be marked.

For QS and construction workflows, Lados must keep the professional boundary:

```text
Data Pack suggests.
Workflow applies.
Human approves.
Execution log proves provenance.
```

---

## 10. Phase 20 Documentation Deliverables

Phase 20 is documentation-first and should produce:

1. Marketplace knowledge-catalogue strategy.
2. Data Pack publisher specification.
3. Supplier profile and listing specification.
4. AI search and retrieval requirements.
5. Marketplace screen specification.
6. Verification and governance checklist.
7. Business model notes.
8. Implementation backlog for Phase 21+.

---

## 11. Phase 21+ Implementation Direction

After Phase 20 documentation is accepted, implementation can proceed in smaller phases:

| Future phase | Focus |
|---|---|
| 21 | Supplier profile and publisher account model |
| 22 | Data Pack publish/upload/review flow |
| 23 | AI catalogue search and retrieval ranking |
| 24 | RFQ/procurement workflow integration |
| 25 | Supplier subscription and marketplace analytics |

---

## 12. Success Criteria

Phase 20 succeeds when the team can answer:

- What does a supplier publish?
- How does an AI agent search it?
- How does a buyer trust it?
- How does a workflow consume it?
- How does Lados monetize it?
- How does the marketplace stay different from a normal website directory?

The output should make Lados Marketplace feel like infrastructure for AI-era commercial knowledge, not just another app store.
