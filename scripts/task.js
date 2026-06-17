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

function showMenu() {
  console.log('');
  console.log(`ClaudeCron task: ${platform.name === 'macos' ? context.config.macLabel : context.config.taskName}`);
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
  else if (choice === 'run' || choice === '2') platform.runNow(context);
  else if (choice === 'stop' || choice === '3') platform.stop(context);
  else if (choice === 'disable' || choice === '4') platform.disable(context);
  else if (choice === 'enable' || choice === '5') platform.enable(context);
  else if (choice === 'status' || choice === '6') platform.status(context);
  else if (choice === 'log' || choice === '7') openLog();
  else if (choice === 'delete' || choice === '8') platform.deleteTask(context);
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
