param(
  [string]$RootPath = "C:\Content-Generation\cacsms-studio",
  [int]$InternalPort = 3018,
  [int]$PublicPort = 3008
)

$ErrorActionPreference = "Stop"

Set-Location $RootPath
$env:NODE_ENV = "production"
$env:PORT = "$InternalPort"
$env:CACSMS_PUBLIC_PORT = "$PublicPort"
$env:CACSMS_PROJECT_ROOT = "$RootPath"

node "$RootPath\server.js"
