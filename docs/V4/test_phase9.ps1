# =============================================================================
# test_phase9.ps1 — Phase 9 Finance Pack End-to-End Test
#
# Tests the full invoice lifecycle:
#   finance.submit_invoice → finance.verify_invoice → [approval gate] →
#   finance.approve_invoice → finance.process_payment
#
# SETUP:
#   1. Run migration 0045_phase9_test_seed.sql in Supabase SQL Editor
#   2. Copy the IDs from the RAISE NOTICE output into the vars below
#   3. Build + publish the Invoice Workflow in the UI (see guide at bottom)
#   4. Fill in $INVOICE_WORKFLOW_ID
#   5. Run: .\docs\V4\test_phase9.ps1
# =============================================================================

$API   = "http://localhost:4000/api/v1"
$TOKEN = "PASTE_YOUR_JWT_HERE"
$HDR   = @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" }

# IDs from migration 0045 RAISE NOTICE output:
$ORG_ID              = "PASTE_ORG_ID"
$PROJECT_ID          = "PASTE_PROJECT_ID"
$INVOICE_RESOURCE_ID = "PASTE_INVOICE_RESOURCE_ID"

# Workflow ID — build in UI, publish, copy the UUID here:
$INVOICE_WORKFLOW_ID = "PASTE_INVOICE_WORKFLOW_ID"

function Assert($label, $condition, $detail = "") {
    if ($condition) { Write-Host "  ✅ $label" -ForegroundColor Green }
    else            { Write-Host "  ❌ $label  $detail" -ForegroundColor Red; exit 1 }
}

function PollRun($runId, $maxWait = 60) {
    $elapsed = 0
    while ($elapsed -lt $maxWait) {
        Start-Sleep 2; $elapsed += 2
        $r = Invoke-RestMethod -Uri "$API/runs/$runId" -Headers $HDR
        $s = $r.data.status
        Write-Host "    ... $s ($elapsed s)"
        if ($s -in @("completed","failed","paused")) { return $r.data }
    }
    throw "Timeout waiting for run $runId after ${maxWait}s"
}

Write-Host ""
Write-Host "=== Phase 9 Finance Pack — E2E Test ===" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Verify finance pack is installed ───────────────────────────────────
Write-Host "STEP 1 — Finance pack installed?"
$packs = Invoke-RestMethod -Uri "$API/marketplace/packs" -Headers $HDR
# DB stores pack id as 'lados.finance-pack'
$fp = $packs.data | Where-Object { $_.id -eq "lados.finance-pack" }
Assert "lados.finance-pack found in marketplace" ($null -ne $fp)
Assert "lados.finance-pack is enabled" ($fp.is_enabled -eq $true) "is_enabled=$($fp.is_enabled)"

# ── Step 2: Verify finance nodes in registry ──────────────────────────────────
Write-Host ""
Write-Host "STEP 2 — Finance nodes registered?"
# node-registry does NOT use organizationId — it's a global registry
$nodes = Invoke-RestMethod -Uri "$API/node-registry" -Headers $HDR
$financePack = $nodes.data.packs | Where-Object { $_.id -eq "lados.finance-pack" }
Assert "finance pack present in registry" ($null -ne $financePack)
Assert "8 finance nodes registered" ($financePack.nodeCount -eq 8) "Got $($financePack.nodeCount)"
Write-Host "  Nodes: $($financePack.nodes.type -join ', ')"

# ── Step 3: Verify seed resource exists ───────────────────────────────────────
Write-Host ""
Write-Host "STEP 3 — Seed invoice resource accessible?"
# GET /resources/:id requires ?organizationId=
$inv = Invoke-RestMethod -Uri "$API/resources/$INVOICE_RESOURCE_ID`?organizationId=$ORG_ID" -Headers $HDR
# DB column is 'type' (not resource_type) and state is 'draft'
Assert "finance_invoice resource found" ($inv.data.type -eq "finance_invoice") "type=$($inv.data.type)"
Assert "Invoice in 'draft' state" ($inv.data.state -eq "draft") "state=$($inv.data.state)"
Write-Host "  Resource: $($inv.data.name)  state=$($inv.data.state)"

# ── Step 4: Trigger the invoice workflow ──────────────────────────────────────
Write-Host ""
Write-Host "STEP 4 — Trigger invoice workflow..."
$body = @{
    inputs = @{
        resourceId = $INVOICE_RESOURCE_ID
        orgId      = $ORG_ID
        projectId  = $PROJECT_ID
    }
} | ConvertTo-Json -Depth 5

$trigger = Invoke-RestMethod -Method Post `
    -Uri "$API/workflows/$INVOICE_WORKFLOW_ID/run" `
    -Headers $HDR -Body $body
Assert "Workflow triggered" ($null -ne $trigger.data.runId) "No runId returned"
$RUN_ID = $trigger.data.runId
Write-Host "  Run ID: $RUN_ID"

