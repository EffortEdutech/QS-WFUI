# Lados V4 — Documentation Index

**Platform:** Lados — Universal Business Workflow Engine  
**Version:** 4.0  
**Repository:** `QS-WFUI` (the git repo retains this name; the platform is Lados)  
**Last Updated:** 2026-06-30

> **Note for new team members:** The git repository is called `QS-WFUI`. This is a legacy name from when the platform targeted Quantity Surveying workflows exclusively. The platform is now called **Lados** and supports universal business workflows across all industries. Do not confuse the repo folder name with the product name.

---

## What Is Lados?

Lados is a **universal business workflow engine** — a visual, pack-based platform for designing, running, and managing automated business processes. Any industry. Any workflow. Built on NestJS + Next.js + Supabase.

The V4 architecture is an evolutionary build on the existing codebase. It is not a rewrite. Packages use the `@lados/` namespace. Packs use the `lados.*` prefix.

---

## Resource Naming

Lados now has two related but different "resource" concepts. Use these names consistently:

| Term | Meaning | Primary storage |
|---|---|---|
| **Workspace Resource** | A real business object such as Job, Invoice, Vehicle, Driver, BOQ, Claim, Variation, or Defect. These appear in `/resources` and Explorer. | `lados_resources` |
| **Resource Binding** | A workflow-level mapping from a node field key to a Workspace Resource. The workflow stores the binding and resolves it at run time. | `resource_bindings` |

UI copy should say **Workspace Resource** when referring to the business record, and **Resource Binding** when referring to the governed workflow mapping.

---

## Folder Structure

```
docs/Lados/V4/
│
├── README.md                          ← you are here
│
├── Sprint/                            ← all sprint planning documents
│   ├── Lados_V4_Master_Checklist.md   ← THE master build checklist (start here)
│   ├── Lados_V4_Sprint_P13-P15_Canvas_UX_ResourceBindings.md
│   ├── Lados_V4_Sprint_P16-P18_Explorer_State_Marketplace.md
│   ├── Lados_V4_Sprint_14A-14B_Canvas_Groups_rgthree.md
│   └── Archive/                       ← completed phases (read-only reference)
│       ├── Lados_V4_Sprint_P01-P02_Foundation.md
│       ├── Lados_V4_Sprint_P10-P11_AI_Runtime.md
│       └── Lados_V4_Sprint_P12-P14_Queue_Registry.md
│
├── Design/                            ← feature design papers & upgrade specs
│   ├── Lados_rgthree_Canvas_Upgrade_Paper.md
│   └── Lados_rgthree_Canvas_Upgrade_Paper.docx
│
├── Volume/                            ← architecture & specification volumes
│   ├── Volume 0  LADOS V4 Architecture Freeze & Migration Blueprint.docx
│   ├── Volume 2  LADOS V4 Node Manifest Specification.docx
│   ├── Volume 3  LADOS V4 Workflow Builder Architecture.docx
│   ├── Volume 4  LADOS V4 Component Specification.docx
│   ├── Volume 5  LADOS V4 Design System.docx
│   ├── Volume 6  LADOS V4 Screen Specification.docx
│   ├── Volume 7  LADOS V4 Figma Build Pack.docx
│   ├── Volume 8  LADOS V4 Frontend Architecture.docx
│   └── Volume 9  LADOS V4 Backend Architecture.docx
│
├── Tests/                             ← PowerShell API test scripts
│   ├── test_phase9.ps1
│   └── test_phase10.ps1
│
├── LADOS V4 Implementation and Refactoring Guide.docx
└── (Sprint/Lados_V4_Master_Checklist.docx — formatted snapshot of the checklist)
```

---

## Where to Start

| I want to… | Go to… |
|---|---|
| Track build progress / tick off tasks | `Sprint/Lados_V4_Master_Checklist.md` |
| Understand what Phase 13–15 involves | `Sprint/Lados_V4_Sprint_P13-P15_Canvas_UX_ResourceBindings.md` |
| Understand what Phase 16–18 involves | `Sprint/Lados_V4_Sprint_P16-P18_Explorer_State_Marketplace.md` |
| Implement Canvas Skill Groups (Sprint 14A) | `Sprint/Lados_V4_Sprint_14A-14B_Canvas_Groups_rgthree.md` |
| Implement Selective Group Execution (Sprint 14B) | `Sprint/Lados_V4_Sprint_14A-14B_Canvas_Groups_rgthree.md` |
| Read the Canvas Groups design paper | `Design/Lados_rgthree_Canvas_Upgrade_Paper.md` |
| Understand the node manifest spec | `Volume/Volume 2 ...Node Manifest Specification.docx` |
| Understand how the workflow builder works | `Volume/Volume 3 ...Workflow Builder Architecture.docx` |
| Understand component APIs | `Volume/Volume 4 ...Component Specification.docx` |
| Understand the backend API design | `Volume/Volume 9 ...Backend Architecture.docx` |
| Read history of how we got here | `Sprint/Archive/` |

