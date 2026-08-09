$taskNames = @("DailyInfoRadar-Daily", "DailyInfoRadar-Bot")
$tasks = foreach ($taskName in $taskNames) {
  $task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
  if ($null -eq $task) {
    @{ taskName = $taskName; installed = $false; state = "Missing" }
  }
  else {
    $info = Get-ScheduledTaskInfo -TaskName $taskName
    @{
      taskName = $taskName
      installed = $true
      state = [string]$task.State
      lastRunTime = $info.LastRunTime
      lastTaskResult = $info.LastTaskResult
      nextRunTime = $info.NextRunTime
    }
  }
}

@{ ok = $true; tasks = $tasks } | ConvertTo-Json -Depth 4 -Compress
