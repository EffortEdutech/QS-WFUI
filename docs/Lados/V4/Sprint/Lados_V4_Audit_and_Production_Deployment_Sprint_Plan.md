# Lados V4 — Codebase Audit & Production Deployment Sprint Plan

| | |
|---|---|
| **Document ID** | LADOS-V4-PD-001 |
| **Date** | 2026-07-02 |
| **Status** | Active |
| **Audited against** | `docs/Lados` (01–07 LCE), V4 Master Checklist, P18P–P20 Checklist, Sprint 14A/14B, live Supabase DB (`fsrdasrwceuscrfglskd`) |
| **Companion** | `docs/Lados/Platform_Review_2026-07-02.md` (security/performance advisor detail) |

---

## Part A — Audit: Docs vs Codebase

### A.1 Lineage

QS-OS (V1, Vite SPA — proof of concept, docs in `docs/QS-OS/` Vols 0–19) → V3 Skill Platform → **Lados V4** (universal business workflow engine, `@lados/` namespace, evolutionary build on the same NestJS + Next.js + Supabase codebase). QS-OS volumes remain historical reference; `docs/Lados/` + V4 folder are the ground truth. Contractor Edition (doc 20) is the first packaged solution.

### A.2 Phase Status — Verified Against Code and Live DB

| Phase | Checklist says | Code/DB reality | Verdict |
|---|---|---|---|
| P1 Foundation, @lados packages | ✅ (4 deferred items) | Packages exist; manifests centralised; **no `console.log` left in packs** (deferred item actually done) | ✅ Done — untick stale items |
| P2 AI Runtime / Owner Assistant | ✅ | `ai/` module, `lados_ai_outputs` ledger table live | ✅ |
| P3 Resource + State + Event Bus | ✅ | `lados_resources` (17 rows), `lados_state_machines` (27), `lados_events` live | ✅ |
| P4 Workflow Builder V2 | ✅ | DesignStudio, ManifestFieldRouter, PropertyPanel present | ✅ |
| P5 Event-Driven Triggers | ✅ | webhook module + `lados_event_subscriptions` | ✅ (webhook HMAC design flaw — see A.4) |
| P6 Parallel & Loop | ✅ | graph-planner in execution-engine | ✅ (load tests never run) |
| P7–P10 Packs (construction, marketplace, finance, notification/scheduler) | ✅ | 10 packs, 67 registered_nodes in live DB, 11 packs table rows | ✅ |
| P11 Reporting & Audit | ✅ | audit-log module + `/audit-log` page | ✅ |
| P12 Queue & Hardening | Duplicated section; 2nd block unchecked | **Queue, worker, DLQ exist in code** (stale). But: job priority ✗, sub_workflow node ✗, crash/load tests ✗, Vault ✗, Sentry ✗ | ⚠️ Partial — real gaps remain |
| P13 Manifest Inspector | ✅ | ManifestFieldRouter + fields/ | ✅ |
| P14 Typed Ports + Registry | ✅ | Browser verification still pending | ⚠️ Verify |
| 14A/14B Canvas Groups + Run Group | In browser validation (HEAD commit) | Group nodes, RunGroupModal, `group_run_logs` table **live** (migration 0048 applied — untick) | ⚠️ Verify |
| P15 Resource Bindings | Items pending | `resource_bindings` table **live** (0049 applied — untick); smoke tests pending | ⚠️ Verify |
| P16 Explorer / P17 State Engine | Items pending | Explorer components exist; SSE/live node colouring deferred | ⚠️ Verify |
| P18/18P Marketplace + Registry | ✅ Complete | `registry_packs` live (0050 applied), 1 listing, install path browser-verified | ✅ |
| **P19 Data Pack Engine** | In progress | All 5 tables **live with seed data** (0051 applied — untick "migration applied"). Missing: item search filters, run-log provenance, browser verify, build pass | 🔶 ~80% |
| **P20 Professional Bundles** | Not started | Nothing | 🔴 0% |

### A.3 Checklist Corrections (stale items verified DONE — tick these)

1. Migrations 0048, 0049, 0050, 0051 are applied — live DB has `group_run_logs`, `resource_bindings`, `registry_packs`, `data_pack_versions/collections/items`, `org_data_pack_installs`.
2. P12: `ExecutionQueue`, `ExecutionWorker`, and DLQ handling exist (`apps/api/src/queue/`).
3. P1F: no `console.log` remains in pack sources.
4. RLS is enabled on **all 42 public tables** (verified live).

### A.4 True Gaps (verified absent)

**Engine/Platform**
- G1. `events` array in node manifests — only 3 declarations (contractor-pack); all other packs 0. Event emissions are undeclared.
- G2. `core.sub_workflow` node — not implemented.
- G3. Job priority in queue — not implemented.
- G4. SSE live execution streaming / per-node canvas colouring — deferred.
- G5. Data Pack runtime provenance: workflow runs do not log Data Pack item references (P19 governance item).

