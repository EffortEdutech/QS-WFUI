# =============================================================================
# test_phase15_resource_bindings.ps1 - Phase 15 Resource Bindings smoke test
#
# Prerequisites:
#   1. API running at http://localhost:4000/api/v1
#   2. Migration 0049_resource_bindings.sql applied in Supabase
#   3. A valid Supabase user JWT pasted into $TOKEN or passed by parameter
#   4. Existing workflow, node, and resource IDs that belong to the same org
#
# Example:
#   .\test_phase15_resource_bindings.ps1 `
#     -Token "ey..." `
#     -WorkflowId "..." `
#     -NodeId "node-1" `
#     -BindingKey "boq_source" `
#     -ResourceId "..." `
#     -ResourceType "boq"
# =============================================================================

param(
  [string]$Api = "http://localhost:4000/api/v1",
  [Parameter(Mandatory = $true)][string]$Token,
  [Parameter(Mandatory = $true)][string]$WorkflowId,
  [Parameter(Mandatory = $true)][string]$NodeId,
  [Parameter(Mandatory = $true)][string]$BindingKey,
  [Parameter(Mandatory = $true)][string]$ResourceId,
  [Parameter(Mandatory = $true)][string]$ResourceType
)

$Headers = @{
  Authorization = "Bearer $Token"
  "Content-Type" = "application/json"
}

function Assert($Label, $Condition, $Detail = "") {
  if ($Condition) {
    Write-Host "  PASS $Label" -ForegroundColor Green
  } else {
    Write-Host "  FAIL $Label $Detail" -ForegroundColor Red
    exit 1
  }
}

Write-Host ""
Write-Host "=== Phase 15 Resource Bindings smoke test ===" -ForegroundColor Cyan
Write-Host ""

$basePath = "$Api/workflows/$WorkflowId/bindings"
$bindingPath = "$basePath/$NodeId/$BindingKey"

Write-Host "TEST A - list current bindings"
$listBefore = Invoke-RestMethod -Method Get -Uri $basePath -Headers $Headers
Assert "GET bindings returns success" ($listBefore.success -eq $true)

Write-Host "TEST B - create or update binding"
$body = @{
  resourceId = $ResourceId
  resourceType = $ResourceType
} | ConvertTo-Json -Depth 3

$created = Invoke-RestMethod -Method Put -Uri $bindingPath -Headers $Headers -Body $body
Assert "PUT binding returns success" ($created.success -eq $true)
Assert "PUT binding returns requested node" ($created.data.nodeId -eq $NodeId) "nodeId=$($created.data.nodeId)"
Assert "PUT binding returns requested key" ($created.data.bindingKey -eq $BindingKey) "bindingKey=$($created.data.bindingKey)"
Assert "PUT binding returns requested resource" ($created.data.resourceId -eq $ResourceId) "resourceId=$($created.data.resourceId)"

Write-Host "TEST C - list includes created binding"
$listAfter = Invoke-RestMethod -Method Get -Uri $basePath -Headers $Headers
$match = $listAfter.data | Where-Object {
  $_.nodeId -eq $NodeId -and
  $_.bindingKey -eq $BindingKey -and
  $_.resourceId -eq $ResourceId
}
Assert "GET bindings includes saved binding" ($null -ne $match)

Write-Host "TEST D - delete binding"
$deleteResponse = Invoke-WebRequest -Method Delete -Uri $bindingPath -Headers $Headers
Assert "DELETE binding returns 204" ($deleteResponse.StatusCode -eq 204) "status=$($deleteResponse.StatusCode)"

Write-Host "TEST E - list no longer includes deleted binding"
$listDeleted = Invoke-RestMethod -Method Get -Uri $basePath -Headers $Headers
$deletedMatch = $listDeleted.data | Where-Object {
  $_.nodeId -eq $NodeId -and $_.bindingKey -eq $BindingKey
}
Assert "GET bindings no longer includes deleted binding" ($null -eq $deletedMatch)

Write-Host ""
Write-Host "Phase 15 Resource Bindings API smoke test passed." -ForegroundColor Green
