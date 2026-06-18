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

const menuItems = [
  { label: 'Run Background', choice: 'background', code: '32' },
  { label: 'Stop Background', choice: 'stop-background', code: '31' },
  { label: 'Run once now', choice: 'run', code: '36' },
  { label: 'Open log', choice: 'log', code: '35' },
  { label: 'Exit', choice: '0', code: '90' },
];

const repoUrl = 'https://github.com/MarvelCollin/ClaudeCron';
const titleArt = [
  "   ______  __                        __          ______                           ",
  " .' ___  |[  |                      |  ]       .' ___  |                          ",
  "/ .'   \\_| | |  ,--.  __   _    .--.| | .---. / .'   \\_| _ .--.   .--.   _ .--.   ",
  "| |        | | `'_\\ :[  | | | / /'`\\' |/ /__\\\\| |       [ `/'`\\]/ .'`\\ \\[ `.-. |  ",
  "\\ `.___.'\\ | | // | |,| \\_/ |,| \\__/  || \\__.,\\ `.___.'\\ | |    | \\__. | | | | |  ",
  " `.____ .'[___]\\'-;__/'.__.'_/ '.__.;__]'.__.' `.____ .'[___]    '.__.' [___||__] ",
];

const uiWidth = Math.max(...titleArt.map(line => line.length));
const contentWidth = uiWidth - 4;
const theme = {
  border: '38;2;91;111;143',
  title: '38;2;102;217;232',
  label: '38;2;148;163;184',
  text: '38;2;226;232;240',
  muted: '38;2;100;116;139',
  selected: '1;38;2;103;232;249',
};

function color(code, value) {
  if (!process.stdout.isTTY) return value;
  return `\x1b[${code}m${value}\x1b[0m`;
}

function link(label, url) {
  if (!process.stdout.isTTY) return label;
  return `\x1b]8;;${url}\x1b\\${label}\x1b]8;;\x1b\\`;
}

function stripColor(value) {
  return String(value)
    .replace(/\x1b\[[0-9;]*m/g, '')
    .replace(/\x1b]8;;[^\x1b]*\x1b\\/g, '');
}

function padText(value, width) {
  const text = String(value);
  return text + ' '.repeat(Math.max(0, width - stripColor(text).length));
}

function statusText(value, activeCode) {
  return value ? color(activeCode, 'On') : color('31', 'Off');
}

function runningText(value) {
  return value ? color('33', 'Running') : color('32', 'Not running');
}

function countText(info) {
  return [
    `${color('36', info.counts.runs)} total`,
    `${color('32', info.counts.success)} success`,
    `${color('31', info.counts.failed)} failed`,
    `${color('33', info.counts.incomplete)} incomplete`,
  ].join(', ');
}

function clearConsole() {
  if (process.stdout.isTTY) process.stdout.write('\x1b[2J\x1b[H');
}

function styledRow(value = '') {
  return padText(value, contentWidth);
}

function boxLine(left, fill, right) {
  return color(theme.border, `${left}${fill.repeat(uiWidth - 2)}${right}`);
}

function boxRow(value = '') {
  return `${color(theme.border, '|')} ${styledRow(value)} ${color(theme.border, '|')}`;
}

function blankRow() {
  return boxRow('');
}

function field(label, value, width = contentWidth) {
  return padText(`${color(theme.label, label.padEnd(12))} ${value}`, width);
}

function actionRow(item, selected) {
  const marker = selected ? color(theme.selected, '>') : color(theme.muted, ' ');
  const label = selected ? color(theme.selected, item.label) : color(item.code, item.label);
  return padText(`${marker} ${label}`, contentWidth);
}

