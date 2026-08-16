[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$RepoRoot,
  [Parameter(Mandatory = $true)][string]$NodePath,
  [Parameter(Mandatory = $true)][string]$DataDir
)

$ErrorActionPreference = "Continue"
$logDir = Join-Path $DataDir "logs"
$logPath = Join-Path $logDir "task-scheduler-bot.log"
$cliPath = Join-Path $RepoRoot "src\cli.ts"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

Push-Location $RepoRoot
try {
  while ($true) {
    & $NodePath --experimental-strip-types $cliPath bot *>> $logPath
    $exitCode = $LASTEXITCODE
    "[$(Get-Date -Format o)] bot exited with $exitCode; restarting in 5 seconds" | Out-File -FilePath $logPath -Append -Encoding utf8
    Start-Sleep -Seconds 5
  }
}
finally {
  Pop-Location
}
