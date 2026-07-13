param(
  [string]$ApplicationEnvironmentFile = "C:\Next-Generation\cacsms-studio\apps\web\.env.local",
  [string]$MigrationEnvironmentFile = "C:\Next-Generation\cacsms-studio\infrastructure\database\migration.env.local",
  [string]$MigrationDirectory = "C:\Next-Generation\cacsms-studio\infrastructure\database\migrations",
  [switch]$UseIntegratedSecurity
)

$ErrorActionPreference = "Stop"

function Import-EnvironmentFile([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return }
  Get-Content -LiteralPath $Path | Where-Object {
    $_ -and -not $_.TrimStart().StartsWith("#")
  } | ForEach-Object {
    $pair = $_.Split("=", 2)
    if ($pair.Count -eq 2) {
      [Environment]::SetEnvironmentVariable($pair[0], $pair[1], "Process")
    }
  }
}

Import-EnvironmentFile $ApplicationEnvironmentFile
Import-EnvironmentFile $MigrationEnvironmentFile

foreach ($name in "MSSQL_SERVER", "MSSQL_PORT", "MSSQL_DATABASE", "MSSQL_USER") {
  if (-not [Environment]::GetEnvironmentVariable($name, "Process")) {
    throw "Missing required migration setting: $name"
  }
}
if ($env:MSSQL_USER -notmatch "^[A-Za-z0-9_.-]+$") {
  throw "MSSQL_USER contains unsupported characters for a SQL principal."
}

$sqlcmd = (Get-Command sqlcmd.exe -ErrorAction SilentlyContinue).Source
if (-not $sqlcmd) { throw "sqlcmd.exe is not installed or is not available on PATH." }

$connectionArguments = @("-S", "tcp:$($env:MSSQL_SERVER),$($env:MSSQL_PORT)", "-d", $env:MSSQL_DATABASE, "-b", "-I")
if ($env:MSSQL_TRUST_SERVER_CERTIFICATE -eq "true") { $connectionArguments += "-C" }

if ($UseIntegratedSecurity) {
  $connectionArguments += "-E"
} else {
  if (-not $env:MSSQL_MIGRATION_USER -or -not $env:MSSQL_MIGRATION_PASSWORD) {
    throw "Provide a privileged login in migration.env.local or use -UseIntegratedSecurity. See migration.env.example."
  }
  $env:SQLCMDPASSWORD = $env:MSSQL_MIGRATION_PASSWORD
  $connectionArguments += @("-U", $env:MSSQL_MIGRATION_USER)
}

try {
  $migrations = Get-ChildItem -LiteralPath $MigrationDirectory -Filter "*.sql" -File | Sort-Object Name
  if (-not $migrations) { throw "No MSSQL migration files were found in $MigrationDirectory" }

  foreach ($migration in $migrations) {
    Write-Host "Applying MSSQL migration: $($migration.Name)"
    & $sqlcmd @connectionArguments -v "ApplicationUser=$($env:MSSQL_USER)" -i $migration.FullName
    if ($LASTEXITCODE -ne 0) {
      throw "Migration failed: $($migration.Name) (exit code $LASTEXITCODE)"
    }
  }
  Write-Host "CACSMS MSSQL migrations completed successfully."
} finally {
  Remove-Item Env:SQLCMDPASSWORD -ErrorAction SilentlyContinue
  Remove-Item Env:MSSQL_MIGRATION_PASSWORD -ErrorAction SilentlyContinue
}
