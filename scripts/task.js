const fs = require('fs');
const os = require('os');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'claudecron.config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

function requireString(value, name) {
  if (!value || typeof value !== 'string') throw new Error(`${name} is required.`);
  return value;
}

function requireBool(value, name) {
  if (typeof value !== 'boolean') throw new Error(`${name} is required.`);
  return value;
}

const taskName = requireString(config.taskName, 'taskName');
const macLabel = requireString(config.macLabel, 'macLabel');
const logFile = requireString(config.logFile, 'logFile');
requireString(config.prompt, 'prompt');
if (config.model !== 'haiku') throw new Error('model must be haiku.');
requireBool(config.wakeToRun, 'wakeToRun');
requireBool(config.runWhenLocked, 'runWhenLocked');
if (!Array.isArray(config.schedules) || config.schedules.length === 0) throw new Error('schedules is required.');

const logPath = path.isAbsolute(logFile) ? logFile : path.join(root, logFile);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const message = (result.stderr || result.stdout || `${command} failed with exit code ${result.status}`).trim();
    throw new Error(message);
  }
  return result.stdout || '';
}

function runInherited(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed with exit code ${result.status}.`);
}

function logCounts() {
  if (!fs.existsSync(logPath)) return { runs: 0, success: 0, failed: 0, incomplete: 0 };
  const text = fs.readFileSync(logPath, 'utf8').replace(/\0/g, '');
  const runs = (text.match(/^\[.+\] start\r?$/gm) || []).length;
  const success = (text.match(/^\[.+\] exit 0\r?$/gm) || []).length;
  const failed = (text.match(/^\[.+\] exit (?!0\r?$)\d+\r?$/gm) || []).length;
  return { runs, success, failed, incomplete: runs - success - failed };
}

function windowsTaskExists() {
  const result = spawnSync('schtasks.exe', ['/Query', '/TN', taskName], { encoding: 'utf8' });
  return result.status === 0;
}

function windowsTask(actionArgs) {
  runInherited('schtasks.exe', actionArgs);
}

function windowsInstall() {
  runInherited('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.join(root, 'scripts', 'install-task.ps1'), '-ConfigPath', configPath]);
}

function parseSchtasks(output, label) {
  const match = output.match(new RegExp(`^${label}:\\s*(.+)$`, 'mi'));
  return match ? match[1].trim() : '-';
}

function windowsStatus() {
  if (!windowsTaskExists()) {
    console.log('Task is not installed.');
    return;
  }
  const output = run('schtasks.exe', ['/Query', '/TN', taskName, '/V', '/FO', 'LIST']);
  const counts = logCounts();
  console.log('');
  console.log('Installed: Yes');
  console.log(`Enabled: ${parseSchtasks(output, 'Scheduled Task State') === 'Enabled'}`);
  console.log(`Current state: ${parseSchtasks(output, 'Status')}`);
  console.log(`Last run: ${parseSchtasks(output, 'Last Run Time')}`);
  console.log(`Next run: ${parseSchtasks(output, 'Next Run Time')}`);
  console.log(`Last result: ${parseSchtasks(output, 'Last Result')}`);
  console.log(`Run count: ${counts.runs}`);
  console.log(`Success count: ${counts.success}`);
  console.log(`Failed count: ${counts.failed}`);
  console.log(`Incomplete count: ${counts.incomplete}`);
  console.log(`Log: ${logPath}`);
}

function macDomain() {
  return `gui/${process.getuid()}`;
}

function macPlistPath() {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${macLabel}.plist`);
}

function macServiceTarget() {
  return `${macDomain()}/${macLabel}`;
}

