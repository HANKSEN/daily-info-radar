[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$RepoRoot,
  [Parameter(Mandatory = $true)][string]$NodePath,
  [Parameter(Mandatory = $true)][string]$DataDir,
  [Parameter(Mandatory = $true)][ValidateRange(0, 23)][int]$Hour,
  [Parameter(Mandatory = $true)][ValidateRange(0, 59)][int]$Minute
)

$ErrorActionPreference = "Stop"
$dailyTaskName = "DailyInfoRadar-Daily"
$botTaskName = "DailyInfoRadar-Bot"
$dailyScript = Join-Path $RepoRoot "scripts\windows\daily.ps1"
$botScript = Join-Path $RepoRoot "scripts\windows\bot.ps1"
$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

function Quote-TaskArgument([string]$Value) {
  if ($Value.Contains('"')) {
    throw "Task arguments cannot contain a double quote"
  }
  return '"' + $Value + '"'
}

$sharedArguments = "-RepoRoot $(Quote-TaskArgument $RepoRoot) -NodePath $(Quote-TaskArgument $NodePath) -DataDir $(Quote-TaskArgument $DataDir)"
$dailyAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File $(Quote-TaskArgument $dailyScript) $sharedArguments"
$botAction = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -ExecutionPolicy Bypass -File $(Quote-TaskArgument $botScript) $sharedArguments"
$dailyAt = [DateTime]::Today.AddHours($Hour).AddMinutes($Minute)
$dailyTrigger = New-ScheduledTaskTrigger -Daily -At $dailyAt
$botTrigger = New-ScheduledTaskTrigger -AtLogOn -User $currentUser
$principal = New-ScheduledTaskPrincipal -UserId $currentUser -LogonType Interactive -RunLevel Limited
$dailySettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RunOnlyIfNetworkAvailable -StartWhenAvailable -WakeToRun -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 2)
$botSettings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RunOnlyIfNetworkAvailable -StartWhenAvailable -MultipleInstances IgnoreNew -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)

Register-ScheduledTask -TaskName $dailyTaskName -Action $dailyAction -Trigger $dailyTrigger -Principal $principal -Settings $dailySettings -Description "Generate and send the Daily Info Radar brief" -Force | Out-Null
Register-ScheduledTask -TaskName $botTaskName -Action $botAction -Trigger $botTrigger -Principal $principal -Settings $botSettings -Description "Keep the Daily Info Radar Feishu bot listener running" -Force | Out-Null
Start-ScheduledTask -TaskName $botTaskName

@{
  ok = $true
  dailyTask = $dailyTaskName
  botTask = $botTaskName
  schedule = "{0:D2}:{1:D2}" -f $Hour, $Minute
} | ConvertTo-Json -Compress
