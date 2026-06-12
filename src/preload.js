const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('claudeCron', {
  load: () => ipcRenderer.invoke('app:load'),
  openClaude: () => ipcRenderer.invoke('automation:openClaude'),
  runNow: () => ipcRenderer.invoke('automation:runNow'),
  createSchedule: (payload) => ipcRenderer.invoke('schedule:create', payload),
  toggleSchedule: (id) => ipcRenderer.invoke('schedule:toggle', id),
  deleteSchedule: (id) => ipcRenderer.invoke('schedule:delete', id),
  engineStatus: () => ipcRenderer.invoke('engine:status'),
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (data) => ipcRenderer.invoke('config:set', data),
  onStateUpdate: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('state:updated', handler);
    return () => ipcRenderer.removeListener('state:updated', handler);
  },
});
