const fs = require('fs');
const path = require('path');

function appendLog(file, text) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, text, 'utf8');
}

function logCounts(file) {
  if (!fs.existsSync(file)) return { runs: 0, success: 0, failed: 0, incomplete: 0 };
  const text = fs.readFileSync(file, 'utf8').replace(/\0/g, '');
  const runs = (text.match(/^\[.+\] start\r?$/gm) || []).length;
  const success = (text.match(/^\[.+\] exit 0\r?$/gm) || []).length;
  const failed = (text.match(/^\[.+\] exit (?!0\r?$)\d+\r?$/gm) || []).length;
  return { runs, success, failed, incomplete: runs - success - failed };
}

function lastRunTime(file) {
  if (!fs.existsSync(file)) return '-';
  const text = fs.readFileSync(file, 'utf8').replace(/\0/g, '');
  const matches = [...text.matchAll(/^\[(.+)\] start\r?$/gm)];
  if (matches.length === 0) return '-';
  const date = new Date(matches[matches.length - 1][1]);
  return Number.isNaN(date.getTime()) ? matches[matches.length - 1][1] : date.toLocaleString();
}

module.exports = {
  appendLog,
  logCounts,
  lastRunTime,
};
