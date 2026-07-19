param(
  [string]$NodeServiceName = "cacsms-studio-node",
  [string]$DaemonServiceName = "cacsms-studio-image-daemon",
  [string]$RootPath = "C:\Content-Generation\cacsms-studio",
  [int]$InternalPort = 3018,
  [int]$PublicPort = 3008,
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

$modelPath = Join-Path $RootPath "local-models\image-renderer\models\realistic-vision-v51-checkpoint\Realistic_Vision_V5.1_fp16-no-ema.safetensors"
$pythonPath = Join-Path $RootPath "local-models\image-renderer\.venv\Scripts\python.exe"
$renderScript = Join-Path $RootPath "local-models\image-renderer\render.py"
$validatorScript = Join-Path $RootPath "local-models\image-renderer\validate_image.py"

$nodeEnv = @(
  "NODE_ENV=production",
  "PORT=$InternalPort",
  "CACSMS_PUBLIC_PORT=$PublicPort",
  "CACSMS_INTERNAL_AUTONOMY_TOKEN=cacsms-local-autonomy-token",
  "CACSMS_PROJECT_ROOT=$RootPath",
  "CACSMS_LOCAL_IMAGE_DAEMON_URL=http://127.0.0.1:$DaemonPort",
  "CACSMS_LOCAL_IMAGE_RENDER_COMMAND=$pythonPath",
  "CACSMS_LOCAL_IMAGE_RENDER_ARGS=$renderScript --prompt-file {promptFile} --output {outputFile} --width {width} --height {height} --seed {seed}",
  "CACSMS_LOCAL_IMAGE_VALIDATOR_COMMAND=$pythonPath",
  "CACSMS_LOCAL_IMAGE_VALIDATOR_SCRIPT=$validatorScript",
  "CACSMS_LOCAL_IMAGE_VALIDATOR_TIMEOUT_MS=180000",
  "CACSMS_LOCAL_IMAGE_MODEL_DIR=$RootPath\local-models\image-renderer",
  "CACSMS_LOCAL_IMAGE_MODEL_NAME=CACSMS Local Photoreal Human Model (Realistic_Vision_V5.1_fp16-no-ema.safetensors)",
  "CACSMS_LOCAL_IMAGE_RENDER_TIMEOUT_MS=2700000",
  "CACSMS_IMAGE_GENERATION_SCHEDULER_TIMEOUT_MS=3000000",
  "CACSMS_LOCAL_IMAGE_DEVICE=cpu",
  "CACSMS_LOCAL_IMAGE_OFFLINE=1",
  "CACSMS_LOCAL_IMAGE_STEPS=28",
  "CACSMS_LOCAL_IMAGE_GUIDANCE=7.0",
  "CACSMS_LOCAL_IMAGE_USE_DPM_SOLVER=1",
  "CACSMS_LOCAL_IMAGE_FACE_ENHANCE=1",
  "CACSMS_LOCAL_IMAGE_MAX_DIFFUSION_WIDTH=512",
  "CACSMS_LOCAL_IMAGE_MAX_DIFFUSION_HEIGHT=512",
  "CACSMS_LOCAL_IMAGE_SHARPNESS=1.45",
  "CACSMS_LOCAL_IMAGE_CONTRAST=1.06",
  "CACSMS_LOCAL_IMAGE_UNSHARP_RADIUS=1.1",
  "CACSMS_LOCAL_IMAGE_UNSHARP_PERCENT=135",
  "CACSMS_LOCAL_IMAGE_UNSHARP_THRESHOLD=2",
  "CACSMS_LOCAL_IMAGE_DISABLE_SCRIPT_FALLBACK=1",
  "CACSMS_LOCAL_IMAGE_MODEL_ID=$modelPath",
  "CACSMS_IMAGE_GENERATION_VARIANT_COUNT=3",
  "CACSMS_IMAGE_GENERATION_MAX_VARIANTS=12",
  "CACSMS_IMAGE_GENERATION_INTERVAL_MS=60000",
  "CACSMS_STORYBOARD_FRAMES_PER_CYCLE=0",
  "CACSMS_STORYBOARD_IMAGEGEN_LINKS_PER_CYCLE=3"
)

Write-Host "Installing/updating warm local image render daemon..."
& (Join-Path $PSScriptRoot "install-image-render-daemon.ps1") -ServiceName $DaemonServiceName -RootPath $RootPath -DaemonPort $DaemonPort -NssmPath $NssmPath

$nodeService = Get-Service -Name $NodeServiceName -ErrorAction SilentlyContinue
if (-not $nodeService) {
  throw "Node service '$NodeServiceName' was not found. Install it first with install-node-windows-service.ps1"
}

if ($nodeService.Status -ne "Stopped") {
  Stop-Service -Name $NodeServiceName -Force
  (Get-Service -Name $NodeServiceName).WaitForStatus("Stopped", [TimeSpan]::FromSeconds(60))
}

Invoke-Nssm set $NodeServiceName AppEnvironmentExtra @nodeEnv
Start-Service -Name $NodeServiceName
(Get-Service -Name $NodeServiceName).WaitForStatus("Running", [TimeSpan]::FromSeconds(30))

$health = Invoke-RestMethod -Uri "http://127.0.0.1:$InternalPort/api/health" -TimeoutSec 10
Write-Host "Phase 1 local image settings applied."
Write-Host "Node service: http://127.0.0.1:$InternalPort/api/health -> $($health.status)"
Write-Host "Render daemon: http://127.0.0.1:$DaemonPort/health"
