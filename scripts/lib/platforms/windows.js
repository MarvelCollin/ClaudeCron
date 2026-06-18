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
  const info = summary(context);
  if (!info.installed) {
    console.log('Task is not installed.');
    return;
  }
  console.log('');
  console.log('Installed: Yes');
  console.log(`Enabled: ${info.enabled}`);
  console.log(`Current state: ${info.state}`);
  console.log(`Last run: ${info.lastRun}`);
  console.log(`Next run: ${info.nextRun}`);
  console.log(`Config next run: ${nextRunTime(context.config)}`);
  console.log(`Configured schedule: ${scheduleSummary(context.config)}`);
  console.log(`Last result: ${info.lastResult}`);
  console.log(`Run count: ${info.counts.runs}`);
  console.log(`Success count: ${info.counts.success}`);
  console.log(`Failed count: ${info.counts.failed}`);
  console.log(`Incomplete count: ${info.counts.incomplete}`);
  console.log(`Log: ${context.logPath}`);
}

function summary(context) {
  const counts = logCounts(context.logPath);
  if (!exists(context)) {
    return { installed: false, enabled: false, running: false, state: 'Not installed', lastRun: '-', nextRun: '-', lastResult: '-', counts };
  }
  const output = run('schtasks.exe', ['/Query', '/TN', context.config.taskName, '/V', '/FO', 'LIST']);
  const state = parseSchtasks(output, 'Status');
  const enabled = parseSchtasks(output, 'Scheduled Task State') === 'Enabled';
  return {
    installed: true,
    enabled,
    running: state === 'Running',
    state,
    lastRun: parseSchtasks(output, 'Last Run Time'),
    nextRun: enabled ? parseSchtasks(output, 'Next Run Time') : '-',
    lastResult: parseSchtasks(output, 'Last Result'),
    counts,
  };
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
  summary,
  status,
  runNow,
  stop,
  disable,
  enable,
  deleteTask,
  openLog,
};
