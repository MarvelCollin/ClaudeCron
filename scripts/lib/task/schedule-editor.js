const fs = require('fs');
const readline = require('readline');
const { dayNames, scheduleSummary } = require('../config');
const { clearConsole, color, theme } = require('./ui');

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

async function askDays(rl, group, schedules) {
  while (true) {
    const suffix = schedules.length > 0 ? ' or blank to finish' : '';
    const input = await askLine(rl, `Group ${group} days${suffix}: `);
    if (!input.trim() && schedules.length > 0) return null;
    try {
      return parseDaysInput(input);
    } catch (err) {
      console.log(err.message);
    }
  }
}

async function configureSchedule(context, platform, install, reloadContext) {
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
      const days = await askDays(rl, group, schedules);
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

module.exports = {
  configureSchedule,
  parseDaysInput,
  parseTimesInput,
};
