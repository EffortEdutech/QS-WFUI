# 01 LCE Architecture

**Layer 1 — Architecture: "What is Lados?"**

> This document answers the question every decision maker, architect, and new team member must ask first: what is Lados, what problem does it solve, and how is it structured at the highest level?

---

## 1. What Lados Is

Lados is a business operating platform — not an ERP, not a project management tool, and not a vertical SaaS product. It is the reusable engine on which domain-specific business solutions are composed and run.

The engine is called the **Lados Core Engine (LCE)**. Every solution — Contractor Edition, Procurement Edition, LEOS — is a configuration of packs, resources, workflows, nodes, states, and AI tools built on top of LCE. The engine does not know about tipper lorries, invoices, or tender documents. The packs do.

```
LCE
  = Workflow Engine
  + Node System
  + Pack System
  + Resource Engine
  + Event Bus
  + State Engine
  + Security Engine
  + Foundation Pack
  + AI Runtime
  + Internal Registry
```

### The Screen Is the Last Thing

Most enterprise systems are built like this:

```
ERP → Modules → Screens
```

Lados is different:

```
Engine → Packs → Resources → Workflows → Screens
```

The screen is the last expression. The workflow and resource model are the product. When you consistently ask "what engine capability does this need?" instead of "how do we build this screen?", the engine stays elegant and reusable — even as solutions grow to support organisations from a one-owner contractor to a government agency.

---

## 2. Identity

```
Platform name:     Lados
Engine:            Lados Core Engine (LCE)
Version:           LCE V1
Package namespace: @lados/
Former names:      QS-OS, V3, @qsos/  (historical — retired)
```

Former names are preserved only in git history and migration notes. All active code, documentation, and UI uses the Lados identity.

---

## 3. The Engine Equation

```
LCE = Workflow Engine
    + Node System
    + Pack System
    + Resource Engine
    + Event Bus
    + State Engine
    + Security Engine
    + Foundation Pack
    + AI Runtime
    + Internal Registry
```

Each component has a single responsibility:

| Component | Responsibility |
|---|---|
| Workflow Engine | Orchestrate sequences of nodes; manage run lifecycle |
| Node System | Execute individual business actions |
| Pack System | Bundle nodes, resources, workflows, and events into installable domain capabilities |
| Resource Engine | Store and manage typed business objects |
| Event Bus | Record every important action as a typed, immutable event |
| State Engine | Enforce resource lifecycle rules through configurable state machines |
| Security Engine | Authenticate, authorise, audit |
| Foundation Pack | Provide universal building blocks (users, files, approvals, notifications) |
| AI Runtime | Give AI engines LCE context — resources, events, permissions, tools |
| Internal Registry | Track installed packs, versions, and dependencies |

---

## 4. Solutions Are Pack Compositions

A solution is a named set of packs installed on LCE:

| Solution | Packs |
|---|---|
| Contractor Edition | Foundation, Job, Fleet, Equipment, Finance, HR, Document, Dashboard, AI |
| Procurement Edition | Foundation, Procurement, Approval, Finance, Document, Dashboard, AI |
| LEOS / JKR | Foundation, Project, Tender, BOQ, Contract, Inspection, Payment, Variation, Asset, Archive |

The engine does not change between solutions. Solutions grow by adding packs.

---

## 5. Scale Philosophy

Lados sits between Node-RED and SAP. Closer to Unreal Engine in philosophy:

> Games don't modify Unreal Engine. They build on it.

The engine stays compact. Solutions grow through reused nodes, packs, state machines, resources, and workflow templates.

| Area | LCE V1 Target |
|---|---|
| Engine modules | 80–150 |
| API endpoints | 150–300 |
| UI components | 150–250 |
| Core nodes (Foundation) | 20–30 |
| Total nodes across all packs | 80–120 |
| System packs | 10–20 |

The node reuse principle is the engine's biggest force multiplier:

- The `Approve` node is used in procurement, HR, finance, construction, and asset management
- The `Upload File` node is used everywhere
- The `Generate PDF` node is used everywhere
- Industry packs add domain-specific nodes (`Create Trip`, `Verify BOQ`, `Issue CPC`) that reuse the same engine contract

---

## 6. Architecture Layers

```
┌─────────────────────────────────────────────────────────────────┐
│  Solutions (Contractor Edition · Procurement · LEOS)            │
├─────────────────────────────────────────────────────────────────┤
│  Packs (Foundation · Job · Fleet · Finance · AI · ...)          │
├──────────────┬──────────────┬──────────────┬────────────────────┤
│  Workflow    │  Resource    │  Event       │  State             │
│  Engine      │  Engine      │  Bus         │  Engine            │
├──────────────┴──────────────┴──────────────┴────────────────────┤
│  Security Engine + AI Runtime                                   │
├─────────────────────────────────────────────────────────────────┤
│  Foundation Pack (Users · Files · Approvals · Notifications)    │
├─────────────────────────────────────────────────────────────────┤
│  Supabase (PostgreSQL · Auth · Storage) + NestJS Host           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Monorepo Structure

```
QS-WFUI/
  apps/
    api/              NestJS 10 — REST API, execution host
    web/              Next.js 14 App Router — canvas and solution UI
  packages/
    execution-engine/ @lados/execution-engine
    node-sdk/         @lados/node-sdk
    pack-sdk/         @lados/pack-sdk
    shared-types/     @lados/shared-types
    workflow-json/    @lados/workflow-json
  packs/
    core-pack/        @lados/core-pack
    ai-pack/          @lados/ai-pack
    document-pack/    @lados/document-pack
    procurement-pack/ @lados/procurement-pack
    qs-pack/          @lados/qs-pack
  supabase/
    migrations/       Applied schema migrations
  docs/
    Lados/            This documentation library
```

---

## 8. Technology Stack

| Layer | Technology |
|---|---|
| API runtime | NestJS 10, TypeScript 5 |
| Frontend | Next.js 14 App Router, React Flow, Tailwind CSS |
| Database | Supabase (PostgreSQL 15) |
| Auth | Supabase Auth + JWT guard |
| File storage | Supabase Storage |
| AI | OpenAI Chat Completions API |
| Monorepo | pnpm workspaces + Turborepo |

---

## 9. Core Design Decisions (Locked)

These decisions are locked. They define the architecture direction and must not be reversed.

| Decision | Locked Direction |
|---|---|
| Platform name | Lados |
| Engine name | Lados Core Engine (LCE V1) |
| Package namespace | @lados/ |
| Resources | First-class objects — every domain entity is a Resource |
| Events | Mandatory — every important action emits a typed, immutable event |
| States | Configurable — lifecycle is enforced by state machines, not ad-hoc code |
| Nodes | Live in packs — not in the API host |
| AI | Advisory only — cannot approve, certify, or release payment without human acceptance |
| First solution | Contractor Edition — proves the engine before LEOS |
| LEOS / JKR | Built on LCE, not inside LCE — deferred until Contractor Edition proves the engine |

---

## 10. What This Architecture Enables

**For a small contractor:**
- Add more vehicles without changing workflows
- Add payroll later by enabling the HR Pack
- Reuse the same `Approve` and `Generate Invoice` nodes across job types

**For a mid-size company:**
- Add departments, teams, and role hierarchies via Security Engine
- Extend resource types without engine changes
- Connect external systems via integration nodes

**For LEOS / JKR:**
- 300+ workflows, 800–1,500 nodes, 80+ resource types
- All built on the same engine, reusing the same Foundation nodes
- No engine fork required

---

*Next: [02 LCE Runtime](02_LCE_Runtime.md) — How does the engine execute?*
