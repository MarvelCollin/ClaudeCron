const { spawn } = require('child_process');

function ps(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function runPowerShell(script) {
  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script], {
      windowsHide: true
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', data => {
      stdout += data.toString();
    });
    child.stderr.on('data', data => {
      stderr += data.toString();
    });
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `PowerShell exited with code ${code}`));
    });
  });
}

function taskName(id) {
  return `ClaudeCron-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
}

function actionArgs(launch, id) {
  if (launch.isPackaged) return `--run-task=${id}`;
  return `"${launch.appPath}" --run-task=${id}`;
}

async function registerSchedule(schedule, launch) {
  const script = `
$ErrorActionPreference = 'Stop'
$Action = New-ScheduledTaskAction -Execute ${ps(launch.exe)} -Argument ${ps(actionArgs(launch, schedule.id))} -WorkingDirectory ${ps(launch.cwd)}
$Trigger = New-ScheduledTaskTrigger -Once -At ([datetime]${ps(`${schedule.at}:00`)})
$Settings = New-ScheduledTaskSettingsSet -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName ${ps(taskName(schedule.id))} -Action $Action -Trigger $Trigger -Settings $Settings -Force | Out-Null
`;
  await runPowerShell(script);
}

async function unregisterSchedule(id) {
  const script = `
$Task = Get-ScheduledTask -TaskName ${ps(taskName(id))} -ErrorAction SilentlyContinue
if ($Task) {
  Unregister-ScheduledTask -TaskName ${ps(taskName(id))} -Confirm:$false
}
`;
  await runPowerShell(script);
}

module.exports = {
  registerSchedule,
  unregisterSchedule
};