function macTaskLoaded() {
  const result = spawnSync('launchctl', ['print', macServiceTarget()], { encoding: 'utf8' });
  return result.status === 0;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function macWeekday(day) {
  const map = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  if (!(day in map)) throw new Error(`Invalid day: ${day}`);
  return map[day];
}

function splitTime(value) {
  const match = String(value).match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) throw new Error(`Invalid time: ${value}`);
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function macCalendarXml() {
  const items = [];
  for (const schedule of config.schedules) {
    if (!Array.isArray(schedule.days) || schedule.days.length === 0) throw new Error('Schedule days are required.');
    if (!Array.isArray(schedule.times) || schedule.times.length === 0) throw new Error('Schedule times are required.');
    for (const day of schedule.days) {
      for (const time of schedule.times) {
        const parts = splitTime(time);
        items.push(`    <dict>
      <key>Weekday</key>
      <integer>${macWeekday(day)}</integer>
      <key>Hour</key>
      <integer>${parts.hour}</integer>
      <key>Minute</key>
      <integer>${parts.minute}</integer>
    </dict>`);
      }
    }
  }
  return items.join('\n');
}

function macPlist() {
  const runner = path.join(root, 'scripts', 'run-claude.js');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(macLabel)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(process.execPath)}</string>
    <string>${xmlEscape(runner)}</string>
    <string>--config</string>
    <string>${xmlEscape(configPath)}</string>
  </array>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(root)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${xmlEscape(process.env.PATH || '')}</string>
  </dict>
  <key>StartCalendarInterval</key>
  <array>
${macCalendarXml()}
  </array>
  <key>StandardOutPath</key>
  <string>${xmlEscape(logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(logPath)}</string>
</dict>
</plist>
`;
}

function macInstall() {
  const plistPath = macPlistPath();
  fs.mkdirSync(path.dirname(plistPath), { recursive: true });
  fs.writeFileSync(plistPath, macPlist(), 'utf8');
  if (macTaskLoaded()) run('launchctl', ['bootout', macDomain(), plistPath]);
  run('launchctl', ['bootstrap', macDomain(), plistPath]);
  run('launchctl', ['enable', macServiceTarget()]);
  console.log(`Installed task ${macLabel}`);
}

function macStatus() {
  const installed = fs.existsSync(macPlistPath());
  const loaded = macTaskLoaded();
  const counts = logCounts();
  let state = 'Not loaded';
  if (loaded) {
    const output = run('launchctl', ['print', macServiceTarget()]);
    const match = output.match(/state = ([^\n]+)/);
    state = match ? match[1].trim() : 'Loaded';
  }
  console.log('');
  console.log(`Installed: ${installed ? 'Yes' : 'No'}`);
  console.log(`Loaded: ${loaded}`);
  console.log(`Current state: ${state}`);
  console.log(`Run count: ${counts.runs}`);
  console.log(`Success count: ${counts.success}`);
  console.log(`Failed count: ${counts.failed}`);
  console.log(`Incomplete count: ${counts.incomplete}`);
  console.log(`Log: ${logPath}`);
  if (installed) console.log(`Plist: ${macPlistPath()}`);
}

function openLog() {
  if (!fs.existsSync(logPath)) {
    console.log(`Log not found: ${logPath}`);
    return;
  }
  if (isWindows) runInherited('notepad.exe', [logPath]);
  else if (isMac) runInherited('open', [logPath]);
  else runInherited('xdg-open', [logPath]);
}

function ensureSupported() {
  if (!isWindows && !isMac) throw new Error('Only Windows and macOS are supported.');
}

function install() {
  ensureSupported();
  if (isWindows) windowsInstall();
  else macInstall();
}

function runNow() {
  ensureSupported();
  if (isWindows) {
    if (windowsTaskExists()) windowsTask(['/Run', '/TN', taskName]);
    else console.log('Task is not installed.');
  } else if (macTaskLoaded()) runInherited('launchctl', ['kickstart', '-k', macServiceTarget()]);
  else console.log('Task is not loaded.');
}

function stopRun() {
  ensureSupported();
  if (isWindows) {
    if (windowsTaskExists()) windowsTask(['/End', '/TN', taskName]);
    else console.log('Task is not installed.');
  } else if (macTaskLoaded()) runInherited('launchctl', ['kill', 'TERM', macServiceTarget()]);
  else console.log('Task is not loaded.');
}

function disable() {
  ensureSupported();
  if (isWindows) {
    if (windowsTaskExists()) windowsTask(['/Change', '/TN', taskName, '/DISABLE']);
    else console.log('Task is not installed.');
  } else if (macTaskLoaded()) runInherited('launchctl', ['disable', macServiceTarget()]);
  else console.log('Task is not loaded.');
}

function enable() {
  ensureSupported();
  if (isWindows) {
    if (windowsTaskExists()) windowsTask(['/Change', '/TN', taskName, '/ENABLE']);
    else console.log('Task is not installed.');
  } else if (macTaskLoaded()) runInherited('launchctl', ['enable', macServiceTarget()]);
  else console.log('Task is not loaded.');
}

function status() {
  ensureSupported();
  if (isWindows) windowsStatus();
  else macStatus();
}

function deleteTask() {
  ensureSupported();
  if (isWindows) {
    if (windowsTaskExists()) windowsTask(['/Delete', '/TN', taskName, '/F']);
    else console.log('Task is not installed.');
    return;
  }
  const plistPath = macPlistPath();
  if (macTaskLoaded()) runInherited('launchctl', ['bootout', macDomain(), plistPath]);
  if (fs.existsSync(plistPath)) fs.unlinkSync(plistPath);
  console.log(`Deleted task ${macLabel}`);
}

function showMenu() {
  console.log('');
  console.log(`ClaudeCron task: ${isMac ? macLabel : taskName}`);
  console.log('1. Install or update background task');
  console.log('2. Run once now');
  console.log('3. Stop current run');
  console.log('4. Disable scheduled runs');
  console.log('5. Enable scheduled runs');
  console.log('6. Show status');
  console.log('7. Open log');
  console.log('8. Delete task');
  console.log('0. Exit');
}

function execute(choice) {
  if (choice === 'install' || choice === '1') install();
  else if (choice === 'run' || choice === '2') runNow();
  else if (choice === 'stop' || choice === '3') stopRun();
  else if (choice === 'disable' || choice === '4') disable();
  else if (choice === 'enable' || choice === '5') enable();
  else if (choice === 'status' || choice === '6') status();
  else if (choice === 'log' || choice === '7') openLog();
  else if (choice === 'delete' || choice === '8') deleteTask();
  else if (choice !== '0') console.log('Invalid choice.');
}

async function interactive() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = question => new Promise(resolve => rl.question(question, resolve));
  try {
    while (true) {
      showMenu();
      const choice = (await ask('Choose: ')).trim();
      if (choice === '0') return;
      execute(choice);
    }
  } finally {
    rl.close();
  }
}

async function main() {
  const command = process.argv[2];
  if (command) execute(command);
  else await interactive();
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});
