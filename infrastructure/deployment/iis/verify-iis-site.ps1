param(
  [string]$PublicUrl = "http://localhost:3008/api/health",
  [string]$InternalUrl = "http://127.0.0.1:3018/api/health",
  [string]$ServiceName = "cacsms-studio-node"
)

$ErrorActionPreference = "Stop"

$service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $service) {
  throw "Windows service '$ServiceName' is not installed. Run install-node-windows-service.ps1 as Administrator."
}
if ($service.Status -ne "Running") {
  throw "Windows service '$ServiceName' is $($service.Status), not Running."
}

$internalResponse = Invoke-RestMethod -Uri $InternalUrl -Method Get -TimeoutSec 20
if ($internalResponse.status -ne "ok") {
  throw "Node health check failed for $InternalUrl"
}

$publicResponse = Invoke-RestMethod -Uri $PublicUrl -Method Get -TimeoutSec 20
if ($publicResponse.status -ne "ok") {
  throw "IIS health check failed for $PublicUrl"
}

Write-Host "CACSMS Studio service and IIS health checks passed."
[pscustomobject]@{
  service = $ServiceName
  serviceStatus = $service.Status.ToString()
  internalUrl = $InternalUrl
  publicUrl = $PublicUrl
  status = $publicResponse.status
} | ConvertTo-Json -Depth 5
