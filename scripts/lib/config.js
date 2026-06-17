const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { defaultConfigPath, resolveFromRoot } = require('./paths');

const dayNames = new Set(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']);
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

function requireString(value, name) {
  if (!value || typeof value !== 'string') throw new Error(`${name} is required.`);
  return value;
}

function requireBool(value, name) {
  if (typeof value !== 'boolean') throw new Error(`${name} is required.`);
  return value;
}

function validateSchedule(schedule) {
  if (!Array.isArray(schedule.days) || schedule.days.length === 0) throw new Error('Schedule days are required.');
  if (!Array.isArray(schedule.times) || schedule.times.length === 0) throw new Error('Schedule times are required.');
  for (const day of schedule.days) {
    if (!dayNames.has(day)) throw new Error(`Invalid day: ${day}`);
  }
  for (const time of schedule.times) {
    if (!timePattern.test(String(time))) throw new Error(`Invalid time: ${time}`);
  }
}

function validateConfig(config) {
  requireString(config.taskName, 'taskName');
  requireString(config.macLabel, 'macLabel');
  requireString(config.prompt, 'prompt');
  requireString(config.logFile, 'logFile');
  requireBool(config.wakeToRun, 'wakeToRun');
  requireBool(config.runWhenLocked, 'runWhenLocked');
  if (config.model !== 'haiku') throw new Error('model must be haiku.');
  if (!Array.isArray(config.schedules) || config.schedules.length === 0) throw new Error('schedules is required.');
  for (const schedule of config.schedules) validateSchedule(schedule);
}

function loadConfig(configPath = defaultConfigPath) {
  const resolvedConfigPath = path.resolve(configPath);
  const raw = fs.readFileSync(resolvedConfigPath);
  const config = JSON.parse(raw.toString('utf8'));
  validateConfig(config);
  return {
    config,
    configPath: resolvedConfigPath,
    configHash: crypto.createHash('sha256').update(raw).digest('hex'),
    logPath: resolveFromRoot(config.logFile),
  };
}

function calendarEntryCount(config) {
  return config.schedules.reduce((count, schedule) => count + schedule.days.length * schedule.times.length, 0);
}

function splitTime(value) {
  const match = String(value).match(timePattern);
  if (!match) throw new Error(`Invalid time: ${value}`);
  return { hour: Number(match[1]), minute: Number(match[2]) };
}

function nextRunTime(config, now = new Date()) {
  const dayIndexes = { Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6 };
  let next = null;
  for (const schedule of config.schedules) {
    for (const day of schedule.days) {
      for (const time of schedule.times) {
        const parts = splitTime(time);
        for (let offset = 0; offset <= 7; offset++) {
          const candidate = new Date(now);
          candidate.setDate(now.getDate() + offset);
          candidate.setHours(parts.hour, parts.minute, 0, 0);
          if (candidate.getDay() !== dayIndexes[day]) continue;
          if (candidate <= now) continue;
          if (!next || candidate < next) next = candidate;
          break;
        }
      }
    }
  }
  return next ? next.toLocaleString() : '-';
}

module.exports = {
  dayNames,
  loadConfig,
  validateConfig,
  calendarEntryCount,
  splitTime,
  nextRunTime,
};