**Quality**
- G6. **Zero automated tests** repo-wide (only PowerShell API smoke scripts in `V4/Tests/`).
- G7. **No CI** — no GitHub Actions; build/typecheck/lint enforced by habit only.
- G8. Load tests (100 concurrent runs, 1000-node planner) never executed.
- G9. ~12 "browser verify" items open across P13–P19.

**Security/Ops** (full detail in Platform_Review_2026-07-02.md)
- G10. No rate limiting / helmet; unthrottled `/ai/*` spend.
- G11. Global `WEBHOOK_SECRET` (should be per-org) + unsafe rawBody fallback.
- G12. Advisor fixes outstanding: 6 functions `search_path`, HIBP disabled, 79 RLS initplan warnings, 61 duplicate permissive policies, 34 unindexed FKs.
- G13. No Sentry/observability; `console.warn` logging; no uptime monitoring.
- G14. Secrets in env files (2 prior leaks); Vault migration unchecked.
- G15. Org-scoping audit: service role bypasses RLS; controllers accept `organizationId` as query param — membership cross-check unverified.

**Product Readiness Gate (P18P–P20 doc)** — currently unmet: 3 demo-ready official workflows, clean official node manifests, QS/commercial source-and-approval display.

---

## Part B — Production Deployment Sprint Plan

Methodology: phase-gate (consistent with V4). Six sprints, PD-1 → PD-6. Each gate must close before the next opens. Estimated 1–2 sessions per sprint except PD-4.

### Sprint PD-1 — Truth-Up & Verification Sweep

*Close the gap between checklists and reality so the remaining work is honest.*

- [ ] Tick all stale checklist items listed in A.3 (with "verified 2026-07-02" note).
- [ ] Execute the ~12 pending browser verifications (P13 typed ports, 14A/14B groups, P15 bindings, P16 Explorer, P17 canvas, P19 marketplace/explorer data packs) using the P18P–P20 Verification Playbook.
- [ ] Run `test_phase15_resource_bindings.ps1`, `test_phase19_data_packs.ps1` authenticated smoke tests.
- [ ] Repo hygiene: delete `_tmp_*`, `~$*.xlsx`; gitignore compiled `.js/.d.ts` in `packages/execution-engine/src`; update stale `docs/Lados/README.md` phase table to link the P18P–P20 checklist.
- [ ] **Gate:** every checklist box reflects verified reality; `pnpm build && pnpm typecheck` green.

### Sprint PD-2 — Quality Gate (Tests + CI)

- [ ] Vitest baseline: execution-engine (planner: parallel/loop/skipNodes), one manifest+executor test per pack via `MockNodeContext` (the `@lados/testing` package finally earns its keep), webhook HMAC unit test, ApiResponse envelope e2e smoke.
- [ ] GitHub Actions: install → build → typecheck → lint → test on every push/PR.
- [ ] Add gitleaks secret-scanning job (this project has had 2 key leaks).
- [ ] **Gate:** CI green on main; ≥1 test per pack; engine covered.

### Sprint PD-3 — Security & Hardening

- [ ] `@nestjs/throttler` (strict tiers on `/ai/*`, `/webhooks/*`, auth) + `helmet`.
- [ ] Per-org webhook secrets (DB-stored, rotatable); reject when rawBody missing instead of JSON.stringify fallback.
- [ ] Advisor remediation: `SET search_path = ''` on 6 functions; enable HIBP leaked-password protection; wrap RLS policies in `(select auth.uid())` (79); consolidate duplicate permissive policies (61); index 34 FKs.
- [ ] Org-scoping audit: every service derives org membership from the authenticated user, never trusts `organizationId` param alone (G15).
- [ ] Confirm intent on 4 RLS-enabled-no-policy tables (`ai_prompts`, `approval_tasks`, `audit_log`, `workflow_templates`).
- [ ] Move OpenAI/service-role keys to Supabase Vault or platform secret store (G14).
- [ ] **Gate:** advisors re-run — zero WARN security lints; throttling verified by test.

### Sprint PD-4 — Product Completion (P19 close + P20)

*This is the existing roadmap work, unchanged — PD sprints wrap around it.*

- [ ] P19 remainder: item search filters (collection/tag/region/effective-date); runtime logging of Data Pack item references into execution logs (G5); browser verify; build pass.
- [ ] P20 full scope: node design standard, 8 pack audits, canvas readability, official bundle cleanup, 5 demo workflows (Submit Invoice→Approval, Progress Claim Evidence, RFQ→Comparison, BOQ→Cost Summary, Defect→Notification).
- [ ] Declare `events` arrays in official node manifests while auditing them (G1 — fold into P20 node audit).
- [ ] **Gate:** Product Readiness Gate in P18P–P20 checklist fully ticked.

