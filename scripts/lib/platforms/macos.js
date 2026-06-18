const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { root } = require('../paths');
const { run, runInherited } = require('../process');
const { logCounts, lastRunTime } = require('../log');
const { splitTime, nextRunTime, scheduleSummary } = require('../config');

function domain() {
  return `gui/${process.getuid()}`;
}

function plistPath(context) {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${context.config.macLabel}.plist`);
}

function serviceTarget(context) {
  return `${domain()}/${context.config.macLabel}`;
}

function loaded(context) {
  const result = spawnSync('launchctl', ['print', serviceTarget(context)], { encoding: 'utf8' });
  return result.status === 0;
}

function disabled(context) {
  const output = run('launchctl', ['print-disabled', domain()]);
  const label = context.config.macLabel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = output.match(new RegExp(`"${label}"\\s*=>\\s*(true|false)`));
  return match ? match[1] === 'true' : false;
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function weekday(day) {
  return { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 }[day];
}

function calendarXml(context) {
  const items = [];
  for (const schedule of context.config.schedules) {
    for (const day of schedule.days) {
      for (const time of schedule.times) {
        const parts = splitTime(time);
        items.push(`    <dict>
      <key>Weekday</key>
      <integer>${weekday(day)}</integer>
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

function plist(context) {
  const runner = path.join(root, 'scripts', 'runner', 'run-claude.js');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(context.config.macLabel)}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${xmlEscape(process.execPath)}</string>
    <string>${xmlEscape(runner)}</string>
    <string>--config</string>
    <string>${xmlEscape(context.configPath)}</string>
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
${calendarXml(context)}
  </array>
  <key>StandardOutPath</key>
  <string>${xmlEscape(context.logPath)}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(context.logPath)}</string>
</dict>
</plist>
`;
}

function exists(context) {
  return fs.existsSync(plistPath(context));
}

function install(context) {
  const file = plistPath(context);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, plist(context), 'utf8');
  if (loaded(context)) run('launchctl', ['bootout', domain(), file]);
  run('launchctl', ['bootstrap', domain(), file]);
  run('launchctl', ['enable', serviceTarget(context)]);
  console.log(`Installed task ${context.config.macLabel}`);
}

function status(context) {
  const info = summary(context);
  console.log('');
  console.log(`Installed: ${info.installed ? 'Yes' : 'No'}`);
  console.log(`Loaded: ${info.loaded}`);
  console.log(`Enabled: ${info.enabled}`);
  console.log(`Current state: ${info.state}`);
  console.log(`Last run: ${info.lastRun}`);
  console.log(`Next run: ${info.nextRun}`);
  console.log(`Configured schedule: ${scheduleSummary(context.config)}`);
  console.log(`Run count: ${info.counts.runs}`);
  console.log(`Success count: ${info.counts.success}`);
  console.log(`Failed count: ${info.counts.failed}`);
  console.log(`Incomplete count: ${info.counts.incomplete}`);
  console.log(`Log: ${context.logPath}`);
  if (info.installed) console.log(`Plist: ${plistPath(context)}`);
}

function summary(context) {
  const installed = exists(context);
  const isLoaded = loaded(context);
  const isDisabled = installed ? disabled(context) : true;
  const counts = logCounts(context.logPath);
  let state = 'Not loaded';
  if (isLoaded) {
    const output = run('launchctl', ['print', serviceTarget(context)]);
    const match = output.match(/state = ([^\n]+)/);
    state = match ? match[1].trim() : 'Loaded';
  }
  return {
    installed,
    loaded: isLoaded,
    enabled: isLoaded && !isDisabled,
    running: state.toLowerCase() === 'running',
    state,
    lastRun: lastRunTime(context.logPath),
    nextRun: isLoaded && !isDisabled ? nextRunTime(context.config) : '-',
    counts,
  };
}

function runNow(context) {
  if (loaded(context)) runInherited('launchctl', ['kickstart', '-k', serviceTarget(context)]);
  else console.log('Task is not loaded.');
}

function stop(context) {
  if (loaded(context)) runInherited('launchctl', ['kill', 'TERM', serviceTarget(context)]);
  else console.log('Task is not loaded.');
}

function disable(context) {
  if (loaded(context)) runInherited('launchctl', ['disable', serviceTarget(context)]);
  else console.log('Task is not loaded.');
}

function enable(context) {
  if (loaded(context)) runInherited('launchctl', ['enable', serviceTarget(context)]);
  else console.log('Task is not loaded.');
}

function deleteTask(context) {
  const file = plistPath(context);
  if (loaded(context)) runInherited('launchctl', ['bootout', domain(), file]);
  if (fs.existsSync(file)) fs.unlinkSync(file);
  console.log(`Deleted task ${context.config.macLabel}`);
}

function openLog(context) {
  runInherited('open', [context.logPath]);
}

module.exports = {
  name: 'macos',
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