# ── Step 5: Poll until paused (approval gate) ─────────────────────────────────
Write-Host ""
Write-Host "STEP 5 — Waiting for run to reach approval gate (paused)..."
$run = PollRun $RUN_ID 60
Assert "Run paused at approval gate" ($run.status -eq "paused") "status=$($run.status)"
Write-Host "  Paused at node: $($run.paused_at_node_id)"

# ── Step 6: Check approval task was created ───────────────────────────────────
Write-Host ""
Write-Host "STEP 6 — Approval task created?"
$approvals = Invoke-RestMethod -Uri "$API/approvals?organizationId=$ORG_ID" -Headers $HDR
$pending = $approvals.data | Where-Object { $_.run_id -eq $RUN_ID -and $_.status -eq "pending" }
Assert "Approval task pending for this run" ($pending.Count -gt 0) "Count=$($pending.Count)"
$TASK_ID = $pending[0].id
Write-Host "  Approval task ID: $TASK_ID"

# ── Step 7: Approve the task ──────────────────────────────────────────────────
Write-Host ""
Write-Host "STEP 7 — Approving the invoice..."
$approveBody = @{
    decision = "approved"
    comments = "Test approval — QS verified amounts are correct"
} | ConvertTo-Json

Invoke-RestMethod -Method Post `
    -Uri "$API/approvals/$TASK_ID/decide" `
    -Headers $HDR -Body $approveBody | Out-Null
Write-Host "  Approval submitted"

# ── Step 8: Poll until completed ──────────────────────────────────────────────
Write-Host ""
Write-Host "STEP 8 — Waiting for run to complete after approval..."
$run = PollRun $RUN_ID 60
Assert "Run completed" ($run.status -eq "completed") "status=$($run.status)"

# ── Step 9: Verify invoice state changed to 'paid' ────────────────────────────
Write-Host ""
Write-Host "STEP 9 — Verify invoice resource state changed?"
$invAfter = Invoke-RestMethod -Uri "$API/resources/$INVOICE_RESOURCE_ID`?organizationId=$ORG_ID" -Headers $HDR
Assert "Invoice state is 'paid'" ($invAfter.data.state -eq "paid") "state=$($invAfter.data.state)"

# ── Step 10: Verify execution logs ────────────────────────────────────────────
Write-Host ""
Write-Host "STEP 10 — Execution logs present?"
$logs = Invoke-RestMethod -Uri "$API/runs/$RUN_ID/logs" -Headers $HDR
Assert "Execution logs exist" ($logs.data.Count -gt 0) "Count=$($logs.data.Count)"
$bad = $logs.data | Where-Object { $_.status -notin @("completed","skipped") }
Assert "All nodes completed or skipped" ($bad.Count -eq 0) "$($bad.Count) nodes not completed"
Write-Host "  $($logs.data.Count) nodes executed"

# ── Step 11: Verify audit log entry ───────────────────────────────────────────
Write-Host ""
Write-Host "STEP 11 — Audit log entry created?"
$audit = Invoke-RestMethod -Uri "$API/audit-log?organizationId=$ORG_ID&limit=10" -Headers $HDR
$runEntry = $audit.data | Where-Object { $_.entity_id -eq $RUN_ID }
Assert "Audit log entry for run" ($null -ne $runEntry) "No entry found for run $RUN_ID"
Write-Host "  Audit event: $($runEntry.event_type) — $($runEntry.summary)"

# =============================================================================
Write-Host ""
Write-Host "=== All Phase 9 Tests PASSED ✅ ===" -ForegroundColor Green
Write-Host ""

<# ── WORKFLOW SETUP GUIDE ──────────────────────────────────────────────────────

Create the Invoice Workflow in the Workflow Builder (http://localhost:3000):

1. Create a new workflow inside the Phase9 Test Project
2. Set Trigger type = "manual"
   Inputs: resourceId (string), orgId (string), projectId (string)

3. Add these 5 nodes in sequence:

   Node 1: finance.submit_invoice
     Properties:
       resourceId  → {{ inputs.resourceId }}
       submittedBy → (hardcode your user ID: dddddddd-0001-0000-0000-000000000001)

   Node 2: finance.verify_invoice
     Properties:
       resourceId        → {{ inputs.resourceId }}
       verifiedBy        → (hardcode your user ID)
       verificationNotes → "QS verified"

   Node 3: foundation.request_approval
     Properties:
       resourceId   → {{ inputs.resourceId }}
       approvalType → "invoice_approval"
       title        → "Approve Invoice for Payment"
       requiredRole → "admin"

   Node 4: finance.approve_invoice
     Properties:
       resourceId     → {{ inputs.resourceId }}
       approvedBy     → (hardcode your user ID)
       approvalTaskId → {{ nodes.node3.output.taskId }}
       approvalResult → {{ nodes.node3.output.decision }}

   Node 5: finance.process_payment
     Properties:
       resourceId       → {{ inputs.resourceId }}
       processedBy      → (hardcode your user ID)
       paymentReference → "TT-SEED-001"
       paymentDate      → "2026-07-01"

4. Publish the workflow
5. Copy the workflow UUID into $INVOICE_WORKFLOW_ID above

#>
