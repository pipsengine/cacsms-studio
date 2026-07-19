param(
  [string]$ServiceName = "cacsms-studio-node",
  [string]$ModelPath = "",
  [string]$ValidatorModelPath = "",
  [int]$Steps = 14,
  [double]$Guidance = 7.5,
  [int]$MaxDiffusionWidth = 768,
  [int]$MaxDiffusionHeight = 432,
  [double]$Sharpness = 1.45,
  [double]$Contrast = 1.06,
  [string]$NssmPath = "C:\Next-Generation\cacsms-studio\infrastructure\deployment\iis\.tools\nssm\nssm.exe"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$rendererCommand = Join-Path $PSScriptRoot "render.cmd"
$pythonCommand = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$rendererScript = Join-Path $PSScriptRoot "render.py"
$validatorScript = Join-Path $PSScriptRoot "validate_image.py"
if (Test-Path $pythonCommand) {
  $rendererCommand = $pythonCommand
  $rendererArgs = "`"$rendererScript`" --prompt-file {promptFile} --output {outputFile} --width {width} --height {height} --seed {seed}"
} else {
  $rendererArgs = "--prompt-file {promptFile} --output {outputFile} --width {width} --height {height} --seed {seed}"
}
if (-not (Test-Path $rendererCommand)) {
  throw "Renderer command not found at $rendererCommand"
}
if (-not (Test-Path $NssmPath)) {
  throw "NSSM not found at $NssmPath"
}

$environment = @(
  "NODE_ENV=production",
  "PORT=3018",
  "CACSMS_PUBLIC_PORT=3008",
  "CACSMS_INTERNAL_AUTONOMY_TOKEN=cacsms-local-autonomy-token",
  "CACSMS_PROJECT_ROOT=$repoRoot",
  "CACSMS_LOCAL_IMAGE_RENDER_COMMAND=$rendererCommand",
  "CACSMS_LOCAL_IMAGE_RENDER_ARGS=$rendererArgs",
  "CACSMS_LOCAL_IMAGE_VALIDATOR_COMMAND=$rendererCommand",
  "CACSMS_LOCAL_IMAGE_VALIDATOR_SCRIPT=$validatorScript",
  "CACSMS_LOCAL_IMAGE_VALIDATOR_TIMEOUT_MS=180000",
  "CACSMS_LOCAL_IMAGE_MODEL_DIR=$PSScriptRoot",
  "CACSMS_LOCAL_IMAGE_MODEL_NAME=CACSMS Independent Local 3D Human Scene Renderer",
  "CACSMS_LOCAL_IMAGE_RENDER_TIMEOUT_MS=300000",
  "CACSMS_LOCAL_IMAGE_DEVICE=cpu",
  "CACSMS_LOCAL_IMAGE_OFFLINE=1",
  "CACSMS_LOCAL_IMAGE_STEPS=$Steps",
  "CACSMS_LOCAL_IMAGE_GUIDANCE=$Guidance",
  "CACSMS_LOCAL_IMAGE_USE_DPM_SOLVER=1",
  "CACSMS_LOCAL_IMAGE_MAX_DIFFUSION_WIDTH=$MaxDiffusionWidth",
  "CACSMS_LOCAL_IMAGE_MAX_DIFFUSION_HEIGHT=$MaxDiffusionHeight",
  "CACSMS_LOCAL_IMAGE_SHARPNESS=$Sharpness",
  "CACSMS_LOCAL_IMAGE_CONTRAST=$Contrast",
  "CACSMS_LOCAL_IMAGE_UNSHARP_RADIUS=1.1",
  "CACSMS_LOCAL_IMAGE_UNSHARP_PERCENT=135",
  "CACSMS_LOCAL_IMAGE_UNSHARP_THRESHOLD=2"
)

if ($ModelPath.Trim()) {
  $resolvedModelPath = Resolve-Path $ModelPath
  $environment += "CACSMS_LOCAL_IMAGE_MODEL_ID=$resolvedModelPath"
  $modelLabel = Split-Path $resolvedModelPath -Leaf
  $environment = $environment | ForEach-Object {
    if ($_ -like "CACSMS_LOCAL_IMAGE_MODEL_NAME=*") {
      "CACSMS_LOCAL_IMAGE_MODEL_NAME=CACSMS Local Photoreal Human Model ($modelLabel)"
    } else {
      $_
    }
  }
}

if ($ValidatorModelPath.Trim()) {
  $resolvedValidatorModelPath = Resolve-Path $ValidatorModelPath
  $environment += "CACSMS_LOCAL_IMAGE_VALIDATOR_MODEL_ID=$resolvedValidatorModelPath"
}

& $NssmPath set $ServiceName AppEnvironmentExtra $environment
Restart-Service $ServiceName -Force
Start-Sleep -Seconds 4
Get-Service $ServiceName
