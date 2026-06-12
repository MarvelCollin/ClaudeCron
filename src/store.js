const fs = require('fs');
const path = require('path');

let baseDir;

function initStore(dir) {
  baseDir = dir;
  fs.mkdirSync(baseDir, { recursive: true });
}

function storePath(name) {
  return path.join(baseDir, name);
}

function readJson(name, fallback) {
  const file = storePath(name);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(name, value) {
  fs.writeFileSync(storePath(name), JSON.stringify(value, null, 2));
}

function readSchedules() {
  return readJson('schedules.json', []);
}

function writeSchedules(schedules) {
  writeJson('schedules.json', schedules);
}

function readRunLog() {
  return readJson('runs.json', []);
}

function appendRunLog(entry) {
  const logs = readRunLog();
  logs.unshift(entry);
  writeJson('runs.json', logs.slice(0, 50));
}

module.exports = {
  appendRunLog,
  initStore,
  readRunLog,
  readSchedules,
  writeSchedules
};
