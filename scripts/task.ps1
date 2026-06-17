param(
  [string]$ConfigPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'claudecron.config.json')
)

$root = Split-Path -Parent $PSScriptRoot
$config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
$taskName = [string]$config.taskName
if ([string]::IsNullOrWhiteSpace($taskName)) { throw 'taskName is required.' }
$logFile = [string]$config.logFile
if ([string]::IsNullOrWhiteSpace($logFile)) { throw 'logFile is required.' }
$logPath = if ([System.IO.Path]::IsPathRooted($logFile)) { $logFile } else { Join-Path $root $logFile }

function Invoke-TaskCommand([string[]]$ArgsList) {
  & schtasks.exe @argsList
  if ($LASTEXITCODE -ne 0) { throw "schtasks failed with exit code $LASTEXITCODE." }
}

function Test-TaskExists {
  & schtasks.exe /Query /TN $taskName > $null 2>&1
  return $LASTEXITCODE -eq 0
}

function Show-TaskStatus {
  if (-not (Test-TaskExists)) {
    Write-Output 'Task is not installed.'
    return
  }
  $task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
  $info = Get-ScheduledTaskInfo -TaskName $taskName -ErrorAction Stop
  $runCount = 0
  $successCount = 0
  $failedCount = 0
  if (Test-Path $logPath) {
    $logText = (Get-Content -Raw $logPath) -replace "`0", ''
    $runCount = [regex]::Matches($logText, '(?m)^\[.+\] start\r?$').Count
    $successCount = [regex]::Matches($logText, '(?m)^\[.+\] exit 0\r?$').Count
    $failedCount = [regex]::Matches($logText, '(?m)^\[.+\] exit (?!0\r?$)\d+\r?$').Count
  }
  Write-Output ''
  Write-Output "Installed: Yes"
  Write-Output "Enabled: $($task.State -ne 'Disabled')"
  Write-Output "Current state: $($task.State)"
  Write-Output "Last run: $($info.LastRunTime)"
  Write-Output "Next run: $($info.NextRunTime)"
  Write-Output "Last result: $($info.LastTaskResult)"
  Write-Output "Run count: $runCount"
  Write-Output "Success count: $successCount"
  Write-Output "Failed count: $failedCount"
  Write-Output "Incomplete count: $($runCount - $successCount - $failedCount)"
  Write-Output "Log: $logPath"
}

function Show-Menu {
  Write-Output ''
  Write-Output "ClaudeCron task: $taskName"
  Write-Output '1. Install or update background task'
  Write-Output '2. Run once now'
  Write-Output '3. Stop current run'
  Write-Output '4. Disable scheduled runs'
  Write-Output '5. Enable scheduled runs'
  Write-Output '6. Show status'
  Write-Output '7. Open log'
  Write-Output '8. Delete task'
  Write-Output '0. Exit'
}

do {
  Show-Menu
  $choice = Read-Host 'Choose'
  switch ($choice) {
    '1' { & (Join-Path $PSScriptRoot 'install-task.ps1') -ConfigPath $ConfigPath }
    '2' { if (Test-TaskExists) { Invoke-TaskCommand -ArgsList @('/Run', '/TN', $taskName) } else { Write-Output 'Task is not installed.' } }
    '3' { if (Test-TaskExists) { Invoke-TaskCommand -ArgsList @('/End', '/TN', $taskName) } else { Write-Output 'Task is not installed.' } }
    '4' { if (Test-TaskExists) { Invoke-TaskCommand -ArgsList @('/Change', '/TN', $taskName, '/DISABLE') } else { Write-Output 'Task is not installed.' } }
    '5' { if (Test-TaskExists) { Invoke-TaskCommand -ArgsList @('/Change', '/TN', $taskName, '/ENABLE') } else { Write-Output 'Task is not installed.' } }
    '6' { Show-TaskStatus }
    '7' { if (Test-Path $logPath) { notepad.exe $logPath } else { Write-Output "Log not found: $logPath" } }
    '8' { if (Test-TaskExists) { Invoke-TaskCommand -ArgsList @('/Delete', '/TN', $taskName, '/F') } else { Write-Output 'Task is not installed.' } }
    '0' { return }
    default { Write-Output 'Invalid choice.' }
  }
} while ($true)
