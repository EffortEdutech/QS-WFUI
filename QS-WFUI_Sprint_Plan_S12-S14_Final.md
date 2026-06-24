# QS-WFUI — Final Sprint Pack: Phases 12 → 14
**Version:** 1.0
**Date:** 2026-06-24
**Covers:** Phase 12 — Async Execution Queue · Phase 13 — LEOS/JKR Blueprint · Phase 14 — Registry Maturity
**Purpose:** Define the remaining work and answer the deployment readiness question.

---

## Where We Stand

```
Phase 0   — Identity & Namespace Migration         ✅ COMPLETE
Phase 1   — Workflow Engine Stabilisation           ✅ COMPLETE
Phase 2   — Node Isolation (Nodes into Packs)       ✅ COMPLETE
Phase 3   — Resource Engine                         ✅ COMPLETE
Phase 4   — Event Bus                               ✅ COMPLETE
Phase 5   — State Engine                            ✅ COMPLETE
Phase 6   — Security Engine Hardening               ✅ COMPLETE
Phase 7   — Foundation Pack                         ✅ COMPLETE
Phase 8   — Pack Installer & Registry               ✅ COMPLETE
Phase 9   — Contractor Edition Pack Build           ✅ COMPLETE
Phase 10  — AI Runtime Upgrade                      ✅ COMPLETE
Phase 11  — AI Workflow Design Studio               ✅ COMPLETE
Phase 12  — Async Execution Queue                   ← YOU ARE HERE
Phase 13  — LEOS / JKR Layer Preparation            (next)
Phase 14  — Registry: Operator-Grade Pack Mgmt      (final)
```

At the end of Phase 14, Lados is declared **deployment-ready for the Contractor Edition**.

---

## Phase 12 — Async Execution Queue

### Why This Phase Exists

The current workflow runner is synchronous and in-process. When `ExecutionService.triggerRun()` is called, the API holds the HTTP request open until every node finishes. This works for development but is not acceptable for production:

- Long-running workflows (multi-node, AI nodes, approval waits) will time out HTTP connections
- A single slow workflow blocks the API process
- No retry path exists for failed runs
- No real-time progress is pushed to the UI

### Goal

Move execution to an async queue without changing the `WorkflowRunner` interface or any existing node code.

### Architecture Decision: Queue Technology

Two options — decide before building:

| Option | Pros | Cons |
|---|---|---|
| **BullMQ + Redis** | Battle-tested, retry logic built in, priority queues, delayed jobs, dead-letter queue | Requires Redis instance (new infra dependency) |
| **Supabase-native (pg_notify + worker)** | No new infra, uses existing Supabase DB, simpler deploy | Less battle-tested for queue semantics, manual retry logic |

**Recommended:** BullMQ + Redis for production reliability. Use a managed Redis (Upstash free tier works for MVP scale). Add `REDIS_URL` to `.env`.

### Tasks

#### S12-001 — Queue Infrastructure

- Add BullMQ and ioredis to `apps/api/package.json`
- Add `QueueModule` (Bull board optional but useful for debugging)
- Add `REDIS_URL` to `.env.example` and `.env.local`
- Verify Redis connection on API startup (health check log)

#### S12-002 — Wrap triggerRun() to Enqueue

- Create `ExecutionQueueService` that wraps `ExecutionService.triggerRun()`
- `triggerRun()` now returns `{ runId }` immediately (no await)
- Enqueue job: `{ runId, workflowId, projectId, orgId, userId, inputs, skipNodes }`
- All callers of `triggerRun()` (AiController, WorkflowController, direct API calls) already receive `runId` — no interface change needed

#### S12-003 — Worker Process

- `ExecutionWorker` — BullMQ worker that dequeues and runs workflows
- Calls the existing `WorkflowRunner.run()` — no runner changes
- On job failure: update run status to `failed`, write error to `lados_run_logs`
- Retry strategy: 3 attempts, exponential backoff (5s, 30s, 2min)
- Dead-letter queue: after 3 failures, move to `failed-runs` queue for manual inspection

#### S12-004 — Human Approval in Async Model

This is the most critical correctness task. Approval pause/resume must work in the async execution model:

- When runner hits `core.human_approval` → run status = `paused`, worker completes job (without error)
- `POST /approvals/:runId/decide` → re-enqueues the run with `resumeFromCheckpoint: true`
- Worker picks it up, calls `ExecutionService.resumeRun()` — existing logic unchanged
- **Test:** Create a workflow with approval, trigger async, approve from UI, confirm completion

#### S12-005 — SSE Progress Endpoint

