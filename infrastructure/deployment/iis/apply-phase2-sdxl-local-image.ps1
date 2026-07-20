param(
  [string]$NodeServiceName = "cacsms-studio-node",
  [string]$DaemonServiceName = "cacsms-studio-image-daemon",
  [string]$RootPath = "C:\Next-Generation\cacsms-studio",
  [int]$InternalPort = 3018,
  [int]$PublicPort = 3008,
  [int]$DaemonPort = 3025,
  [string]$NssmPath = "",
  [switch]$SkipDownload
)

$ErrorActionPreference = "Stop"

$principal = New-Object Security.Principal.WindowsPrincipal(
  [Security.Principal.WindowsIdentity]::GetCurrent()
)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
  throw "This installer must be run from an elevated PowerShell session (Run as Administrator)."
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

$pythonPath = Join-Path $RootPath "local-models\image-renderer\.venv\Scripts\python.exe"
$renderScript = Join-Path $RootPath "local-models\image-renderer\render.py"
$validatorScript = Join-Path $RootPath "local-models\image-renderer\validate_image.py"
$downloadScript = Join-Path $RootPath "local-models\image-renderer\download_sdxl_model.py"
$modelPath = Join-Path $RootPath "local-models\image-renderer\models\realvisxl-v4\RealVisXL_V4.0.safetensors"

if (-not $SkipDownload) {
  Write-Host "Ensuring huggingface_hub is available..."
  & $pythonPath -m pip install --upgrade huggingface_hub | Out-Host
  Write-Host "Downloading local SDXL photoreal checkpoint (one-time, free)..."
  & $pythonPath $downloadScript | Out-Host
}

if (-not (Test-Path $modelPath)) {
  throw "SDXL model was not found at $modelPath. Re-run without -SkipDownload or place the checkpoint manually."
}

$sharedEnv = @(
  "CACSMS_PROJECT_ROOT=$RootPath",
  "CACSMS_LOCAL_IMAGE_MODEL_DIR=$RootPath\local-models\image-renderer",
  "CACSMS_LOCAL_IMAGE_MODEL_ID=$modelPath",
  "CACSMS_LOCAL_IMAGE_MODEL_FAMILY=sdxl",
  "CACSMS_LOCAL_IMAGE_MODEL_NAME=CACSMS Local Photoreal Human Model (RealVisXL_V4.0 SDXL)",
  "CACSMS_LOCAL_IMAGE_DEVICE=cpu",
  "CACSMS_LOCAL_IMAGE_OFFLINE=1",
  "CACSMS_LOCAL_IMAGE_DISABLE_SCRIPT_FALLBACK=1",
  "CACSMS_LOCAL_IMAGE_STEPS=22",
  "CACSMS_LOCAL_IMAGE_GUIDANCE=6.0",
  "CACSMS_LOCAL_IMAGE_USE_DPM_SOLVER=1",
  "CACSMS_LOCAL_IMAGE_FACE_ENHANCE=1",
  "CACSMS_LOCAL_IMAGE_MAX_DIFFUSION_WIDTH=768",
  "CACSMS_LOCAL_IMAGE_MAX_DIFFUSION_HEIGHT=768",
  "CACSMS_LOCAL_IMAGE_SHARPNESS=1.18",
  "CACSMS_LOCAL_IMAGE_CONTRAST=1.04",
  "CACSMS_LOCAL_IMAGE_UNSHARP_RADIUS=1.0",
  "CACSMS_LOCAL_IMAGE_UNSHARP_PERCENT=125",
  "CACSMS_LOCAL_IMAGE_UNSHARP_THRESHOLD=2",
  "CACSMS_LOCAL_IMAGE_DAEMON_HOST=127.0.0.1",
  "CACSMS_LOCAL_IMAGE_DAEMON_PORT=$DaemonPort"
)

