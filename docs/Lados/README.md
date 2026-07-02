# Lados Documentation Library

**Engine:** Lados Core Engine (LCE) V1  
**Date:** 2026-07-02  
**Status:** Living library — updated as each phase completes

> **Current development track:** `V4/` — see [V4/README.md](V4/README.md).
> Build progress lives in [V4/Sprint/Lados_V4_Master_Checklist.md](V4/Sprint/Lados_V4_Master_Checklist.md) (P01–P18) and [V4/Sprint/Lados_V4_P18P-P20_Master_Checklist.md](V4/Sprint/Lados_V4_P18P-P20_Master_Checklist.md) (P18P–P20).
> Production deployment plan: [V4/Sprint/Lados_V4_Audit_and_Production_Deployment_Sprint_Plan.md](V4/Sprint/Lados_V4_Audit_and_Production_Deployment_Sprint_Plan.md) (PD-1 → PD-6).

---

## Three Layers

| Layer | Question | Audience |
|---|---|---|
| **Architecture** | What is Lados? | Decision makers, architects, new team members |
| **Engine** | How does Lados work? | Platform engineers building or extending the engine |
| **Developer** | How do I build with Lados? | Solution and pack developers building on the engine |

---

## Library Structure

```
Lados Documentation
│
├── 01 LCE Architecture      Layer 1 — What is Lados?
├── 02 LCE Runtime           Layer 2 — How does the engine execute?
├── 03 LCE SDK               Layer 2 — How are nodes and packs built?
├── 04 LCE Platform          Layer 2 — How does the platform layer work?
├── 05 LCE Intelligence      Layer 2 — How does AI work inside LCE?
├── 06 LCE Ecosystem         Layer 2 — How are packs published and managed?
├── 07 LCE Reference         Layer 3 — Catalogs, schemas, and standards
│
├── 20 Contractor Edition    Layer 3 — First LCE solution
│
└── 50 LEOS                  Layer 3 — Future enterprise blueprint (deferred)
```

---

## Sections

| File | Title | Covers |
|---|---|---|
| [01_LCE_Architecture.md](01_LCE_Architecture.md) | LCE Architecture | Introduction, identity, design principles, monorepo, tech stack |
| [02_LCE_Runtime.md](02_LCE_Runtime.md) | LCE Runtime | API host, web app, database, Workflow Engine, execution model |
| [03_LCE_SDK.md](03_LCE_SDK.md) | LCE SDK | @lados/node-sdk, @lados/pack-sdk, @lados/execution-engine, @lados/shared-types, @lados/workflow-json |
| [04_LCE_Platform.md](04_LCE_Platform.md) | LCE Platform | Resource Engine, Security, API reference, Storage, Deployment |
| [05_LCE_Intelligence.md](05_LCE_Intelligence.md) | LCE Intelligence | AI Runtime, context builder, tool calling, output ledger, guardrails |
| [06_LCE_Ecosystem.md](06_LCE_Ecosystem.md) | LCE Ecosystem | Marketplace, pack lifecycle, installer, registry |
| [07_LCE_Reference.md](07_LCE_Reference.md) | LCE Reference | Event system, state engine, UI framework, testing, glossary, catalogs |
| [20_Contractor_Edition.md](20_Contractor_Edition.md) | Contractor Edition | First LCE solution — small contractor validation |
| [50_LEOS.md](50_LEOS.md) | LEOS | Deferred enterprise and government blueprint |

---

## Implementation Status (as of 2026-07-02)

> This table is a summary only. The **single source of truth** for build progress is the V4 Sprint checklists linked above — do not update phase status here.

| Track | Status |
|---|---|
| V4 Phases 1–18 (foundation → external marketplace) | ✅ Complete |
| Phase 18P — Marketplace polish | ✅ Complete |
| Phase 19 — Data Pack Engine | ✅ Complete |
| Phase 19C — Runtime provenance logging | Implemented; runtime/browser verification in PD-1 |
| Phase 20 — Marketplace Knowledge Catalogue documentation | Active |
| Phase 20B — Professional Pack Bundles | Not started |
| PD-1 → PD-6 — Production Deployment track | **Active — PD-1 in progress** |
| LEOS / JKR blueprint | Deferred |

---

*This library supersedes all earlier QS-OS, V3, and @qsos/ documents.*  
*Historical documents are preserved in `docs/raw/` for reference only.*
