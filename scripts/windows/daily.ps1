[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$RepoRoot,
  [Parameter(Mandatory = $true)][string]$NodePath,
  [Parameter(Mandatory = $true)][string]$DataDir
)

$ErrorActionPreference = "Stop"
$logDir = Join-Path $DataDir "logs"
$logPath = Join-Path $logDir "task-scheduler-daily.log"
$cliPath = Join-Path $RepoRoot "src\cli.ts"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Push-Location $RepoRoot
try {
  & $NodePath --experimental-strip-types $cliPath daily *>> $logPath
  $dailyExit = $LASTEXITCODE
  if ($dailyExit -ne 0) {
    exit $dailyExit
  }

  & $NodePath --experimental-strip-types $cliPath send:latest *>> $logPath
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}