### Sprint PD-5 — Infrastructure & Deployment

- [ ] **Decision needed:** hosting topology. Web → Vercel (MCP already connected). API + BullMQ worker need a long-running host — Railway / Fly.io / Render (Vercel serverless does not suit the worker). Redis stays Upstash. DB stays Supabase.
- [ ] Staging environment: separate Supabase project (or branch), staging env vars, seed script.
- [ ] Migration pipeline: `supabase db push` gated through CI; migration dry-run on staging first.
- [ ] Production env config: `APP_URL` CORS final value, `NODE_ENV=production`, secrets from host secret store.
- [ ] Observability: Sentry (api + web), pino structured logs with run/correlation IDs, uptime check on `/api/v1/health`, BullMQ queue-depth alerting.
- [ ] Supabase production settings: PITR/backup tier, connection pooler for the API.
- [ ] **Gate:** staging deploy end-to-end green (login → build workflow → run → approve → audit log).

### Sprint PD-6 — Launch Readiness

- [ ] Load tests: 100 concurrent runs; 1000-node planner (G8).
- [ ] Chaos drills: kill worker mid-run → verify requeue/crash recovery; force job to DLQ → verify surfacing in `/jobs`.
- [ ] Deferred engine items — decide ship-now or post-launch: job priority (G3), sub_workflow (G2), SSE live status (G4).
- [ ] Runbook: deploy, rollback, key rotation, DLQ triage, incident contacts.
- [ ] Final advisor + gitleaks + org-scoping re-run.
- [ ] Go-live: production deploy, smoke test, 48-h monitoring watch.
- [ ] **Gate:** production live; runbook exists; on-call knows the DLQ.

### Sequence

```
PD-1 Truth-up ──► PD-2 Tests+CI ──► PD-3 Security ──► PD-4 P19/P20 ──► PD-5 Infra ──► PD-6 Launch
   (1 session)      (2 sessions)      (2 sessions)     (3-4 sessions)   (2 sessions)   (1-2 sessions)
```

PD-2 and PD-3 can interleave with PD-4 if two work streams run in parallel; PD-5 hosting decision should be made early (it shapes env/secret handling in PD-3).

---

## Part C — Responsibility Split (You vs Claude)

**Rule of thumb:** authenticated browser sessions, dashboard toggles, account/billing setup, and decisions = **You**. Code, tests, migrations, CI configs, audits, and docs = **Claude**.

| Sprint | Task | Owner |
|---|---|---|
| PD-1 | Tick stale checklist items, update docs, repo cleanup | Claude |
| PD-1 | Run `pnpm build && typecheck` locally | You (Claude drafts commands) |
| PD-1 | ~12 browser verifications (needs logged-in session) | You (Claude provides step scripts) |
| PD-1 | Run PowerShell smoke tests with real JWT | You (Claude preps JWT-fetch command) |
| PD-2 | Write vitest tests (engine, packs, webhook, e2e) | Claude |
| PD-2 | GitHub Actions CI + gitleaks workflow | Claude |
| PD-2 | Add GitHub repo secrets; confirm first CI run | You |
| PD-3 | Throttler, helmet, per-org webhook secrets code | Claude |
| PD-3 | Advisor-fix migrations (search_path, RLS initplan, policies, FK indexes) | Claude (you approve apply) |
| PD-3 | Enable HIBP protection in Supabase Auth dashboard | You |
| PD-3 | Org-scoping audit sweep | Claude |
| PD-3 | Move keys to Vault / host secret store | You (Claude documents keys + destinations) |
| PD-4 | P19 remainder: search filters, provenance logging | Claude |
| PD-4 | P20: node audits, manifests, events arrays, 5 demo workflows | Claude |
| PD-4 | Browser-verify readability; approve node redesigns | You |
| PD-5 | Hosting decision for API + worker | You (Claude prepares comparison) |
| PD-5 | Create hosting/Sentry accounts, billing | You |
| PD-5 | Deploy configs, staging seeds, pino/Sentry integration | Claude |
| PD-5 | Supabase production settings (PITR, pooler) | You (Claude specifies exact settings) |
| PD-6 | Load test + chaos drill scripts | Claude |
| PD-6 | Execute drills on staging | Both |
| PD-6 | Runbook + go-live checklist | Claude |
| PD-6 | Production deploy trigger + 48-h watch | You |

---

## Session Protocol Reminder

Per Master Checklist protocol, every session ends with: ✅ Completed · 🔧 Ad-hoc outstanding · ➡️ Next task · 📝 Checklist updated.

---

*Audit performed 2026-07-02 at commit `babafb8`. Live DB verified via Supabase advisors + table inventory. No `.env` files were read.*