$nodeEnv = @(
  "NODE_ENV=production",
  "PORT=$InternalPort",
  "CACSMS_PUBLIC_PORT=$PublicPort",
  "CACSMS_INTERNAL_AUTONOMY_TOKEN=cacsms-local-autonomy-token"
) + $sharedEnv + @(
  "CACSMS_LOCAL_IMAGE_DAEMON_URL=http://127.0.0.1:$DaemonPort",
  "CACSMS_LOCAL_IMAGE_RENDER_COMMAND=$pythonPath",
  "CACSMS_LOCAL_IMAGE_RENDER_ARGS=$renderScript --prompt-file {promptFile} --output {outputFile} --width {width} --height {height} --seed {seed}",
  "CACSMS_LOCAL_IMAGE_VALIDATOR_COMMAND=$pythonPath",
  "CACSMS_LOCAL_IMAGE_VALIDATOR_SCRIPT=$validatorScript",
  "CACSMS_LOCAL_IMAGE_VALIDATOR_TIMEOUT_MS=180000",
  "CACSMS_LOCAL_IMAGE_RENDER_TIMEOUT_MS=3600000",
  "CACSMS_IMAGE_GENERATION_SCHEDULER_TIMEOUT_MS=3900000",
  "CACSMS_IMAGE_GENERATION_VARIANT_COUNT=3",
  "CACSMS_IMAGE_GENERATION_MAX_VARIANTS=12",
  "CACSMS_IMAGE_GENERATION_INTERVAL_MS=90000",
  "CACSMS_STORYBOARD_FRAMES_PER_CYCLE=0",
  "CACSMS_STORYBOARD_IMAGEGEN_LINKS_PER_CYCLE=3"
)

Write-Host "Installing/updating SDXL warm render daemon..."
if (Get-Service -Name $DaemonServiceName -ErrorAction SilentlyContinue) {
  if ((Get-Service -Name $DaemonServiceName).Status -ne "Stopped") {
    Stop-Service -Name $DaemonServiceName -Force
    (Get-Service -Name $DaemonServiceName).WaitForStatus("Stopped", [TimeSpan]::FromSeconds(120))
  }
} else {
  & (Join-Path $PSScriptRoot "install-image-render-daemon.ps1") -ServiceName $DaemonServiceName -RootPath $RootPath -DaemonPort $DaemonPort -NssmPath $NssmPath
}

Invoke-Nssm set $DaemonServiceName Application $pythonPath
Invoke-Nssm set $DaemonServiceName AppDirectory (Join-Path $RootPath "local-models\image-renderer")
Invoke-Nssm set $DaemonServiceName AppParameters (Join-Path $RootPath "local-models\image-renderer\render_daemon.py")
Invoke-Nssm set $DaemonServiceName AppEnvironmentExtra @sharedEnv
Start-Service -Name $DaemonServiceName
(Get-Service -Name $DaemonServiceName).WaitForStatus("Running", [TimeSpan]::FromSeconds(30))

$nodeService = Get-Service -Name $NodeServiceName -ErrorAction SilentlyContinue
if (-not $nodeService) {
  throw "Node service '$NodeServiceName' was not found."
}
if ($nodeService.Status -ne "Stopped") {
  Stop-Service -Name $NodeServiceName -Force
  (Get-Service -Name $NodeServiceName).WaitForStatus("Stopped", [TimeSpan]::FromSeconds(60))
}
Invoke-Nssm set $NodeServiceName AppEnvironmentExtra @nodeEnv
Start-Service -Name $NodeServiceName
(Get-Service -Name $NodeServiceName).WaitForStatus("Running", [TimeSpan]::FromSeconds(30))

$deadline = (Get-Date).AddMinutes(12)
do {
  try {
    $daemonHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$DaemonPort/health" -TimeoutSec 5
  } catch {
    $daemonHealth = $null
    Start-Sleep -Seconds 5
  }
} until (($daemonHealth -and $daemonHealth.modelLoaded) -or (Get-Date) -ge $deadline)

$health = Invoke-RestMethod -Uri "http://127.0.0.1:$InternalPort/api/health" -TimeoutSec 10
Write-Host "Phase 2 SDXL local image settings applied."
Write-Host "Node service: http://127.0.0.1:$InternalPort/api/health -> $($health.status)"
if ($daemonHealth -and $daemonHealth.modelLoaded) {
  Write-Host "Render daemon: http://127.0.0.1:$DaemonPort/health -> modelLoaded=true"
} else {
  Write-Warning "Render daemon is running but SDXL model is still loading. Check logs\image-daemon.log"
}
