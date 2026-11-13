import { contextBridge, ipcRenderer } from 'electron';

// Secure context bridge exposing strictly controlled APIs
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  platform: process.platform,
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  isAlwaysOnTop: () => ipcRenderer.invoke('is-always-on-top'),
  minimize: () => ipcRenderer.invoke('minimize-window'),
  maximize: () => ipcRenderer.invoke('maximize-window'),
  close: () => ipcRenderer.invoke('close-window'),
  getMediaSession: () => ipcRenderer.invoke('get-media-session'),
  onMediaSessionUpdate: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data);
    ipcRenderer.on('media-session-update', handler);
    return () => ipcRenderer.removeListener('media-session-update', handler);
  },
  encryptSecret: (plain: string) => ipcRenderer.invoke('safe-storage-encrypt', plain),
  decryptSecret: (cipher: string) => ipcRenderer.invoke('safe-storage-decrypt', cipher),
});

