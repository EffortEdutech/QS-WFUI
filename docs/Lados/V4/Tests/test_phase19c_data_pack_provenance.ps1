param(
  [Parameter(Mandatory=$true)]
  [string]$Token,

  [Parameter(Mandatory=$true)]
  [string]$RunId,

  [string]$BaseUrl = "http://localhost:4000/api/v1"
)

$ErrorActionPreference = "Stop"

$headers = @{
  Authorization = "Bearer $Token"
}

Write-Host "Phase 19C Data Pack provenance smoke test" -ForegroundColor Cyan

$res = Invoke-RestMethod -Method GET -Uri "$BaseUrl/runs/$RunId/logs" -Headers $headers

if (-not $res.success) {
  $message = "Unknown error"
  if ($res.error -and $res.error.message) {
    $message = $res.error.message
  }
  throw "GET /runs/:runId/logs failed: $message"
}

$logs = @($res.data)
$usageLogs = @($logs | Where-Object {
  $_.data_pack_usages -and @($_.data_pack_usages).Count -gt 0
})

Write-Host "Log rows: $($logs.Count)"
Write-Host "Rows with Data Pack usage: $($usageLogs.Count)"

if ($usageLogs.Count -eq 0) {
  throw "No execution log row contains data_pack_usages. Run a workflow whose node config includes a Data Pack item id."
}

$firstUsage = @($usageLogs[0].data_pack_usages)[0]
Write-Host "Pack: $($firstUsage.packSlug) / v$($firstUsage.version)"
Write-Host "Item: $($firstUsage.itemKey) - $($firstUsage.title)"
Write-Host "Source: $($firstUsage.sourceName) / $($firstUsage.sourceDate)"
Write-Host "Advisory: $($firstUsage.advisoryStatus)"

Write-Host "Phase 19C provenance smoke test passed." -ForegroundColor Green
