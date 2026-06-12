const path = require('path');
const { app, BrowserWindow, ipcMain } = require('electron');
const { randomUUID } = require('crypto');
const { openClaudeLogin, runClaudeMessage } = require('./automation');
const store = require('./store');
const engine = require('./engine');

let win = null;

function profileDir() {
  return path.join(app.getPath('userData'), 'brave-profile');
}

function createWindow() {
  win = new BrowserWindow({
    width: 960,
    height: 780,
    minWidth: 720,
    minHeight: 560,
    title: 'ClaudeCron',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
  win.on('closed', () => { win = null; });
}

function message() {
  return store.readConfig().message || 'hi';
}

function snapshot() {
  return {
    schedules: store.readSchedules(),
    logs: store.readRunLog(),
    engine: engine.status(),
    config: store.readConfig(),
  };
}

function notifyRenderer() {
  if (win && !win.isDestroyed()) {
    win.webContents.send('state:updated', snapshot());
  }
}

ipcMain.handle('app:load', () => snapshot());

ipcMain.handle('automation:openLogin', () => {
  openClaudeLogin(profileDir());
  return true;
});

ipcMain.handle('automation:runNow', async () => {
  if (engine.status().locked) throw new Error('A task is already running.');
  const startedAt = new Date().toISOString();
  try {
    await runClaudeMessage({ userDataDir: profileDir(), message: message() });
    store.appendRunLog({
      id: randomUUID(), slot: 'manual', source: 'manual', status: 'success',
      startedAt, finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    store.appendRunLog({
      id: randomUUID(), slot: 'manual', source: 'manual', status: 'failed',
      error: err.message, startedAt, finishedAt: new Date().toISOString(),
    });
    throw err;
  }
  return snapshot();
});

ipcMain.handle('schedule:create', (_, payload) => {
  const label = String(payload.label || '').trim() || 'Untitled';
  const days = payload.days;
  const hours = payload.hours;
  if (!Array.isArray(days) || days.length === 0) throw new Error('Pick at least one day.');
  if (!Array.isArray(hours) || hours.length === 0) throw new Error('Pick at least one hour.');
  if (days.some(d => d < 0 || d > 6)) throw new Error('Invalid day.');
  if (hours.some(h => h < 0 || h > 23)) throw new Error('Invalid hour.');
  const schedule = {
    id: randomUUID(),
    label,
    days: [...new Set(days)].sort((a, b) => a - b),
    hours: [...new Set(hours)].sort((a, b) => a - b),
    enabled: true,
    createdAt: new Date().toISOString(),
  };
  const all = store.readSchedules();
  all.push(schedule);
  store.writeSchedules(all);
  return snapshot();
});

ipcMain.handle('schedule:toggle', (_, id) => {
  const all = store.readSchedules();
  const target = all.find(s => s.id === id);
  if (target) target.enabled = !target.enabled;
  store.writeSchedules(all);
  return snapshot();
});

ipcMain.handle('schedule:delete', (_, id) => {
  store.writeSchedules(store.readSchedules().filter(s => s.id !== id));
  return snapshot();
});

ipcMain.handle('engine:status', () => engine.status());

ipcMain.handle('config:get', () => store.readConfig());

ipcMain.handle('config:set', (_, data) => {
  store.writeConfig(data);
  return store.readConfig();
});

app.whenReady().then(() => {
  store.initStore(app.getPath('userData'));
  createWindow();
  engine.start({
    execute: () => runClaudeMessage({ userDataDir: profileDir(), message: message() }),
    store,
    notify: notifyRenderer,
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => engine.stop());
