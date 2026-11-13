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
  library: {
    importFiles: (filePaths: string[]) => ipcRenderer.invoke('library:import-files', filePaths),
    selectAndImport: () => ipcRenderer.invoke('library:select-and-import'),
    onImportProgress: (callback: (data: { current: number; total: number; filename: string }) => void) => {
      const handler = (_event: any, data: any) => callback(data);
      ipcRenderer.on('library:import-progress', handler);
      return () => ipcRenderer.removeListener('library:import-progress', handler);
    },
    getStats: () => ipcRenderer.invoke('library:get-stats'),
    openFolder: () => ipcRenderer.invoke('library:open-folder'),
    verifyFiles: (tracks: any[]) => ipcRenderer.invoke('library:verify-files', tracks),
    locateFile: (trackId: string) => ipcRenderer.invoke('library:locate-file', trackId),
    deleteTrack: (trackId: string) => ipcRenderer.invoke('library:delete-track', trackId),
    cleanupUnused: (activeTrackIds: string[]) => ipcRenderer.invoke('library:cleanup-unused', activeTrackIds),
    exportBackup: () => ipcRenderer.invoke('library:export-backup'),
    importBackup: () => ipcRenderer.invoke('library:import-backup'),
  },
});