- `GET /executions/:runId/stream` — Server-Sent Events endpoint
- Emits: `{ event: 'node_started', nodeId, label }`, `{ event: 'node_done', nodeId, output }`, `{ event: 'run_complete' }`, `{ event: 'run_failed', error }`
- Worker emits to SSE channel via Redis pub/sub or EventEmitter
- Fallback: `GET /executions/:runId` polling (already exists) — SSE is enhancement only

#### S12-006 — UI: Live Execution Progress

- Execution detail page (already shows run history) — add live status chips
- When run is `running`: show animated spinner per node
- Connect to SSE stream or poll every 2s
- Show `paused` state with "Waiting for approval" banner and direct link to Approval Inbox
- No new pages — enhance existing execution view

#### S12-007 — Multi-Turn Trigger in Async Model

- `POST /ai/workflow-trigger` with `execute: true` → now returns `{ runId }` immediately
- `AiCommandBar` phase `executing` → polls `GET /executions/:runId` for status
- Already partially wired — verify the polling loop works correctly with async run

### Acceptance

- [ ] Triggering a workflow returns `{ runId }` in < 100ms
- [ ] Worker executes the workflow independently of the HTTP lifecycle
- [ ] A 10-node workflow completes without API timeout
- [ ] Human approval pause → re-enqueue → resume works correctly
- [ ] Failed runs are retried 3× then marked failed (not silently dropped)
- [ ] UI shows live or near-live execution progress
- [ ] Redis connection failure on startup is logged clearly (not a silent crash)

---

## Phase 13 — LEOS / JKR Layer Preparation

### Why This Phase Exists

LEOS (Lados Enterprise OS for Construction) and JKR (Jabatan Kerja Raya) represent the next major solution layer — government-grade project and contract management. The engine is not built for them yet, but the blueprint must be locked down so that when building starts, it does not require engine surgery.

This phase is **documentation and validation only**. No code is written.

### Goal

Produce a locked LEOS/JKR blueprint that confirms:
1. LCE V1 engine can represent all LEOS resource types without structural changes
2. The pack system can accommodate 300+ workflows without performance changes
3. Organisation hierarchy (multi-tier government agencies) is representable
4. The existing QS pack is a subset of LEOS — it does not need to be rebuilt

### Tasks

#### S13-001 — LEOS Resource Type Catalogue

Document all resource types LEOS will need:

```
Core: Organisation, Department, Agency, Programme, Project, Phase
Procurement: Tender, BOQ, Evaluation, Contract, VO Package
Site: Site Instruction, Inspection, NCR, Test Certificate
Finance: Progress Claim, Payment Certificate, Variation Order, EOT
Closure: CPC, DLP Defect, Final Account, Retention Release
Assets: Asset, Archive Record
People: Consultant, Contractor, Inspector, Officer
```

Confirm each maps to `lados_resources` without schema changes.

#### S13-002 — LEOS State Machine Catalogue

Document the lifecycle for each major resource type:
- Contract: `Draft → Awarded → Active → Suspended → Closed → Archived`
- Progress Claim: `Submitted → Under Review → Certified → Payment Authorised → Paid → Disputed`
- Inspection: `Scheduled → In Progress → Pass → Fail → NCR Issued → Resolved`

Confirm each maps to `lados_state_machines` without schema changes.

#### S13-003 — LEOS Pack Architecture

Plan the pack structure for LEOS:

| Pack | Responsibility |
|---|---|
| `leos-core-pack` | Org hierarchy, programme, project lifecycle |
| `leos-procurement-pack` | Tender, BOQ, contract award |
| `leos-site-pack` | Site instructions, inspections, NCRs |
| `leos-finance-pack` | Claims, certificates, payment, retention |
| `leos-closure-pack` | CPC, DLP, final account, archival |
| `leos-asset-pack` | Asset register and handover |

Confirm each pack follows the same `PackManifest + resolveNode()` contract as `contractor-pack`.

#### S13-004 — QS Pack Boundary Validation

The existing `qs-pack` (BOQ classification, RFQ generation) is a subset of LEOS procurement. Confirm:
- `qs-pack` nodes are not duplicated in `leos-procurement-pack`
- `qs-pack` becomes a dependency of `leos-procurement-pack`, not replaced by it
- No `qs-pack` changes are needed for LCE V1

#### S13-005 — Multi-Tier Organisation Hierarchy

JKR has: `Federal Ministry → State PWD → District Office → Project Team`

Current `organizations` table is single-level. Document (but do not build) the hierarchy extension:
- `parent_org_id` column on `organisations`
- `SecurityEngine` permission inheritance down the hierarchy
- No schema migration in this phase — just confirm the path is unblocked

#### S13-006 — LEOS Blueprint Document

Produce `docs/LEOS/01_Deferred_Blueprint.md`:
- All resource types, state machines, pack architecture
- Confirmed compatibility statements for each LCE V1 engine module
- List of items that DO require engine changes (if any)
- Estimated pack count, node count, workflow count

