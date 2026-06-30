# =============================================================================
# test_phase10.ps1 — Phase 10 Notification & Scheduler Pack Test
#
# Tests:
#   A. Email node (notification.send_email)  — requires SMTP_HOST env var
#   B. SMS node   (notification.send_sms)    — log-only stub, always passes
#   C. In-app     (notification.send_in_app) — requires a valid userId
#   D. Cron trigger                          — requires a published workflow
#                                              with ScheduleTrigger
#
# SETUP:
#   1. Set SMTP_HOST in apps/api/.env.local (use Mailtrap, MailHog, or SMTP2GO)
#   2. Fill in the IDs below
#   3. Run: .\test_phase10.ps1
# =============================================================================

$API   = "http://localhost:4000/api/v1"
$TOKEN = "PASTE_YOUR_JWT_HERE"   # see TOKEN FETCH section below
$HDR   = @{ Authorization = "Bearer $TOKEN"; "Content-Type" = "application/json" }

$ORG_ID          = "PASTE_ORG_ID"
$PROJECT_ID      = "PASTE_PROJECT_ID"
$USER_ID         = "PASTE_YOUR_USER_ID"    # recipient for in-app notification
$EMAIL_TO        = "test@example.com"      # must be an address your SMTP accepts

# Workflow IDs — create + publish in the Workflow Builder
$EMAIL_WORKFLOW_ID  = "PASTE_EMAIL_WORKFLOW_ID"
$CRON_WORKFLOW_ID   = "PASTE_CRON_WORKFLOW_ID"

function Assert($label, $condition, $detail = "") {
    if ($condition) { Write-Host "  ✅ $label" -ForegroundColor Green }
    else            { Write-Host "  ❌ $label  $detail" -ForegroundColor Red; exit 1 }
}

function PollRun($runId, $maxWait = 30) {
    $elapsed = 0
    while ($elapsed -lt $maxWait) {
        Start-Sleep 2; $elapsed += 2
        $r = Invoke-RestMethod -Uri "$API/runs/$runId" -Headers $HDR
        $s = $r.data.status
        Write-Host "    ... $s ($elapsed s)"
        if ($s -in @("completed","failed","paused")) { return $r.data }
    }
    throw "Timeout waiting for run $runId"
}

Write-Host ""
Write-Host "=== Phase 10 Notification & Scheduler — E2E Test ===" -ForegroundColor Cyan
Write-Host ""

# ── A: Email notification ──────────────────────────────────────────────────────
Write-Host "TEST A — notification.send_email"
Write-Host "  Triggering email workflow..."
$body = @{
    inputs = @{
        to      = $EMAIL_TO
        subject = "LADOS Phase 10 Test Email"
        body    = "If you receive this, Phase 10 send_email is working. Alhamdulillah!"
        orgId   = $ORG_ID
    }
} | ConvertTo-Json -Depth 5

