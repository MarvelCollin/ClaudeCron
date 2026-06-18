const { spawnSync } = require('child_process');
const { fromRoot } = require('../paths');
const { run, runInherited } = require('../process');
const { logCounts } = require('../log');
const { nextRunTime, scheduleSummary } = require('../config');

function exists(context) {
  const result = spawnSync('schtasks.exe', ['/Query', '/TN', context.config.taskName], { encoding: 'utf8' });
  return result.status === 0;
}

function install(context) {
  runInherited('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    fromRoot('scripts', 'install-task.ps1'),
    '-ConfigPath',
    context.configPath,
  ]);
}

function invoke(args) {
  runInherited('schtasks.exe', args);
}

function parseSchtasks(output, label) {
  const match = output.match(new RegExp(`^${label}:\\s*(.+)$`, 'mi'));
  return match ? match[1].trim() : '-';
}

function status(context) {
  if (!exists(context)) {
    console.log('Task is not installed.');
    return;
  }
  const output = run('schtasks.exe', ['/Query', '/TN', context.config.taskName, '/V', '/FO', 'LIST']);
  const counts = logCounts(context.logPath);
  console.log('');
  console.log('Installed: Yes');
  console.log(`Enabled: ${parseSchtasks(output, 'Scheduled Task State') === 'Enabled'}`);
  console.log(`Current state: ${parseSchtasks(output, 'Status')}`);
  console.log(`Last run: ${parseSchtasks(output, 'Last Run Time')}`);
  console.log(`Next run: ${parseSchtasks(output, 'Next Run Time')}`);
  console.log(`Config next run: ${nextRunTime(context.config)}`);
  console.log(`Configured schedule: ${scheduleSummary(context.config)}`);
  console.log(`Last result: ${parseSchtasks(output, 'Last Result')}`);
  console.log(`Run count: ${counts.runs}`);
  console.log(`Success count: ${counts.success}`);
  console.log(`Failed count: ${counts.failed}`);
  console.log(`Incomplete count: ${counts.incomplete}`);
  console.log(`Log: ${context.logPath}`);
}

function runNow(context) {
  if (exists(context)) invoke(['/Run', '/TN', context.config.taskName]);
  else console.log('Task is not installed.');
}

function stop(context) {
  if (exists(context)) invoke(['/End', '/TN', context.config.taskName]);
  else console.log('Task is not installed.');
}

function disable(context) {
  if (exists(context)) invoke(['/Change', '/TN', context.config.taskName, '/DISABLE']);
  else console.log('Task is not installed.');
}

function enable(context) {
  if (exists(context)) invoke(['/Change', '/TN', context.config.taskName, '/ENABLE']);
  else console.log('Task is not installed.');
}

function deleteTask(context) {
  if (exists(context)) invoke(['/Delete', '/TN', context.config.taskName, '/F']);
  else console.log('Task is not installed.');
}

function openLog(context) {
  runInherited('notepad.exe', [context.logPath]);
}

module.exports = {
  name: 'windows',
  exists,
  install,
  status,
  runNow,
  stop,
  disable,
  enable,
  deleteTask,
  openLog,
};
