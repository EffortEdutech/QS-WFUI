param(
  [string]$ApiUrl = "http://localhost:4000/api/v1",
  [Parameter(Mandatory = $true)]
  [string]$Token,
  [Parameter(Mandatory = $true)]
  [string]$OrganizationId,
  [string]$BundlePath,
  [string]$ListingId
)

$ErrorActionPreference = "Stop"

$jsonHeaders = @{
  Authorization = "Bearer $Token"
  "Content-Type" = "application/json"
}

$authHeaders = @{
  Authorization = "Bearer $Token"
}

Write-Host "Phase 18 smoke: browse registry"
$browse = Invoke-RestMethod -Uri "$ApiUrl/registry/packs" -Headers $jsonHeaders
$browse | ConvertTo-Json -Depth 8

if ($BundlePath) {
  if (-not (Test-Path -LiteralPath $BundlePath)) {
    throw "BundlePath not found: $BundlePath"
  }

  Write-Host "Phase 18 smoke: submit bundle"
  $submit = Invoke-RestMethod `
    -Uri "$ApiUrl/registry/packs/submit" `
    -Method POST `
    -Headers $authHeaders `
    -Form @{ bundle = Get-Item -LiteralPath $BundlePath }
  $submit | ConvertTo-Json -Depth 8
}

if ($ListingId) {
  Write-Host "Phase 18 smoke: install registry listing"
  $install = Invoke-RestMethod `
    -Uri "$ApiUrl/marketplace/registry/$ListingId/install?organizationId=$OrganizationId" `
    -Method POST `
    -Headers $jsonHeaders `
    -Body "{}"
  $install | ConvertTo-Json -Depth 8

  Write-Host "Phase 18 smoke: verify installed packs list"
  $packs = Invoke-RestMethod -Uri "$ApiUrl/marketplace/packs" -Headers $jsonHeaders
  $packs | ConvertTo-Json -Depth 8
}

Write-Host "Phase 18 smoke complete"
