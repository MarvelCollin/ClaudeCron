const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const config = JSON.parse(fs.readFileSync(path.join(root, 'claudecron.config.json'), 'utf8'));

function fail(message) {
  throw new Error(message);
}

function requireString(value, name) {
  if (!value || typeof value !== 'string') fail(`${name} is required.`);
}

function requireBool(value, name) {
  if (typeof value !== 'boolean') fail(`${name} is required.`);
}

function parseScript(file) {
  new Function(fs.readFileSync(path.join(root, file), 'utf8'));
}

requireString(config.taskName, 'taskName');
requireString(config.macLabel, 'macLabel');
requireString(config.prompt, 'prompt');
requireString(config.logFile, 'logFile');
requireBool(config.wakeToRun, 'wakeToRun');
requireBool(config.runWhenLocked, 'runWhenLocked');
if (config.model !== 'haiku') fail('model must be haiku.');
if (!Array.isArray(config.schedules) || config.schedules.length === 0) fail('schedules is required.');

let calendarCount = 0;
for (const schedule of config.schedules) {
  if (!Array.isArray(schedule.days) || schedule.days.length === 0) fail('Schedule days are required.');
  if (!Array.isArray(schedule.times) || schedule.times.length === 0) fail('Schedule times are required.');
  for (const time of schedule.times) {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(String(time))) fail(`Invalid time: ${time}`);
  }
  calendarCount += schedule.days.length * schedule.times.length;
}

parseScript('scripts/run-claude.js');
parseScript('scripts/task.js');

if (process.platform === 'win32') {
  const command = "$null = [scriptblock]::Create((Get-Content -Raw scripts\\install-task.ps1)); $null = [scriptblock]::Create((Get-Content -Raw scripts\\run-claude.ps1)); Write-Output 'powershell ok'";
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) fail(result.stderr || result.stdout || 'PowerShell parse failed.');
}

console.log(`check ok: ${calendarCount} mac calendar entries`);
