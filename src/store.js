const fs = require('fs');
const path = require('path');

let baseDir;

function initStore(dir) {
  baseDir = dir;
  fs.mkdirSync(baseDir, { recursive: true });
}

function filePath(name) {
  return path.join(baseDir, name);
}

function readJson(name, fallback) {
  const p = filePath(name);
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(name, value) {
  fs.writeFileSync(filePath(name), JSON.stringify(value, null, 2));
}

function readSchedules() {
  return readJson('schedules.json', []);
}

function writeSchedules(data) {
  writeJson('schedules.json', data);
}

function readRunLog() {
  return readJson('runs.json', []);
}

function appendRunLog(entry) {
  const logs = readRunLog();
  logs.unshift(entry);
  writeJson('runs.json', logs.slice(0, 200));
}

function isSlotDone(key) {
  return !!readJson('slots.json', {})[key];
}

function markSlotDone(key) {
  const slots = readJson('slots.json', {});
  slots[key] = Date.now();
  const cutoff = Date.now() - 48 * 3600_000;
  for (const k of Object.keys(slots)) {
    if (slots[k] < cutoff) delete slots[k];
  }
  writeJson('slots.json', slots);
}

function readConfig() {
  return readJson('config.json', { message: 'hi' });
}

function writeConfig(data) {
  const current = readConfig();
  writeJson('config.json', { ...current, ...data });
}

module.exports = {
  initStore, readSchedules, writeSchedules,
  readRunLog, appendRunLog, isSlotDone, markSlotDone,
  readConfig, writeConfig,
};