---

## Active Sprint Plans (`Sprint/`)

## Next Productization Track

After the V4 architecture phases, the active next track is:

| File | Purpose |
|---|---|
| [Lados_V4_P18P-P20_Master_Checklist.md](Sprint/Lados_V4_P18P-P20_Master_Checklist.md) | Checklist for Phase 18P Marketplace polish, Phase 19 Data Pack Engine, and Phase 20 Marketplace Knowledge Catalogue documentation |
| [Lados_V4_Sprint_P18P-P20_Productization_DataPacks_ProfessionalBundles.md](Sprint/Lados_V4_Sprint_P18P-P20_Productization_DataPacks_ProfessionalBundles.md) | Detailed sprint plan for turning Lados into a full product platform; Phase 20B keeps the professional bundle work |
| [Lados_V4_DataPacks_ProfessionalBundles_Tech_Paper.md](Design/Lados_V4_DataPacks_ProfessionalBundles_Tech_Paper.md) | Technical paper for Data Packs, clean official pack bundles, and QS guardrails |
| [Lados_V4_Phase20A_Capability_Pack_Planning_and_Node_Taxonomy.md](Design/Lados_V4_Phase20A_Capability_Pack_Planning_and_Node_Taxonomy.md) | Phase 20A planning for Capability Pack taxonomy, node indexing, overlap control, and workflow template ownership |
| [Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Strategy.md](Design/Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Strategy.md) | Phase 20 strategy for Marketplace as an AI-ready supplier/seller knowledge catalogue |
| [Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Documentation.md](Sprint/Lados_V4_Phase20_Marketplace_Knowledge_Catalogue_Documentation.md) | Active Phase 20 documentation sprint plan for supplier Data Packs, AI search, governance, and marketplace business model |
| [Lados_V4_P18P-P20_Verification_Playbook.md](Tests/Lados_V4_P18P-P20_Verification_Playbook.md) | Verification playbook for Marketplace, Data Packs, official bundles, and demo workflows |

---

| File | Phases | Status |
|---|---|---|
| [Lados_V4_Master_Checklist.md](Sprint/Lados_V4_Master_Checklist.md) | P01–P18 (all phases) — single source of build progress | **Active** |
| [Lados_V4_Sprint_P13-P15_Canvas_UX_ResourceBindings.md](Sprint/Lados_V4_Sprint_P13-P15_Canvas_UX_ResourceBindings.md) | Phase 13 — Manifest-Driven Inspector · P14 — Typed Ports · P15 — Resource Bindings | Active |
| [Lados_V4_Sprint_P16-P18_Explorer_State_Marketplace.md](Sprint/Lados_V4_Sprint_P16-P18_Explorer_State_Marketplace.md) | Phase 16 — Full Explorer · P17 — Frontend State Engine · P18 — External Marketplace | Active |
| [Lados_V4_Sprint_14A-14B_Canvas_Groups_rgthree.md](Sprint/Lados_V4_Sprint_14A-14B_Canvas_Groups_rgthree.md) | Sprint 14A — Canvas Skill Groups + Group Execution Modes · Sprint 14B — Selective Group Execution ("Run Group") | 🔲 Not Started |

---

## Design Papers (`Design/`)

Upgrade proposals, feature design documents, and architectural decision records.

| File | Topic | Sprints |
|---|---|---|
| [Lados_rgthree_Canvas_Upgrade_Paper.md](Design/Lados_rgthree_Canvas_Upgrade_Paper.md) | Canvas Skill Groups + Selective Group Execution (rgthree-inspired) | Sprint 14A + 14B |

---

## Architecture Volumes (`Volume/`)

Detailed architecture and specification documents. These are the ground truth for platform design decisions.