function showMenu(info, selected = 0, message = '') {
  const name = platform.name === 'macos' ? context.config.macLabel : context.config.taskName;
  clearConsole();
  for (const line of titleArt) console.log(color(theme.title, line));
  console.log('');
  console.log(boxLine('+', '-', '+'));
  console.log(boxRow(color('1;37', 'ClaudeCron Control Center')));
  console.log(blankRow());
  console.log(boxRow(field('Task', color(theme.text, name))));
  console.log(boxRow(field('Background', statusText(info.enabled, '32'))));
  console.log(boxRow(field('Current run', runningText(info.running))));
  console.log(boxRow(field('Last run', color(theme.text, info.lastRun))));
  console.log(boxRow(field('Next run', color(theme.text, info.nextRun))));
  console.log(boxRow(`${color(theme.label, 'Runs'.padEnd(12))} ${countText(info)}`));
  if (message) console.log(boxRow(`${color(theme.label, 'Status'.padEnd(12))} ${message}`));
  console.log(blankRow());
  console.log(boxRow(color('1;37', 'Choose Action')));
  for (let index = 0; index < menuItems.length; index += 1) {
    const item = menuItems[index];
    console.log(boxRow(actionRow(item, index === selected)));
  }
  console.log(blankRow());
  console.log(boxRow(`${color(theme.label, 'Repository'.padEnd(12))} ${color(theme.text, link('MarvelCollin/ClaudeCron', repoUrl))}`));
  console.log(boxRow(`${color(theme.label, 'Website'.padEnd(12))} ${color(theme.text, repoUrl)}`));
  console.log(boxRow(`${color(theme.label, 'Made by'.padEnd(12))} ${color(theme.text, 'Marvel Collin with \u2764\uFE0F')}`));
  console.log(blankRow());
  console.log(boxLine('+', '-', '+'));
  console.log(color('2', 'Use Up/Down, Enter/Space to select, Esc/Q to close.'));
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
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = question => new Promise(resolve => rl.question(question, resolve));
    try {
      while (true) {
        showMenu(platform.summary(context));
        const choice = (await ask('Choose: ')).trim();
        if (choice === '0') return;
        execute(choice);
      }
    } finally {
      rl.close();
    }
  }

  readline.emitKeypressEvents(process.stdin);
  process.stdin.setRawMode(true);
  process.stdin.resume();

  let selected = 0;
  let busy = false;
  let info = platform.summary(context);
  let message = '';
  let queued = false;
  let closed = false;

  await new Promise((resolve, reject) => {
    function render(nextMessage = message) {
      message = nextMessage;
      if (closed) return;
      if (queued) return;
      queued = true;
      setImmediate(() => {
        queued = false;
        if (closed) return;
        showMenu(info, selected, message);
      });
    }

    function close() {
      closed = true;
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off('keypress', onKeypress);
      clearConsole();
      console.log('ClaudeCron closed.');
      resolve();
    }

    function runSelected() {
      const item = menuItems[selected];
      if (item.choice === '0') {
        close();
        return;
      }
      busy = true;
      process.stdin.setRawMode(false);
      process.stdout.write('\n');
      try {
        execute(item.choice);
        info = platform.summary(context);
        process.stdin.setRawMode(true);
        busy = false;
        render(color(item.code, `Done: ${item.label}`));
      } catch (err) {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.off('keypress', onKeypress);
        reject(err);
      }
    }

    function onKeypress(value, key = {}) {
      if (busy) return;
      if (key.ctrl && key.name === 'c') {
        close();
        return;
      }
      if (key.name === 'up') {
        selected = selected === 0 ? menuItems.length - 1 : selected - 1;
        render('');
        return;
      }
      if (key.name === 'down') {
        selected = selected === menuItems.length - 1 ? 0 : selected + 1;
        render('');
        return;
      }
      if (key.name === 'return' || key.name === 'enter' || key.name === 'space') {
        runSelected();
        return;
      }
      if (key.name === 'escape' || String(value).toLowerCase() === 'q') {
        close();
      }
    }

    process.stdin.on('keypress', onKeypress);
    showMenu(info, selected);
  });
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
