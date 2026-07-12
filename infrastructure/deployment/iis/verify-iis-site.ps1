param(
  [string]$Url = "http://localhost:3008/api/health"
)

$ErrorActionPreference = "Stop"

$response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 20

if ($response.status -ne "ok") {
  throw "Health check failed for $Url"
}

Write-Host "CACSMS Studio health check passed."
$response | ConvertTo-Json -Depth 5