| Volume | Title | Key Content |
|---|---|---|
| 0 | Architecture Freeze & Migration Blueprint | V4 migration strategy from V3, decision log |
| 2 | Node Manifest Specification | `NodeManifestV2`, `ConfigField`, port types, `ui:widget` hints |
| 3 | Workflow Builder Architecture | Canvas, React Flow integration, `WorkflowCanvas` component design |
| 4 | Component Specification | All UI components, props, behaviour contracts |
| 5 | Design System | Tokens, colours, typography, spacing scale |
| 6 | Screen Specification | All screens, user flows, empty states, error states |
| 7 | Figma Build Pack | Design handoff guide for frontend developers |
| 8 | Frontend Architecture | Next.js app structure, routing, state management |
| 9 | Backend Architecture | NestJS module design, API conventions, DB schema |

> Volume 1 is intentionally absent — it was superseded before publication.

---

## Historical Sprint Plans (`Sprint/Archive/`)

These phases are **complete**. Preserved for onboarding and to explain why the codebase is structured the way it is.

| File | Phases | What Was Built |
|---|---|---|
| [Lados_V4_Sprint_P01-P02_Foundation.md](Sprint/Archive/Lados_V4_Sprint_P01-P02_Foundation.md) | P01–P02 | Monorepo scaffold (NestJS + Next.js + pnpm workspaces), auth, workflow canvas, workflow JSON schema |
| [Lados_V4_Sprint_P10-P11_AI_Runtime.md](Sprint/Archive/Lados_V4_Sprint_P10-P11_AI_Runtime.md) | P10–P11 | AI Runtime upgrade (`AiContextBuilderService`, `OutputLedgerService`), AI Workflow Design Studio |
| [Lados_V4_Sprint_P12-P14_Queue_Registry.md](Sprint/Archive/Lados_V4_Sprint_P12-P14_Queue_Registry.md) | P12–P14 | BullMQ async queue, crash recovery, queue health API, registry maturity |

> Phases P03–P09 are fully documented in the Master Checklist and do not have separate detail documents.

---

## Test Scripts (`Tests/`)

PowerShell scripts for API validation. Run from the repo root.

```powershell
# From the repo root
cd "C:\Users\user\Documents\00 CIPAA contract work dairy\QS-WFUI"
.\docs\Lados\V4\Tests\test_phase9.ps1
.\docs\Lados\V4\Tests\test_phase10.ps1
.\docs\Lados\V4\Tests\test_phase15_resource_bindings.ps1 -Token "..." -WorkflowId "..." -NodeId "..." -BindingKey "..." -ResourceId "..." -ResourceType "..."
.\docs\Lados\V4\Tests\test_phase19_data_packs.ps1 -Token "..." -OrganizationId "..."
.\docs\Lados\V4\Tests\test_phase19c_data_pack_provenance.ps1 -Token "..." -RunId "..."
```

| Script | Tests |
|---|---|
| `test_phase9.ps1` | Phase 9 — Finance Pack: invoice, payment, purchase order API endpoints |
| `test_phase10.ps1` | Phase 10 — AI Runtime: assistant sessions, context builder, output ledger |
| `test_phase19_data_packs.ps1` | Phase 19 — Data Pack catalog, install, item search, and provenance detail |
| `test_phase19c_data_pack_provenance.ps1` | Phase 19C — Execution log Data Pack runtime provenance |

---

## DOCX Files (Formatted Snapshots)

The `.md` files are the source of truth — always edit the markdown first. DOCX files are formatted snapshots for offline reading or sharing.

| File | Notes |
|---|---|
| `LADOS V4 Implementation and Refactoring Guide.docx` | Step-by-step refactoring guide — companion to the LCE Volumes |
| `Sprint/Lados_V4_Master_Checklist.docx` | Formatted snapshot of the master checklist (may lag behind the .md) |
| `Design/Lados_rgthree_Canvas_Upgrade_Paper.docx` | Formatted version of the Canvas Groups upgrade paper |

---

## Naming Convention

All V4 documents follow this pattern:
```
Lados_V4_[Category]_[Phase/Topic]_[Description].[ext]
```

Examples:
- `Lados_V4_Sprint_P13-P15_Canvas_UX_ResourceBindings.md` — sprint plan
- `Lados_V4_Master_Checklist.md` — master doc (no phase range)
- `Lados_rgthree_Canvas_Upgrade_Paper.md` — design paper (no V4 prefix needed, context given by folder)

---

*© 2026 EffortEdutech Sdn Bhd — Lados Platform*
