const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { randomUUID } = require('crypto');
const { openClaudeLogin, runClaudeMessage } = require('./automation');
const { registerSchedule, unregisterSchedule } = require('./scheduler');
const { appendRunLog, initStore, readRunLog, readSchedules, writeSchedules } = require('./store');

const message = 'hi';

function profileDir() {
  return path.join(app.getPath('userData'), 'brave-profile');
}

function launchConfig() {
  return {
    appPath: app.getAppPath(),
    cwd: app.isPackaged ? path.dirname(process.execPath) : app.getAppPath(),
    exe: process.execPath,
    isPackaged: app.isPackaged
  };
}

function taskArg() {
  const arg = process.argv.find(item => item.startsWith('--run-task='));
  return arg ? arg.slice('--run-task='.length) : null;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 860,
    height: 680,
    minWidth: 720,
    minHeight: 560,
    title: 'ClaudeCron',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  win.loadFile(path.join(__dirname, 'index.html'));
}

function markSchedule(id, patch) {
  const schedules = readSchedules();
  const next = schedules.map(schedule => (schedule.id === id ? { ...schedule, ...patch } : schedule));
  writeSchedules(next);
  return next.find(schedule => schedule.id === id);
}

async function runTask(id, source) {
  const startedAt = new Date().toISOString();
  try {
    await runClaudeMessage({ userDataDir: profileDir(), message });
    markSchedule(id, { lastRunAt: new Date().toISOString(), status: source === 'schedule' ? 'done' : 'scheduled' });
    appendRunLog({ id: randomUUID(), scheduleId: id, source, status: 'success', startedAt, finishedAt: new Date().toISOString() });
  } catch (error) {
    markSchedule(id, { lastError: error.message, lastRunAt: new Date().toISOString(), status: source === 'schedule' ? 'failed' : 'scheduled' });
    appendRunLog({ id: randomUUID(), scheduleId: id, source, status: 'failed', error: error.message, startedAt, finishedAt: new Date().toISOString() });
    throw error;
  }
}

ipcMain.handle('app:load', () => ({
  logs: readRunLog(),
  schedules: readSchedules()
}));

ipcMain.handle('automation:openLogin', async () => {
  openClaudeLogin(profileDir());
  return true;
});

ipcMain.handle('automation:runNow', async () => {
  const id = `manual-${Date.now()}`;
  await runTask(id, 'manual');
  return { logs: readRunLog(), schedules: readSchedules() };
});

ipcMain.handle('schedule:create', async (_, payload) => {
  const at = String(payload.at || '').trim();
  const when = new Date(at);
  if (!at || Number.isNaN(when.getTime())) throw new Error('Waktu schedule tidak valid.');
  if (when.getTime() <= Date.now()) throw new Error('Waktu schedule harus setelah waktu sekarang.');
  const schedule = {
    id: randomUUID(),
    at,
    createdAt: new Date().toISOString(),
    message,
    status: 'scheduled'
  };
  await registerSchedule(schedule, launchConfig());
  const schedules = readSchedules();
  writeSchedules([schedule, ...schedules]);
  return { logs: readRunLog(), schedules: readSchedules() };
});

ipcMain.handle('schedule:delete', async (_, id) => {
  await unregisterSchedule(id);
  writeSchedules(readSchedules().filter(schedule => schedule.id !== id));
  return { logs: readRunLog(), schedules: readSchedules() };
});

app.whenReady().then(async () => {
  initStore(app.getPath('userData'));
  const id = taskArg();
  if (id) {
    await runTask(id, 'schedule').catch(() => {});
    app.quit();
    return;
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
