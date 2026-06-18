const fs = require('fs');
const readline = require('readline');
const { loadConfig } = require('./lib/config');
const { readState, writeState } = require('./lib/state');
const windows = require('./lib/platforms/windows');
const macos = require('./lib/platforms/macos');

const context = loadConfig();
const platform = selectPlatform();

function selectPlatform() {
  if (process.platform === 'win32') return windows;
  if (process.platform === 'darwin') return macos;
  throw new Error('Only Windows and macOS are supported.');
}

function install() {
  platform.install(context);
  writeState(context.configHash);
}

function syncInstalledTask() {
  if (!platform.exists(context)) return;
  if (readState().configHash === context.configHash) return;
  console.log('Updating background task from claudecron.config.json...');
  install();
}

function openLog() {
  if (!fs.existsSync(context.logPath)) {
    console.log(`Log not found: ${context.logPath}`);
    return;
  }
  platform.openLog(context);
}

function runBackground() {
  syncInstalledTask();
  if (!platform.exists(context)) install();
  platform.enable(context);
}

function stopBackground() {
  const info = platform.summary(context);
  if (!info.installed) {
    console.log('Task is not installed.');
    return;
  }
  if (info.running) platform.stop(context);
  platform.disable(context);
}

function showMenu() {
  const info = platform.summary(context);
  console.log('');
  console.log(`ClaudeCron task: ${platform.name === 'macos' ? context.config.macLabel : context.config.taskName}`);
  console.log(`Background: ${info.enabled ? 'On' : 'Off'}`);
  console.log(`Current run: ${info.running ? 'Running' : 'Not running'}`);
  console.log(`Last run: ${info.lastRun}`);
  console.log(`Next run: ${info.nextRun}`);
  console.log(`Runs: ${info.counts.runs} total, ${info.counts.success} success, ${info.counts.failed} failed, ${info.counts.incomplete} incomplete`);
  console.log('');
  console.log('1. Run Background');
  console.log('2. Stop Background');
  console.log('3. Run once now');
  console.log('4. Open log');
  console.log('0. Exit');
}

function execute(choice) {
  if (choice === 'install') install();
  else if (choice === 'background' || choice === 'start' || choice === '1') runBackground();
  else if (choice === 'stop-background' || choice === 'disable' || choice === '2') stopBackground();
  else if (choice === 'run' || choice === '3') platform.runNow(context);
  else if (choice === 'log' || choice === '4') openLog();
  else if (choice === 'stop') platform.stop(context);
  else if (choice === 'enable') platform.enable(context);
  else if (choice === 'status') platform.status(context);
  else if (choice === 'delete') platform.deleteTask(context);
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
  else {
    syncInstalledTask();
    await interactive();
  }
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});
