# Lados Platform — Pre-Completion Review & Enhancement Proposals

| | |
|---|---|
| **Date** | 2026-07-02 |
| **Scope** | Full platform: apps/api, apps/web, packages, packs, docs, database |
| **Status snapshot** | Phase 18P complete · Phase 19 (Data Pack Engine) in progress · Phase 20 not started · Phase 14A/14B canvas groups in browser validation |

---

## 1. Current State Summary

The platform is substantially built and coherent:

- **API** (NestJS): 143 TS files, 30+ modules — workflow, execution, queue (BullMQ + Upstash), event bus, state engine, resource bindings, marketplace/registry, AI runtime, approvals, audit log, security (API keys), webhooks, scheduler.
- **Web** (Next.js 14): 19 pages covering dashboard, projects (BOQ, quotations, workflows), marketplace, approvals, AI Insights, audit log, jobs, suppliers. Rich canvas (Design Studio, groups, condition nodes, version history, run history, resource bindings).
- **Packages**: `@lados/core`, `node-sdk`, `pack-sdk`, `testing` in place per Phase 1 checklist.
- **Packs**: 10 packs; core-pack (29 files), contractor (15), construction (13), finance (11), qs (11) are substantive.
- **Database**: 51 migrations through `0051_data_pack_engine.sql`.
- **Docs**: Three-layer LCE library + V4 Volumes + sprint checklists — unusually well documented.

The architecture matches the LCE blueprint: manifest-driven nodes, pack isolation, event-driven triggers, human approval as first-class node, async queue. This is genuinely close to complete for the V4 scope.

---

## 2. Findings (by severity)

### 🔴 Critical — fix before calling it "done"

**F1. Zero automated tests in the entire repo.**
No `*.spec.ts` or `*.test.ts` files exist anywhere (excluding node_modules), despite `pnpm -r test` scripts and a purpose-built `@lados/testing` package with `MockNodeContext`. The Phase 1F checklist item "unit test for each upgraded node" was deferred and never resumed. With 38+ nodes, an execution engine, and HMAC webhook verification, regressions are currently only catchable by manual browser validation.
→ *Minimum bar: engine graph-planner/runner tests, one manifest+executor test per pack, webhook HMAC test, one API e2e smoke test.*

**F2. No CI pipeline.**
No `.github/workflows`. Nothing enforces `build`, `typecheck`, `lint`, or (future) tests on push. Given this project has already had **two credential leaks** (per CLAUDE.md), CI should also run secret scanning (gitleaks) on every commit.

**F3. No rate limiting or HTTP hardening on the API.**
No `@nestjs/throttler`, no `helmet`. Public endpoints (`/webhooks/:orgId/:path`, auth) are open to abuse; AI endpoints (`/ai/assist`) are cost-bearing and unthrottled — an attacker or a runaway client can burn OpenAI spend.

**F4. Webhook HMAC design weaknesses.**
- Single global `WEBHOOK_SECRET` shared by all orgs — any one integration partner can forge webhooks for every org. Should be **per-org (or per-endpoint) secrets** stored in DB.
- Fallback `Buffer.from(JSON.stringify(req.body))` when rawBody is missing verifies the signature over a *re-serialized* body, which both breaks legitimate senders (key-order/whitespace differences) and weakens the guarantee. If rawBody isn't buffered, reject instead.

**F5. RLS / authorization posture — advisors run 2026-07-02 (project `fsrdasrwceuscrfglskd`).**
Good news: RLS is broadly enabled with policies in place. Advisor findings to action:

