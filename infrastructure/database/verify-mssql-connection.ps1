param(
  [string]$EnvironmentFile = "C:\Next-Generation\cacsms-studio\apps\web\.env.local"
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $EnvironmentFile)) {
  throw "Database environment file was not found: $EnvironmentFile"
}

Get-Content -LiteralPath $EnvironmentFile | Where-Object {
  $_ -and -not $_.TrimStart().StartsWith("#")
} | ForEach-Object {
  $pair = $_.Split("=", 2)
  if ($pair.Count -eq 2) {
    [Environment]::SetEnvironmentVariable($pair[0], $pair[1], "Process")
  }
}

foreach ($name in "MSSQL_SERVER", "MSSQL_PORT", "MSSQL_DATABASE", "MSSQL_USER", "MSSQL_PASSWORD") {
  if (-not [Environment]::GetEnvironmentVariable($name, "Process")) {
    throw "Missing required database setting: $name"
  }
}

$sqlcmd = (Get-Command sqlcmd.exe -ErrorAction SilentlyContinue).Source
if (-not $sqlcmd) {
  throw "sqlcmd.exe is not installed or is not available on PATH."
}

$env:SQLCMDPASSWORD = $env:MSSQL_PASSWORD
$query = @"
SET NOCOUNT ON;
SELECT
  DB_NAME() AS database_name,
  SUSER_SNAME() AS login_name,
  (SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0) AS user_table_count;
"@

try {
  $arguments = @(
    "-S", "tcp:$($env:MSSQL_SERVER),$($env:MSSQL_PORT)",
    "-U", $env:MSSQL_USER,
    "-d", $env:MSSQL_DATABASE,
    "-b", "-W", "-Q", $query
  )
  if ($env:MSSQL_TRUST_SERVER_CERTIFICATE -eq "true") {
    $arguments += "-C"
  }

  & $sqlcmd @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "MSSQL verification failed with exit code $LASTEXITCODE."
  }
  Write-Host "CACSMS MSSQL connection verification passed."
} finally {
  Remove-Item Env:SQLCMDPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:MSSQL_PASSWORD -ErrorAction SilentlyContinue
}
