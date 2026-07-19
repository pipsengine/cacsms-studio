param(
  [string]$ServiceName = "cacsms-studio-image-daemon",
  [string]$RootPath = "C:\Content-Generation\cacsms-studio",
  [int]$DaemonPort = 3025,
  [string]$NssmPath = ""
)

$ErrorActionPreference = "Stop"

$principal = New-Object Security.Principal.WindowsPrincipal(
  [Security.Principal.WindowsIdentity]::GetCurrent()
)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "This installer must be run from an elevated PowerShell session (Run as Administrator)."
}

$pythonPath = Join-Path $RootPath "local-models\image-renderer\.venv\Scripts\python.exe"
$daemonScript = Join-Path $RootPath "local-models\image-renderer\render_daemon.py"
if (-not (Test-Path $pythonPath)) {
  throw "Python venv was not found: $pythonPath"
}
if (-not (Test-Path $daemonScript)) {
  throw "Render daemon script was not found: $daemonScript"
}

function Resolve-NssmPath {
  param([string]$RequestedPath)

  if ($RequestedPath -and (Test-Path $RequestedPath)) {
    return (Resolve-Path $RequestedPath).Path
  }

  $candidates = @(
    (Join-Path $PSScriptRoot ".tools\nssm\nssm.exe"),
    "C:\Next-Generation\cacsms-studio\infrastructure\deployment\iis\.tools\nssm\nssm.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return (Resolve-Path $candidate).Path
    }
  }
  return ""
}

$NssmPath = Resolve-NssmPath -RequestedPath $NssmPath
if (-not $NssmPath) {
  throw "NSSM was not found. Run infrastructure\deployment\iis\install-nssm.ps1 first."
}

function Invoke-Nssm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & $NssmPath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "NSSM command failed (exit code $LASTEXITCODE): $($Arguments -join ' ')"
  }
}

$logPath = Join-Path $RootPath "logs"
New-Item -ItemType Directory -Path $logPath -Force | Out-Null

$modelPath = Join-Path $RootPath "local-models\image-renderer\models\realistic-vision-v51-checkpoint\Realistic_Vision_V5.1_fp16-no-ema.safetensors"
$envBlock = @(
  "CACSMS_PROJECT_ROOT=$RootPath",
  "CACSMS_LOCAL_IMAGE_MODEL_DIR=$RootPath\local-models\image-renderer",
  "CACSMS_LOCAL_IMAGE_MODEL_ID=$modelPath",
  "CACSMS_LOCAL_IMAGE_MODEL_NAME=CACSMS Local Photoreal Human Model (Realistic_Vision_V5.1_fp16-no-ema.safetensors)",
  "CACSMS_LOCAL_IMAGE_DEVICE=cpu",
  "CACSMS_LOCAL_IMAGE_OFFLINE=1",
  "CACSMS_LOCAL_IMAGE_DISABLE_SCRIPT_FALLBACK=1",
  "CACSMS_LOCAL_IMAGE_STEPS=28",
  "CACSMS_LOCAL_IMAGE_GUIDANCE=7.0",
  "CACSMS_LOCAL_IMAGE_USE_DPM_SOLVER=1",
  "CACSMS_LOCAL_IMAGE_FACE_ENHANCE=1",
  "CACSMS_LOCAL_IMAGE_MAX_DIFFUSION_WIDTH=512",
  "CACSMS_LOCAL_IMAGE_MAX_DIFFUSION_HEIGHT=512",
  "CACSMS_LOCAL_IMAGE_DAEMON_HOST=127.0.0.1",
  "CACSMS_LOCAL_IMAGE_DAEMON_PORT=$DaemonPort"
)

$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing -and $existing.Status -ne "Stopped") {
  Stop-Service -Name $ServiceName -Force
  (Get-Service -Name $ServiceName).WaitForStatus("Stopped", [TimeSpan]::FromSeconds(60))
}
if (-not $existing) {
  Invoke-Nssm install $ServiceName $pythonPath
}

Invoke-Nssm set $ServiceName Application $pythonPath
Invoke-Nssm set $ServiceName AppDirectory (Join-Path $RootPath "local-models\image-renderer")
Invoke-Nssm set $ServiceName AppParameters $daemonScript
Invoke-Nssm set $ServiceName DisplayName "CACSMS Local Image Render Daemon"
Invoke-Nssm set $ServiceName Description "Keeps the local diffusion model warm for CACSMS image generation."
Invoke-Nssm set $ServiceName Start SERVICE_AUTO_START
Invoke-Nssm set $ServiceName AppEnvironmentExtra @envBlock
Invoke-Nssm set $ServiceName AppExit Default Restart
Invoke-Nssm set $ServiceName AppRestartDelay 10000
Invoke-Nssm set $ServiceName AppThrottle 5000
Invoke-Nssm set $ServiceName AppStdout (Join-Path $logPath "image-daemon.log")
Invoke-Nssm set $ServiceName AppStderr (Join-Path $logPath "image-daemon-error.log")
Invoke-Nssm set $ServiceName AppRotateFiles 1
Invoke-Nssm set $ServiceName AppRotateOnline 1
Invoke-Nssm set $ServiceName AppRotateBytes 10485760

Start-Service -Name $ServiceName
(Get-Service -Name $ServiceName).WaitForStatus("Running", [TimeSpan]::FromSeconds(30))

$deadline = (Get-Date).AddMinutes(8)
do {
  try {
    $health = Invoke-RestMethod -Uri "http://127.0.0.1:$DaemonPort/health" -TimeoutSec 5
  } catch {
    $health = $null
    Start-Sleep -Seconds 5
  }
} until (($health -and $health.modelLoaded) -or (Get-Date) -ge $deadline)

if (-not ($health -and $health.modelLoaded)) {
  Write-Warning "Daemon is running but the diffusion model is still loading. Check $logPath\image-daemon.log"
} else {
  Write-Host "Local image render daemon is ready on http://127.0.0.1:$DaemonPort"
}