### Acceptance

- [ ] `docs/LEOS/01_Deferred_Blueprint.md` written and reviewed
- [ ] Every LEOS resource type confirmed as representable in `lados_resources`
- [ ] No engine schema changes identified as blockers (or blockers explicitly listed)
- [ ] QS pack boundary validated — no rebuild needed
- [ ] Phase 13 has zero code commits

---

## Phase 14 — Registry: Operator-Grade Pack Management

### Why This Phase Exists

Phase 8 delivered a working Pack Installer that syncs compiled packs from the filesystem on startup. This is sufficient for development but not for production operator use. An operator (the person running a Lados instance for a customer) needs to:

- Install a new pack without a code deploy
- Upgrade a pack without rebuilding the API
- Disable individual nodes (not whole packs) for a specific organisation
- See pack health, version history, and dependency graph
- Roll back a broken pack without a full rollback

### Goal

Operator can install, upgrade, enable/disable, and inspect packs entirely from the UI — no code deploy required.

### Tasks

#### S14-001 — Pack Registry Schema Upgrade (Migration 0036)

```sql
-- Add to packs table
version         text NOT NULL DEFAULT '1.0.0',
previous_version text,
registry_url    text,           -- source: registry, git, upload
installed_from  text,           -- 'startup-sync' | 'registry' | 'upload'
installed_by    uuid REFERENCES auth.users(id),
upgraded_at     timestamptz,
checksum        text,           -- SHA256 of the pack bundle

-- New table: pack_node_overrides
-- Allows fine-grained node enable/disable per org
CREATE TABLE pack_node_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid NOT NULL REFERENCES organisations(id),
  pack_id     uuid NOT NULL REFERENCES packs(id),
  node_type   text NOT NULL,
  is_enabled  boolean NOT NULL DEFAULT true,
  overridden_by uuid REFERENCES auth.users(id),
  overridden_at timestamptz DEFAULT now()
);
```

#### S14-002 — Pack Bundle Format

Define what a deployable pack bundle looks like:

```
lados-contractor-pack-1.2.0.tar.gz
├── manifest.json        (PackManifest — name, version, dependencies, nodes)
├── index.js             (compiled CommonJS resolveNode export)
├── migrations/
│   └── 0001_add_payroll_columns.sql   (incremental migrations for this version)
└── CHANGELOG.md
```

- `PackInstallerService` upgraded to accept a bundle (file upload or registry URL)
- Bundle is validated: checksum, manifest schema, dependency check
- Incremental migrations are applied automatically on install

#### S14-003 — PackRegistryService Upgrade

Extend `PackRegistryService`:

- `installFromBundle(buffer, installedBy)` — unpack, validate, apply migrations, register nodes
- `installFromUrl(registryUrl, installedBy)` — fetch bundle from URL, then installFromBundle
- `upgradepack(packId, bundle, upgradedBy)` — apply incremental migrations, swap compiled module
- `rollbackPack(packId, upgradedBy)` — restore previous version from stored bundle
- `getPackHealth(packId)` — check all registered nodes are resolvable, report broken nodes

#### S14-004 — Node-Level Override (per Org)

Currently enable/disable is pack-level. Add node-level:

- `PackRegistryService.setNodeOverride(orgId, packId, nodeType, isEnabled)`
- `buildRealNodeResolver()` checks `pack_node_overrides` before resolving
- Pack contract for AI suggestions also checks overrides

#### S14-005 — Registry API Endpoints

Add to `PackController`:

```
POST /packs/install          { registryUrl? | bundle (multipart) }  → install pack
POST /packs/:id/upgrade      { registryUrl? | bundle (multipart) }  → upgrade pack
POST /packs/:id/rollback                                             → restore previous
GET  /packs/:id/health                                               → node resolution check
PATCH /packs/:id/nodes/:nodeType/enable                             → node-level override
PATCH /packs/:id/nodes/:nodeType/disable                            → node-level override
GET  /packs/:id/versions                                             → version history
```

All endpoints: owner/admin only, full audit trail in `lados_events`.

#### S14-006 — Registry UI

Upgrade `/packs` page:

- **Install tab** — URL input or file upload, shows manifest preview before confirming install
- **Pack card** — adds version badge, "Upgrade available" indicator, Rollback button
- **Node list** — expandable per-pack node list with individual enable/disable toggles
- **Health badge** — green (all nodes resolve), amber (some nodes broken), red (pack fails to load)
- **Version history drawer** — shows installed_at, installed_by, version chain

#### S14-007 — Pack Health Check on Startup

- `PackInstallerService` already syncs on startup
- Add health check: attempt to resolve every registered node at startup
- Log broken nodes with pack name, node type, and error
- Optionally: expose `GET /health/packs` for monitoring

#### S14-008 — Documentation Update

