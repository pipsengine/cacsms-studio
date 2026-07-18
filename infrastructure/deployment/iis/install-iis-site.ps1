param(
  [string]$SiteName = "cacsms-studio",
  [string]$AppPoolName = "cacsms-studio",
  [string]$PhysicalPath = "C:\Content-Generation\cacsms-studio",
  [int]$Port = 3008
)

$ErrorActionPreference = "Stop"

Import-Module WebAdministration

if (-not (Test-Path $PhysicalPath)) {
  throw "PhysicalPath does not exist: $PhysicalPath"
}

if (-not (Get-WebGlobalModule -Name "RewriteModule" -ErrorAction SilentlyContinue)) {
  throw "Missing IIS URL Rewrite module. Install URL Rewrite before running this script."
}

if (-not (Test-Path "$env:windir\System32\inetsrv\config\schema\arr_schema.xml")) {
  throw "Missing IIS Application Request Routing. Install ARR before running this script."
}

Set-WebConfigurationProperty `
  -PSPath "MACHINE/WEBROOT/APPHOST" `
  -Filter "system.webServer/proxy" `
  -Name "enabled" `
  -Value "True"

if (-not (Test-Path "IIS:\AppPools\$AppPoolName")) {
  New-WebAppPool -Name $AppPoolName | Out-Null
}

Set-ItemProperty "IIS:\AppPools\$AppPoolName" -Name managedRuntimeVersion -Value ""
Set-ItemProperty "IIS:\AppPools\$AppPoolName" -Name processModel.identityType -Value "ApplicationPoolIdentity"
Set-ItemProperty "IIS:\AppPools\$AppPoolName" -Name recycling.periodicRestart.time -Value "00:00:00"

$existingSite = Get-Website -Name $SiteName -ErrorAction SilentlyContinue
if ($existingSite) {
  Set-ItemProperty "IIS:\Sites\$SiteName" -Name physicalPath -Value $PhysicalPath
  Set-ItemProperty "IIS:\Sites\$SiteName" -Name applicationPool -Value $AppPoolName
  $binding = Get-WebBinding -Name $SiteName -Protocol "http" | Where-Object { $_.bindingInformation -eq "*:${Port}:" }
  if (-not $binding) {
    New-WebBinding -Name $SiteName -Protocol "http" -Port $Port -IPAddress "*" | Out-Null
  }
} else {
  New-Website -Name $SiteName -PhysicalPath $PhysicalPath -Port $Port -ApplicationPool $AppPoolName | Out-Null
}

Set-WebConfigurationProperty `
  -Filter "/system.applicationHost/sites/site[@name='$SiteName']/application[@path='/']/virtualDirectory[@path='/']" `
  -Name physicalPath `
  -Value $PhysicalPath

Start-WebAppPool -Name $AppPoolName
Start-Website -Name $SiteName

Write-Host "IIS site '$SiteName' is configured at http://localhost:$Port"
Write-Host "Health endpoint: http://localhost:$Port/api/health"
Write-Host "This site reverse-proxies to the CACSMS Node runtime on http://127.0.0.1:3018"
