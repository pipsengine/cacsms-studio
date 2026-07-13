param(
  [string]$ServiceName = "cacsms-studio-node",
  [string]$RootPath = "C:\Next-Generation\cacsms-studio",
  [int]$InternalPort = 3018,
  [int]$PublicPort = 3008,
  [string]$NssmPath = ""
)

$ErrorActionPreference = "Stop"

$principal = New-Object Security.Principal.WindowsPrincipal(
  [Security.Principal.WindowsIdentity]::GetCurrent()
)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "This installer must be run from an elevated PowerShell session (Run as Administrator)."
}

$serverPath = Join-Path $RootPath "server.js"
$buildPath = Join-Path $RootPath "apps\web\.next\BUILD_ID"
if (-not (Test-Path $serverPath)) {
  throw "Node server entry point was not found: $serverPath"
}
if (-not (Test-Path $buildPath)) {
  throw "The production web build was not found. Run 'corepack pnpm build:web' before installing the service."
}

$nodePath = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $nodePath) {
  throw "node.exe was not found on PATH. Install Node.js 20 or newer before continuing."
}

if (-not $NssmPath) {
  $nssmCommand = Get-Command nssm.exe -ErrorAction SilentlyContinue
  if ($nssmCommand) {
    $NssmPath = $nssmCommand.Source
  }
}
if (-not $NssmPath -or -not (Test-Path $NssmPath)) {
  throw "NSSM was not found. Install NSSM or pass its full path with -NssmPath."
}

$logPath = Join-Path $RootPath "logs"
New-Item -ItemType Directory -Path $logPath -Force | Out-Null

function Invoke-Nssm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  & $NssmPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "NSSM command failed (exit code $LASTEXITCODE): $($Arguments -join ' ')"
  }
}

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
  if ($existing.Status -ne "Stopped") {
    Stop-Service -Name $ServiceName -Force
    (Get-Service -Name $ServiceName).WaitForStatus("Stopped", [TimeSpan]::FromSeconds(30))
  }
} else {
  Invoke-Nssm install $ServiceName $nodePath
}

$listeners = Get-NetTCPConnection -LocalPort $InternalPort -State Listen -ErrorAction SilentlyContinue
foreach ($listener in $listeners) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
  if ($process.Name -ne "node.exe" -or $process.CommandLine -notlike "*server.js*") {
    throw "Port $InternalPort is already owned by PID $($listener.OwningProcess) ($($process.Name)). Stop that process before installing the service."
  }

  Write-Host "Stopping temporary CACSMS Node process PID $($listener.OwningProcess) on port $InternalPort."
  Stop-Process -Id $listener.OwningProcess -Force
  Wait-Process -Id $listener.OwningProcess -Timeout 10 -ErrorAction SilentlyContinue
}

Invoke-Nssm set $ServiceName Application $nodePath
Invoke-Nssm set $ServiceName AppDirectory $RootPath
Invoke-Nssm set $ServiceName AppParameters $serverPath
Invoke-Nssm set $ServiceName DisplayName "CACSMS Studio Node Runtime"
Invoke-Nssm set $ServiceName Description "Runs the CACSMS Studio Next.js runtime behind IIS reverse proxy."
Invoke-Nssm set $ServiceName Start SERVICE_AUTO_START
Invoke-Nssm set $ServiceName AppEnvironmentExtra "NODE_ENV=production" "PORT=$InternalPort" "CACSMS_PUBLIC_PORT=$PublicPort"
Invoke-Nssm set $ServiceName AppExit Default Restart
Invoke-Nssm set $ServiceName AppRestartDelay 5000
Invoke-Nssm set $ServiceName AppThrottle 1500
Invoke-Nssm set $ServiceName AppStdout (Join-Path $logPath "node-service.log")
Invoke-Nssm set $ServiceName AppStderr (Join-Path $logPath "node-service-error.log")
Invoke-Nssm set $ServiceName AppRotateFiles 1
Invoke-Nssm set $ServiceName AppRotateOnline 1
Invoke-Nssm set $ServiceName AppRotateBytes 10485760

Start-Service -Name $ServiceName
(Get-Service -Name $ServiceName).WaitForStatus("Running", [TimeSpan]::FromSeconds(30))

$deadline = (Get-Date).AddSeconds(30)
do {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$InternalPort/api/health" -TimeoutSec 3
  } catch {
    $health = $null
    Start-Sleep -Seconds 1
  }
} until ($health.status -eq "ok" -or (Get-Date) -ge $deadline)

if ($health.status -ne "ok") {
  throw "Service '$ServiceName' started but its health endpoint did not become ready on port $InternalPort. Check $logPath."
}

Write-Host "Windows service '$ServiceName' is running on internal port $InternalPort."
Write-Host "IIS should expose the app publicly on port $PublicPort."
