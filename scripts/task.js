const fs = require('fs');
const readline = require('readline');
const { dayNames, loadConfig, scheduleSummary } = require('./lib/config');
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

function reloadContext() {
  Object.assign(context, loadConfig(context.configPath));
}

const menuItems = [
  { label: 'Configure Schedule', choice: 'config', code: '33' },
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

const dayAliases = {
  sun: 'Sunday',
  sunday: 'Sunday',
  mon: 'Monday',
  monday: 'Monday',
  tue: 'Tuesday',
  tuesday: 'Tuesday',
  wed: 'Wednesday',
  wednesday: 'Wednesday',
  thu: 'Thursday',
  thursday: 'Thursday',
  fri: 'Friday',
  friday: 'Friday',
  sat: 'Saturday',
  saturday: 'Saturday',
};

function unique(values) {
  return [...new Set(values)];
}

function parseDaysInput(value) {
  const text = value.trim().toLowerCase();
  if (text === 'all' || text === 'everyday') return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (text === 'weekdays' || text === 'weekday') return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  if (text === 'weekend' || text === 'weekends') return ['Saturday', 'Sunday'];
  const days = unique(text.split(/[,\s]+/).filter(Boolean).map(day => dayAliases[day] || day));
  if (days.length === 0) throw new Error('Enter at least one day.');
  for (const day of days) {
    if (!dayNames.has(day)) throw new Error(`Invalid day: ${day}`);
  }
  return days;
}

function parseTimesInput(value) {
  const times = unique(value.trim().split(/[,\s]+/).filter(Boolean));
  if (times.length === 0) throw new Error('Enter at least one time.');
  for (const time of times) {
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(time)) throw new Error(`Invalid time: ${time}`);
  }
  return times;
}

function askLine(rl, question) {
  return new Promise(resolve => rl.question(question, resolve));
}

async function askParsed(rl, question, parser) {
  while (true) {
    try {
      return parser(await askLine(rl, question));
    } catch (err) {
      console.log(err.message);
    }
  }
}

async function configureSchedule() {
  if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error('Configure Schedule requires an interactive terminal.');
  clearConsole();
  console.log(color(theme.title, 'Configure Schedule'));
  console.log('');
  console.log(`Config: ${context.configPath}`);
  console.log(`Current: ${scheduleSummary(context.config)}`);
  console.log('');
  console.log('Days examples: all, weekdays, weekend, mon,wed,fri');
  console.log('Times examples: 08:30,13:30,18:30');
  console.log('');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let closed = false;
  const close = () => {
    if (!closed) rl.close();
    closed = true;
  };

  try {
    const promptInput = (await askLine(rl, `Prompt [${context.config.prompt}]: `)).trim();
    const schedules = [];
    let group = 1;

    while (true) {
      let days = null;
      while (!days) {
        const suffix = schedules.length > 0 ? ' or blank to finish' : '';
        const daysInput = await askLine(rl, `Group ${group} days${suffix}: `);
        if (!daysInput.trim() && schedules.length > 0) break;
        try {
          days = parseDaysInput(daysInput);
        } catch (err) {
          console.log(err.message);
        }
      }
      if (!days) break;
      const times = await askParsed(rl, `Group ${group} times: `, parseTimesInput);
      schedules.push({ days, times });
      const more = (await askLine(rl, 'Add another group? [y/N]: ')).trim().toLowerCase();
      if (more !== 'y' && more !== 'yes') break;
      group += 1;
    }

    const nextConfig = { ...context.config, prompt: promptInput || context.config.prompt, schedules };
    fs.writeFileSync(context.configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, 'utf8');
    reloadContext();
    console.log('');
    console.log(`Saved: ${context.configPath}`);
    console.log(`New schedule: ${scheduleSummary(context.config)}`);
    const apply = (await askLine(rl, 'Apply background schedule now? [Y/n]: ')).trim().toLowerCase();
    close();
    if (apply !== 'n' && apply !== 'no') {
      install();
      platform.enable(context);
      console.log('Background schedule updated.');
    }
  } finally {
    close();
  }
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

async function execute(choice) {
  if (choice === 'config' || choice === 'configure') await configureSchedule();
  else if (choice === 'install') install();
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
        await execute(choice);
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

    async function runSelected() {
      const item = menuItems[selected];
      if (item.choice === '0') {
        close();
        return;
      }
      busy = true;
      process.stdin.setRawMode(false);
      process.stdout.write('\n');
      try {
        await execute(item.choice);
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
  if (command) await execute(command);
  else {
    syncInstalledTask();
    await interactive();
  }
}

main().catch(err => {
  console.error(err.message);
  process.exitCode = 1;
});
