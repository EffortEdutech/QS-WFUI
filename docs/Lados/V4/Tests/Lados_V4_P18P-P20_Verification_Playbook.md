# Lados V4 P18P-P20 Verification Playbook

**Document ID:** LADOS-V4-P18P-P20-VERIFY  
**Status:** Active test planning document  
**Date:** 2026-07-02  

---

## Purpose

This playbook defines how to verify Lados after the V4 architecture phases and during productization phases 18P, 19, and 20.

It focuses on product confidence:
- Marketplace works.
- Data Packs are visible and correctly named.
- Official nodes are readable.
- Demo workflows are testable.
- QS/commercial guardrails are visible.

---

## Environment Checklist

- [ ] API running at `http://localhost:4000/api/v1`.
- [ ] Web running at `http://localhost:3000`.
- [ ] User is logged in.
- [ ] User belongs to an organization as owner/admin for install tests.
- [ ] Migration 0050 applied.
- [x] Migration 0051 applied.
- [ ] Browser console open.
- [ ] Network tab open for failed API checks.

Never paste `.env` contents into test logs or chat.

---

## Phase 18P Verification

### Marketplace Tabs

Open `/marketplace`.

Expected tabs:
- [ ] Installed Packs
- [ ] Browse Registry
- [ ] Data Packs
- [ ] Publish Pack
- [ ] Review Queue, for owner/admin users only

Checks:
- [ ] Installed Packs loads current packs.
- [ ] Browse Registry does not crash if registry is empty.
- [ ] Data Packs tab explains Data Packs clearly.
- [ ] Publish Pack accepts only bundle upload UX.
- [ ] No console loops.
- [ ] No React Flow warnings on Marketplace page.

### Registry API

Run:

```powershell
.\docs\Lados\V4\Tests\test_phase18_registry.ps1 `
  -Token "<JWT>" `
  -OrganizationId "<ORG_ID>"
```

Expected:
- [ ] Browse registry returns success.
- [ ] No missing table error.
- [ ] No missing bucket error.

### Publish/Verify/Install

With a test `.ladosPack`:

- [x] Use `test-data/packs/lados-demo-pack-0.1.0.ladosPack`.
- [x] Submit bundle in Publish Pack tab.
- [x] Confirm pending review / already submitted response.
- [x] Open Review Queue.
- [x] Preview submitted listing.
- [x] Approve listing.
- [x] Refresh Browse Registry.
- [x] Listing appears.
- [x] Preview modal opens.
- [x] Preview modal shows node list.
- [x] Install button works for owner/admin.
- [x] Installed tab refreshes.
- [x] Node registry includes installed node declarations.

---

## Phase 19 Verification

### Data Pack Browse

Open `/marketplace`, Data Packs tab.

- [x] Official Data Packs display from live API.
- [x] Installed Data Packs display separately.
- [x] Data Pack detail drawer opens.
- [x] Collections are visible.
- [x] Provenance/source fields are visible.

### Data Pack API

Run:

```powershell
.\docs\Lados\V4\Tests\test_phase19_data_packs.ps1 `
  -Token "<JWT>" `
  -OrganizationId "<ORG_ID>"
```

Expected:
- [x] `GET /data-packs` returns official Data Packs.
- [x] `POST /data-packs/:slug/install` installs a pack for the org.
- [x] `GET /org/data-packs` returns installed packs.
- [x] `GET /data-pack-items/search` returns installed Data Pack items.
- [x] `GET /data-pack-items/:itemId` returns source/provenance.

### Explorer Data Packs

Open workflow builder Explorer.

- [x] Data Packs panel loads installed Data Packs.
- [x] Search works.
- [x] Collection filter works.
- [x] Source/provenance is visible on search result cards.

### PropertyPanel Data Pack Field

Use a node with `data_pack_item` config.

- [ ] Field renders as Data Pack item picker.
- [ ] Picker filters by configured collection.
- [ ] Selected item is saved into node config.
- [ ] Saved item persists after reload.

### Runtime Provenance

Run a workflow using a Data Pack item.

- [ ] Migration 0052 applied.
- [ ] Execution resolves Data Pack item.
- [ ] Run logs include Data Pack slug/version/item key.
- [ ] Execution Log panel shows advisory/source note for QS/commercial values.

Run:

```powershell
.\docs\Lados\V4\Tests\test_phase19c_data_pack_provenance.ps1 `
  -Token "<JWT>" `
  -RunId "<RUN_ID>"
```

Expected:
- [ ] At least one `execution_logs` row has `data_pack_usages`.
- [ ] Usage includes pack slug, version, collection key, item key, source name/date, and advisory status.

---

## Phase 20 Verification

### Canvas Node Readability

For each official pack:

- [ ] Node title fits.
- [ ] Port labels fit.
- [ ] Typed handles align with labels.
- [ ] No duplicate visible dots.
- [ ] High-input nodes do not become unreadable.
- [ ] Inspector contains detailed config instead of canvas clutter.

### Official Demo Workflows

Verify:

- [ ] Submit Invoice to Approval loads.
- [ ] Progress Claim Evidence Check loads.
- [ ] RFQ to Quotation Comparison loads.
- [ ] BOQ Upload to Cost Summary loads.
- [ ] Defect Report to Notification loads.

For each:
- [ ] Save works.
- [ ] Required resources/bindings are visible.
- [ ] Data Pack dependencies are visible.
- [ ] Run works if all nodes are functional.
- [ ] If not runnable, workflow is marked as design/demo only.

### QS Guardrail Review

For QS/commercial workflows:

- [ ] No AI output says it certifies payment.
- [ ] No Data Pack value is shown as final contract rate without human confirmation.
- [ ] Claim/variation workflows show evidence requirements.
- [ ] Approval/certification remains human controlled.

---

## Product Readiness Result

Use this result table after each verification session.

| Area | Pass/Fail | Notes |
|---|---|---|
| Marketplace |  |  |
| Data Packs |  |  |
| Canvas readability |  |  |
| Official packs |  |  |
| Demo workflows |  |  |
| QS guardrails |  |  |
| Console/API errors |  |  |

---

## Exit Criteria

Lados V4 can be presented externally when:

- [ ] All Phase 18P checks pass.
- [x] Phase 19 has at least two live official Data Packs.
- [ ] Phase 20 has at least three demo workflows.
- [ ] No critical UX issue blocks workflow creation.
- [ ] No critical console/API loop remains.
- [ ] The product language is consistently Lados, not QS-WFUI or QS-OS.