*Security (11 lints):*
- 6 functions with **mutable search_path** (WARN): `set_lados_resources_updated_at`, `set_lados_state_machines_updated_at`, `set_api_keys_updated_at`, `update_lados_artifacts_updated_at`, `update_ai_sessions_updated_at`, `set_updated_at`. Fix: `SET search_path = ''` on each. [Remediation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)
- **Leaked password protection disabled** (WARN) — enable HaveIBeenPwned check in Auth settings. [Remediation](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- 4 tables with **RLS enabled but no policies** (INFO): `ai_prompts`, `approval_tasks`, `audit_log`, `workflow_templates`. Acceptable if these are service-role-only, but confirm intentional. [Remediation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

*Performance (235 lints):*
- **79 × auth_rls_initplan** (WARN) — policies re-evaluate `auth.uid()`/`current_setting()` per row. Wrap in `(select auth.uid())`. Biggest query-performance win available.
- **61 × multiple_permissive_policies** (WARN) — overlapping policies per role/action (e.g. `ai_assistant_sessions` has both `ai_sessions_read_own` and another SELECT policy for `anon`). Consolidate.
- **34 × unindexed foreign keys** (INFO) — e.g. `api_keys.created_by`. Add covering indexes.
- **61 × unused indexes** (INFO) — review after real production traffic before dropping.

Remaining audit item: the API uses the **service role** (bypasses RLS), so also verify every service method derives `org_id` from the authenticated user, not client-supplied query params alone (e.g. `ApiKeyController` takes `organizationId` as a query param — confirm the service cross-checks membership).

### 🟡 Important — production quality

**F6. CORS still marked "tighten in production"** in `main.ts`; single `APP_URL` origin is fine, but confirm the production value and remove the TODO.

**F7. No observability stack.** `console.warn` for startup logs; no structured logger (pino), no error tracking (Sentry), no request tracing. For a workflow engine, execution-level tracing (correlation IDs already exist in migration 0040) should surface in logs.

**F8. 10 MB inline base64 uploads.** Receipt images ride through the API body. Move to Supabase Storage signed-URL direct uploads; keeps the API light and removes the global body-limit bump.

**F9. Build artifacts committed as source.** `packages/execution-engine/src` contains `.js`, `.d.ts`, `.map` files alongside `.ts`. Add `dist/` output + `.gitignore` cleanup. Also: `_tmp_*` files and `~$QS-WFUI-Info.xlsx` at repo root.

**F10. Docs drift.** `docs/Lados/README.md` phase table still shows Phases 2–12 "Pending" while reality is Phase 18P complete. Since docs are this project's strength, stale status tables undermine trust. Single source of truth should be the P18P–P20 checklist; README should link, not duplicate.

**F11. ai-pack is a stub (1 file)** while AI capability lives in `apps/api/src/ai`. Either fold the AI runtime's node-facing surface into ai-pack properly (per pack-isolation principle) or remove the stub pack to avoid confusion in the marketplace.

### 🟢 Minor

- `console.warn` used for informational logs in `main.ts`.
- No `SECURITY.md` / disclosure policy — relevant if marketplace opens to third-party pack submissions.

---

## 3. Enhancement Proposals

### P0 — Production Readiness Gate (do before launch)

1. **Test + CI baseline** (F1, F2): vitest across packages/packs, GitHub Actions with build → typecheck → lint → test → gitleaks. ~2–3 sessions.
2. **API hardening pack** (F3, F4, F6): throttler (strict on `/ai/*` and `/webhooks/*`), helmet, per-org webhook secrets with rotation, reject-on-missing-rawBody. ~1–2 sessions.
3. **Tenant-boundary audit** (F5): RLS advisor run + org-scoping sweep of all controllers/services. ~1 session.
4. **Repo hygiene** (F9): gitignore dist outputs, delete temp files.

### P1 — Complete the Roadmap

5. **Finish Phase 19 Data Pack Engine** beyond the vertical slice — it's the differentiator for the marketplace story.
6. **Phase 20 Professional Bundles** — package Contractor Edition as the first sellable bundle; this is also the forcing function for pack signing/versioning.
7. **Pack integrity for the registry**: checksum + signature on `.ladosPack` bundles, semver enforcement, and an uninstall/upgrade path. Prerequisite for accepting third-party submissions safely.
8. **Observability** (F7): pino structured logs with execution correlation IDs, Sentry on both apps, a `/jobs` view fed by BullMQ metrics (queue depth, failure rate, dead-letter count).

### P2 — Differentiating Enhancements (post-launch)

9. **Workflow template gallery** — ship the BOQ→RFQ→Quotation→PO chain as one-click templates per trade. Fastest path to "aha" for new contractor users.
10. **AI output ledger surfacing** — the Intelligence layer specifies guardrails + ledger; expose an "AI decisions" audit view (what AI suggested, confidence, who approved). This is your compliance story and a genuine market differentiator ("AI assists, human approves, system records").
11. **CIPAA/payment-claim pack** — given the domain (Malaysian contract work), a pack covering progress claims → payment certificates → CIPAA statutory timelines/notices would be uniquely valuable and hard to copy.
12. **Direct-to-storage uploads** (F8) + document previews in the canvas file panel.
13. **Usage metering per org** — AI token spend, executions/month, storage. Prerequisite for any paid tier.
14. **Responsive/mobile pass** for approvals and dashboard — site staff approve on phones.

---

## 4. Suggested Sequence

```
Week 1   P0.1 Tests+CI  ──►  P0.2 API hardening  ──►  P0.3 Tenant audit
Week 2   Phase 19 completion (Data Pack Engine)
Week 3   Phase 20 (Professional Bundles) + pack signing
Week 4   Observability + template gallery  →  launch candidate
```

---

*Reviewed: repo at commit `babafb8` (Phase 14A/14B browser validation in progress). No `.env` files were read during this review.*
