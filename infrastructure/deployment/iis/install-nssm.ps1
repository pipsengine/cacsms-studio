param(
  [string]$InstallRoot = "",
  [string]$Version = "2.24",
  [switch]$Force
)

$ErrorActionPreference = "Stop"

if (-not $InstallRoot) {
  $InstallRoot = Join-Path $PSScriptRoot ".tools\nssm"
}

$downloadUrls = @(
  "https://nssm.cc/release/nssm-$Version.zip",
  "https://github.com/ONLYOFFICE/nssm/releases/download/v2.24.1/nssm_x64.zip"
)
if (-not [Environment]::Is64BitOperatingSystem) {
  $downloadUrls = @(
    "https://nssm.cc/release/nssm-$Version.zip",
    "https://github.com/ONLYOFFICE/nssm/releases/download/v2.24.1/nssm_x86.zip"
  )
}
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) "cacsms-nssm-$Version"
$zipPath = Join-Path $tempRoot "nssm-$Version.zip"
$extractPath = Join-Path $tempRoot "extract"
$targetPath = Join-Path $InstallRoot "nssm.exe"

if ((Test-Path $targetPath) -and -not $Force) {
  Write-Host "NSSM is already available at $targetPath"
  Write-Host "Install the CACSMS service with:"
  Write-Host "powershell -ExecutionPolicy Bypass -File infrastructure\deployment\iis\install-node-windows-service.ps1 -NssmPath `"$targetPath`""
  return
}

New-Item -ItemType Directory -Path $tempRoot -Force | Out-Null
New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
if (Test-Path $extractPath) {
  Remove-Item -LiteralPath $extractPath -Recurse -Force
}

$downloaded = $false
foreach ($downloadUrl in $downloadUrls) {
  try {
    Write-Host "Downloading NSSM from $downloadUrl"
    Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
    $downloaded = $true
    break
  } catch {
    Write-Warning "NSSM download failed from $downloadUrl`: $($_.Exception.Message)"
  }
}
if (-not $downloaded) {
  throw "NSSM download failed from all configured sources."
}

Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force

$platformFolder = if ([Environment]::Is64BitOperatingSystem) { "win64" } else { "win32" }
$sourcePath = Join-Path $extractPath "nssm-$Version\$platformFolder\nssm.exe"
if (-not (Test-Path $sourcePath)) {
  $directSource = Join-Path $extractPath "nssm.exe"
  if (Test-Path $directSource) {
    $sourcePath = $directSource
  }
}
if (-not (Test-Path $sourcePath)) {
  throw "Downloaded NSSM archive did not contain expected executable: $sourcePath"
}

Copy-Item -LiteralPath $sourcePath -Destination $targetPath -Force

Write-Host "NSSM installed at $targetPath"
Write-Host "Install the CACSMS service from an elevated PowerShell session with:"
Write-Host "powershell -ExecutionPolicy Bypass -File infrastructure\deployment\iis\install-node-windows-service.ps1 -NssmPath `"$targetPath`""
