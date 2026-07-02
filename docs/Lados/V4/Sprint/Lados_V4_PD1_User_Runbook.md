# PD-1 User Runbook — eff's Tasks

**Date:** 2026-07-02 · **Sprint:** PD-1 Truth-Up & Verification Sweep
**Claude's PD-1 work (done):** checklists truthed-up, README phase table fixed, .gitignore extended.
**Your work below — run in order.** All commands are PowerShell, from repo root:
`cd "C:\Users\user\Documents\00 CIPAA contract work dairy\QS-WFUI"`

---

## Step 1 — Unlock git and commit the baseline

A stale `index.lock` is blocking git (likely VS Code or a crashed git process).

```powershell
# Close VS Code / any git GUI first, then:
Remove-Item ".git\index.lock" -Force

# Commit the Phase 19C work + PD-1 doc updates
git add -A
git commit -m "feat: Phase 19C provenance + PD-1 truth-up (checklists, README, gitignore)"
```

## Step 2 — Repo cleanup

```powershell
# Delete OS/Office junk (not tracked by git, now gitignored)
Remove-Item "_tmp_*" -Force
Remove-Item "~$*.xlsx" -Force -ErrorAction SilentlyContinue

# Untrack 20 stale compiled artifacts (tsc outputs to dist/ now)
git rm --cached "packages/execution-engine/src/*.js" "packages/execution-engine/src/*.js.map" "packages/execution-engine/src/*.d.ts" "packages/execution-engine/src/*.d.ts.map"
git commit -m "chore: untrack stale in-source build artifacts (execution-engine)"
```

## Step 3 — Local build gate

```powershell
corepack pnpm install
corepack pnpm build
corepack pnpm typecheck
```

All three must pass. If they do, tick "Verify `pnpm install && pnpm build` succeeds" in the Master Checklist (Phase 1A).

## Step 4 — Get a JWT for the smoke tests

(Cookie-based auth means no localStorage token — use the Supabase auth REST API.)

```powershell
$SUPABASE_URL = "https://fsrdasrwceuscrfglskd.supabase.co"
$ANON_KEY = "<your NEXT_PUBLIC_SUPABASE_ANON_KEY>"   # from apps/web/.env.local — paste only this value
$body = @{ email = "<your-login-email>"; password = "<your-password>" } | ConvertTo-Json
$resp = Invoke-RestMethod -Method Post -Uri "$SUPABASE_URL/auth/v1/token?grant_type=password" `
  -Headers @{ apikey = $ANON_KEY; "Content-Type" = "application/json" } -Body $body
$TOKEN = $resp.access_token
$TOKEN   # <- your JWT
```

## Step 5 — API smoke tests (API must be running: `corepack pnpm dev:api`)

```powershell
# Phase 19 Data Packs
.\docs\Lados\V4\Tests\test_phase19_data_packs.ps1 -Token $TOKEN -OrganizationId "<orgId>"

# Phase 19C provenance (needs a workflow with a Data Pack item in node config)
.\docs\Lados\V4\Tests\test_phase19c_data_pack_provenance.ps1 -Token $TOKEN <see script header for params>

# Phase 15 Resource Bindings
.\docs\Lados\V4\Tests\test_phase15_resource_bindings.ps1 -Token $TOKEN -WorkflowId "<id>" -NodeId "<id>" -BindingKey "<key>" -ResourceId "<id>" -ResourceType "<type>"
```

## Step 6 — Browser verification sweep (~30–45 min)

Run `corepack pnpm dev`, log in as owner/admin, then tick each item in the checklists as you verify:

**A. Canvas Groups (14A/14B)** — open a workflow with groups
1. Create a group, resize, collapse/expand — layout persists after reload
2. Drag a node in/out of a group — membership updates
3. Set group execution mode (mute/bypass) — verify skipped nodes in a run
4. Run Group modal: select a group → run → group log appears in History → "Group Runs" tab

**B. Typed Ports (P13/P14)** — drag edges between nodes
5. Incompatible port types are rejected; compatible ones connect

**C. Resource Bindings (P15)** — workflow inspector → Bindings tab
6. Bind a resource-picker field to a live Workspace Resource; remove/rebind works
7. Run the workflow — merged node config visible + `execution.bindings_resolved` in audit log

**D. Explorer (P16) + State (P17)**
8. Explorer tabs, search, drag-to-canvas, template preview/apply
9. Sidebar tab/collapse state persists across reload; execution log panel updates during a run

**E. Data Packs (P19/19C)**
10. Marketplace → Data Packs: install/disable a pack; detail drawer shows provenance
11. PropertyPanel: select a Data Pack item into a node config field; save; reload — persists
12. Run that workflow → Execution Log shows the **Data Pack provenance block** (19C) — this also closes "Workflow can use a Data Pack item in node config"

## Step 7 — Report back

Tell Claude which items passed/failed. Claude updates the checklists, and PD-1 gate closes → PD-2 (Tests + CI) begins.

---

## PD-1 Done Criteria

- [ ] Baseline + cleanup commits pushed
- [ ] `pnpm build`/`typecheck` green locally
- [ ] Smoke tests pass (15, 19, 19C)
- [ ] All 12 browser checks ticked in checklists
- [ ] No stale unchecked items remain in Master or P18P–P20 checklists
