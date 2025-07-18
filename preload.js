const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('ipcRenderer', {
  on: (channel, func) => ipcRenderer.on(channel, func),
});
