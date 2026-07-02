param(
  [Parameter(Mandatory=$true)]
  [string]$Token,

  [Parameter(Mandatory=$true)]
  [string]$OrganizationId,

  [string]$BaseUrl = "http://localhost:4000/api/v1",
  [string]$PackSlug = "lados.qs-rate-library"
)

$ErrorActionPreference = "Stop"

$headers = @{
  Authorization = "Bearer $Token"
}

function Assert-Success {
  param(
    [Parameter(Mandatory=$true)]
    $Response,
    [Parameter(Mandatory=$true)]
    [string]$Step
  )

  if (-not $Response.success) {
    $message = "Unknown error"
    if ($Response.error -and $Response.error.message) {
      $message = $Response.error.message
    }
    throw "$Step failed: $message"
  }
}

function Invoke-LadosGet {
  param([string]$Path)
  Invoke-RestMethod -Method GET -Uri "$BaseUrl$Path" -Headers $headers
}

function Invoke-LadosPost {
  param([string]$Path)
  Invoke-RestMethod -Method POST -Uri "$BaseUrl$Path" -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body "{}"
}

Write-Host "Phase 19 Data Pack smoke test" -ForegroundColor Cyan

$catalog = Invoke-LadosGet "/data-packs?organizationId=$OrganizationId"
Assert-Success $catalog "GET /data-packs"
Write-Host "Catalog count: $($catalog.data.Count)"

$detail = Invoke-LadosGet "/data-packs/$PackSlug`?organizationId=$OrganizationId"
Assert-Success $detail "GET /data-packs/:slug"
Write-Host "Pack detail: $($detail.data.displayName)"

$install = Invoke-LadosPost "/data-packs/$PackSlug/install?organizationId=$OrganizationId"
Assert-Success $install "POST /data-packs/:slug/install"
Write-Host "Installed: $($install.data.displayName)"

$installed = Invoke-LadosGet "/org/data-packs?organizationId=$OrganizationId"
Assert-Success $installed "GET /org/data-packs"
Write-Host "Installed count: $($installed.data.Count)"

$items = Invoke-LadosGet "/data-pack-items/search?organizationId=$OrganizationId&q=concrete&limit=10"
Assert-Success $items "GET /data-pack-items/search"
Write-Host "Search result count: $($items.data.Count)"

if ($items.data.Count -gt 0) {
  $itemId = $items.data[0].id
  $item = Invoke-LadosGet "/data-pack-items/$itemId`?organizationId=$OrganizationId"
  Assert-Success $item "GET /data-pack-items/:itemId"
  Write-Host "Item detail: $($item.data.title)"
  Write-Host "Source: $($item.data.sourceName) / $($item.data.sourceDate)"
}

Write-Host "Phase 19 smoke test passed." -ForegroundColor Green