- Update `docs/LCE_V1/05_Pack_System.md` with bundle format, install flow, and upgrade process
- Update `docs/LCE_V1/12_Internal_Registry.md` — write this doc (currently a placeholder)

### Acceptance

- [ ] Operator can install a pack from a URL or file upload without restarting the API
- [ ] Pack upgrade applies incremental migrations and swaps the module
- [ ] Rollback restores the previous version
- [ ] Node-level enable/disable is enforceable per organisation
- [ ] Pack health is visible on startup and from the UI
- [ ] All pack operations are audited in `lados_events`

---

## Deployment Readiness Assessment

The question: **Is Lados deployment-ready by the end of Phase 14?**

### ✅ What Is Production-Ready by End of Phase 14

| Capability | Status |
|---|---|
| Workflow engine — model, run, approve, publish | ✅ Complete |
| Node isolation — all logic in packs | ✅ Complete |
| Resource Engine — jobs, trips, operators, payroll | ✅ Complete |
| Event Bus — typed, audited, subscribable | ✅ Complete |
| State Engine — lifecycle rules enforced | ✅ Complete |
| Security Engine — role-based, declarative | ✅ Complete |
| Foundation Pack — notifications, approvals, assignments | ✅ Complete |
| Pack Installer — auto-sync, enable/disable | ✅ Phase 8 |
| Contractor Edition — M1 to M4 full pack | ✅ Phase 9 |
| AI Runtime — grounded, audited, tool-calling | ✅ Phase 10 |
| AI Workflow Designer — natural language → draft | ✅ Phase 11 |
| Async execution — non-blocking, retry, fail-safe | ✅ Phase 12 |
| Operator pack management — install, upgrade, rollback | ✅ Phase 14 |

### ⚠️ What Needs Attention Before Go-Live (Not a Phase — Parallel Work)

These are not new phases but are required before a real customer goes live. They can be done in parallel with Phase 12-14 or as a targeted "go-live prep" sprint after Phase 14:

| Item | Risk if skipped | Effort |
|---|---|---|
| **End-to-end test suite** — smoke tests for each workflow template | Regressions go undetected in production | Medium |
| **Rate limiting on API** — protect `/ai/*` and execution endpoints | AI cost blowout, denial-of-service | Low |
| **Error monitoring** — Sentry or equivalent wired to both API and web | Silent failures invisible in production | Low |
| **Prod environment config** — `NODE_ENV=production`, CORS locked, no dev seeds | Security exposure, seed data in prod | Low |
| **Supabase RLS audit** — confirm all tables have correct row-level security policies | Data leakage between organisations | Medium |
| **Driver mobile UX** — test on actual phone, tap targets, offline resilience | Drivers can't use the app in the field | Medium |
| **User onboarding flow** — first-time owner: create org, invite driver, first job | No one can get started without hand-holding | Medium |
| **Backup and restore** — Supabase PITR enabled, restore procedure documented | Data loss risk | Low |
| **Performance under load** — 10 concurrent workflow runs, 100 resources | Unknown breaking point | Medium |

### Deployment Verdict

```
End of Phase 12: Engine is production-grade. Safe to run real workflows.
End of Phase 13: LEOS path is locked. No surprises when LEOS work begins.
End of Phase 14: Operator can manage packs without a developer.
                 Contractor Edition is deployable for a paying customer.

VERDICT: DEPLOYMENT-READY for Contractor Edition by end of Phase 14
         — subject to go-live prep items above (1-2 weeks of parallel work).
```

### What Phase 14 Does NOT Make Ready

- **LEOS / JKR** — this is Phase 13 (documented) but not built. A separate build programme.
- **Multi-tenant SaaS** — current org model is single-tenant (one Supabase project per customer). Multi-tenancy requires a separate architecture decision.
- **Mobile-native app** — current driver UI is web-responsive, not a native app. Acceptable for MVP, not ideal for scale.
- **White-label / reseller** — no branding configuration per org yet.

---

## Sprint Timeline (Estimate)

| Phase | Complexity | Estimate |
|---|---|---|
| Phase 12 — Async Queue | High (new infra, async correctness) | 2–3 sessions |
| Phase 13 — LEOS Blueprint | Low (docs only) | 1 session |
| Phase 14 — Registry Maturity | Medium-High (bundle format, migrations) | 2–3 sessions |
| Go-Live Prep | Varies | 1–2 sessions |

**Total: 6–9 sessions to deployment-ready.**

---

## Next Immediate Action

Start Phase 12. First decision: **BullMQ + Redis** or **Supabase-native queue?**

Recommendation: BullMQ + Upstash Redis (managed, free tier, no server to manage). Allows production-grade retry, dead-letter, and priority queues out of the box.

Once you confirm the queue technology, begin S12-001.
