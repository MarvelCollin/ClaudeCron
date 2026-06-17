const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { root } = require('./lib/paths');
const { loadConfig, calendarEntryCount } = require('./lib/config');

function checkNode(file) {
  const result = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `Node syntax check failed: ${file}`);
}

function jsFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return jsFiles(file);
    return file.endsWith('.js') ? [path.relative(root, file)] : [];
  });
}

function checkPowerShell() {
  const command = "$null = [scriptblock]::Create((Get-Content -Raw scripts\\install-task.ps1)); $null = [scriptblock]::Create((Get-Content -Raw scripts\\run-claude.ps1)); Write-Output 'powershell ok'";
  const result = spawnSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command], { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || 'PowerShell parse failed.');
}

const context = loadConfig();
for (const file of jsFiles(path.join(root, 'scripts'))) checkNode(file);
if (process.platform === 'win32') checkPowerShell();
console.log(`check ok: ${calendarEntryCount(context.config)} mac calendar entries`);
