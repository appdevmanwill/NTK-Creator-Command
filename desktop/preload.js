const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('NTKDesktopBridge', {
  isDesktop: true,
  platform: process.platform,
  openDataFolder: () => ipcRenderer.invoke('ntk:open-data-folder'),
  getDataDir: () => ipcRenderer.invoke('ntk:get-data-dir'),
});