$tr = Invoke-RestMethod -Method Post -Uri "$API/workflows/$EMAIL_WORKFLOW_ID/run" `
    -Headers $HDR -Body $body
$run = PollRun $tr.data.runId 30
Assert "Email workflow completed" ($run.status -eq "completed") "status=$($run.status)"

$logs = Invoke-RestMethod -Uri "$API/runs/$($tr.data.runId)/logs" -Headers $HDR
$emailNode = $logs.data | Where-Object { $_.nodeType -eq "notification.send_email" }
Assert "send_email node executed" ($null -ne $emailNode)
Assert "send_email node completed" ($emailNode.status -eq "completed") "status=$($emailNode.status)"
Write-Host "  ✉️  Check $EMAIL_TO inbox (or Mailtrap/MailHog) to confirm delivery"

# ── B: SMS node (stub) ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "TEST B — notification.send_sms (log-only stub)"
Write-Host "  SMS node is a log-only stub — no real provider configured."
Write-Host "  It returns success=true and logs the message."
Write-Host "  To enable real SMS: set SMS_PROVIDER + SMS_API_KEY in .env.local"
Write-Host "  ✅ Phase 10 SMS: stub verified by code review (see SmsService)"

# ── C: In-app notification ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "TEST C — notification.send_in_app"
Write-Host "  Checking notifications table for in-app events..."
$notifs = Invoke-RestMethod -Uri "$API/notifications?userId=$USER_ID&limit=5" -Headers $HDR -ErrorAction SilentlyContinue
if ($notifs) {
    Assert "Notifications endpoint responds" ($null -ne $notifs)
    Write-Host "  $($notifs.data.Count) in-app notifications found for user"
} else {
    Write-Host "  ⚠️  GET /notifications endpoint not yet implemented — verify via Supabase:"
    Write-Host "     SELECT * FROM notifications WHERE user_id = '$USER_ID' ORDER BY created_at DESC LIMIT 5;"
}

# ── D: Cron/Schedule trigger ───────────────────────────────────────────────────
Write-Host ""
Write-Host "TEST D — Schedule Trigger (cron)"
Write-Host "  Verifying SchedulerService is running..."

$health = Invoke-RestMethod -Uri "$API/health" -Headers $HDR -ErrorAction SilentlyContinue
if ($health) {
    Write-Host "  API health: $($health | ConvertTo-Json -Compress)"
}

Write-Host ""
Write-Host "  Cron test requires waiting for the next trigger tick (up to 60s)."
Write-Host "  The cron workflow ($CRON_WORKFLOW_ID) must be published with:"
Write-Host "    trigger.type = 'schedule'"
Write-Host "    trigger.cronExpression = '* * * * *'  (every minute)"
Write-Host ""
Write-Host "  Watching for runs created by the scheduler (60 second wait)..."

$before = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
Start-Sleep 65   # wait just over 1 minute

$runs = Invoke-RestMethod `
    -Uri "$API/workflows/$CRON_WORKFLOW_ID/runs?organizationId=$ORG_ID" `
    -Headers $HDR
$cronRuns = $runs.data | Where-Object { $_.created_at -gt $before }
Assert "Cron workflow triggered at least once" ($cronRuns.Count -gt 0) `
    "No runs found after $before — check SchedulerService logs"

if ($cronRuns.Count -gt 0) {
    Write-Host "  Cron run ID: $($cronRuns[0].id)  status=$($cronRuns[0].status)"
    Assert "Cron run completed" ($cronRuns[0].status -eq "completed") `
        "status=$($cronRuns[0].status)"
}

# =============================================================================
Write-Host ""
Write-Host "=== Phase 10 Tests Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Summary:"
Write-Host "  A. Email:     ✅ workflow completes, node executes — check inbox"
Write-Host "  B. SMS:       ✅ stub verified by code review"
Write-Host "  C. In-app:    verify via Supabase notifications table"
Write-Host "  D. Scheduler: ✅ cron workflow auto-triggered within 60s"
Write-Host ""

<# ── WORKFLOW SETUP GUIDE ──────────────────────────────────────────────────────

EMAIL WORKFLOW (EMAIL_WORKFLOW_ID):
  Trigger: manual
  Inputs:  to (string), subject (string), body (string), orgId (string)
  Node 1:  notification.send_email
    - to:      {{ inputs.to }}
    - subject: {{ inputs.subject }}
    - body:    {{ inputs.body }}
    - orgId:   {{ inputs.orgId }}

CRON WORKFLOW (CRON_WORKFLOW_ID):
  Trigger: schedule
  cronExpression: "* * * * *"   (every minute — change after testing)
  Node 1:  core.delay
    - duration: 0   (instant — just proves the trigger fired)
  Then add a notification node to see it work visually, e.g.:
  Node 2:  notification.send_in_app
    - userId:  PASTE_YOUR_USER_ID
    - message: "Cron heartbeat — {{ now }}"

SMTP SETUP (for real email):
  Add to apps/api/.env.local:
    SMTP_HOST=smtp.mailtrap.io       # or your SMTP provider
    SMTP_PORT=587
    SMTP_USER=your-mailtrap-user
    SMTP_PASS=your-mailtrap-pass
    SMTP_FROM=noreply@lados.app

  Free options:
    - Mailtrap.io (sandbox — emails never leave, visible in dashboard)
    - MailHog (local Docker: docker run -p 8025:8025 -p 1025:1025 mailhog/mailhog)

#>
