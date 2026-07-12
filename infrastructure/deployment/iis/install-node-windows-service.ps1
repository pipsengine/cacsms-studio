param(
  [string]$ServiceName = "cacsms-studio-node",
  [string]$RootPath = "C:\Next-Generation\cacsms-studio",
  [int]$InternalPort = 3018,
  [int]$PublicPort = 3008
)

$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $RootPath "infrastructure\deployment\iis\start-node-service.ps1"
if (-not (Test-Path $scriptPath)) {
  throw "Node service runner was not found: $scriptPath"
}

$powershell = "$env:SystemRoot\System32\WindowsPowerShell\v1.0\powershell.exe"
$arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -RootPath `"$RootPath`" -InternalPort $InternalPort -PublicPort $PublicPort"

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
  Stop-Service -Name $ServiceName -ErrorAction SilentlyContinue
  sc.exe delete $ServiceName | Out-Null
  Start-Sleep -Seconds 2
}

New-Service `
  -Name $ServiceName `
  -DisplayName "CACSMS Studio Node Runtime" `
  -Description "Runs the CACSMS Studio Next.js runtime behind IIS reverse proxy." `
  -BinaryPathName "`"$powershell`" $arguments" `
  -StartupType Automatic | Out-Null

Start-Service -Name $ServiceName

Write-Host "Windows service '$ServiceName' started on internal port $InternalPort."
Write-Host "IIS should expose the app publicly on port $PublicPort."
