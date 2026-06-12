const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('claudeCron', {
  createSchedule: payload => ipcRenderer.invoke('schedule:create', payload),
  deleteSchedule: id => ipcRenderer.invoke('schedule:delete', id),
  load: () => ipcRenderer.invoke('app:load'),
  openLogin: () => ipcRenderer.invoke('automation:openLogin'),
  runNow: () => ipcRenderer.invoke('automation:runNow')
});
