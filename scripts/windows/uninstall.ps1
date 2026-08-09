$ErrorActionPreference = "Stop"
$taskNames = @("DailyInfoRadar-Daily", "DailyInfoRadar-Bot")

foreach ($taskName in $taskNames) {
  $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if ($null -ne $task) {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
  }
}

@{ ok = $true; removed = $taskNames } | ConvertTo-Json -Compress

