import {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  shell,
  protocol,
  dialog,
} from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';
import { LibraryManager } from './libraryManager';

// Register privileged custom protocol for streaming local audio and artwork securely
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'astralyr-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
  {
    scheme: 'constella-media',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// Support remote debugging via environment variable for headless CDP tests
if (process.env.ENABLE_CDP === '1' || process.env.CDP_PORT) {
  const port = process.env.CDP_PORT || '9333';
  app.commandLine.appendSwitch('remote-debugging-port', port);
}

let mainWindow: BrowserWindow | null = null;

// Window state management (remembers size, position, maximization)
interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized: boolean;
}

const DEFAULT_STATE: WindowState = {
  width: 1280,
  height: 720,
  isMaximized: false,
};

function getWindowStateFile(): string {
  return path.join(app.getPath('userData'), 'window-state.json');
}

function loadWindowState(): WindowState {
  try {
    const file = getWindowStateFile();
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      return { ...DEFAULT_STATE, ...data };
    }
  } catch (err) {
    console.warn('[Electron] Could not read window state:', err);
  }
  return DEFAULT_STATE;
}

function saveWindowState(win: BrowserWindow) {
  try {
    const isMaximized = win.isMaximized();
    let bounds = win.getBounds();
    if (!isMaximized) {
      const state: WindowState = {
        width: bounds.width,
        height: bounds.height,
        x: bounds.x,
        y: bounds.y,
        isMaximized: false,
      };
      fs.writeFileSync(getWindowStateFile(), JSON.stringify(state), 'utf-8');
    } else {
      const state = loadWindowState();
      state.isMaximized = true;
      fs.writeFileSync(getWindowStateFile(), JSON.stringify(state), 'utf-8');
    }
  } catch (err) {
    console.warn('[Electron] Could not save window state:', err);
  }
}

function getAppIcon(): string | undefined {
  const brandingDir = path.join(__dirname, '../assets/branding');
  if (process.platform === 'win32') {
    const astralyrIco = path.join(brandingDir, 'astralyr-icon.ico');
    if (fs.existsSync(astralyrIco)) return astralyrIco;
    const ico = path.join(brandingDir, 'icon.ico');
    if (fs.existsSync(ico)) return ico;
  } else if (process.platform === 'darwin') {
    const icns = path.join(brandingDir, 'icon.icns');
    if (fs.existsSync(icns)) return icns;
  } else {
    const astralyrPng = path.join(brandingDir, 'astralyr-icon.png');
    if (fs.existsSync(astralyrPng)) return astralyrPng;
    const png = path.join(brandingDir, 'icon-512.png');
    if (fs.existsSync(png)) return png;
  }
  return undefined;
}

function createWindow(): void {
  const state = loadWindowState();
  const icon = getAppIcon();

  mainWindow = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 800,
    minHeight: 500,
    backgroundColor: '#000000',
    title: 'Astralyr',
    icon,
    show: false,
    frame: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    titleBarOverlay:
      process.platform === 'win32'
        ? {
            color: '#000000',
            symbolColor: '#ffffff',
            height: 32,
          }
        : false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  if (state.isMaximized) {
    mainWindow.maximize();
  }

  // Gracefully show window once ready to eliminate visual flicker
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
    }
  });

  // Track window bounds
  mainWindow.on('resize', () => {
    if (mainWindow) saveWindowState(mainWindow);
  });
  mainWindow.on('move', () => {
    if (mainWindow) saveWindowState(mainWindow);
  });
  mainWindow.on('close', () => {
    if (mainWindow) saveWindowState(mainWindow);
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Intercept new window requests (e.g. target="_blank" links like GitHub) and open them in user's default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  // F11 Fullscreen toggle
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F11' && input.type === 'keyDown') {
      if (mainWindow) {
        mainWindow.setFullScreen(!mainWindow.isFullScreen());
        event.preventDefault();
      }
    }
  });

  // Load URL
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl);
  } else {
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath);
  }
}

// Ensure single instance
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    createWindow();

    const libraryMgr = LibraryManager.getInstance();
    const libraryDir = libraryMgr.getLibraryDir();
    const artDir = libraryMgr.getArtDir();

    // Register protocol handler for streaming library media & artwork securely
    const mediaHandler = (request: Request) => libraryMgr.handleMediaRequest(request);

    protocol.handle('astralyr-media', mediaHandler);
    protocol.handle('constella-media', mediaHandler);

    // Persistent Playlist & Library IPC Handlers
    ipcMain.handle('library:import-songs', async (_event, filePaths?: string[]) => {
      return await libraryMgr.importSongs(mainWindow, filePaths, (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('library:import-progress', progress);
        }
      });
    });

    ipcMain.handle('library:get-playlist', async () => {
      return await libraryMgr.getPlaylist();
    });

    ipcMain.handle('library:remove-song', async (_event, trackIdOrFileName: string) => {
      return await libraryMgr.removeSong(trackIdOrFileName);
    });

    // Library IPC Handlers
    ipcMain.handle('library:import-files', async (_event, filePaths: string[]) => {
      return await libraryMgr.importFiles(filePaths, (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('library:import-progress', progress);
        }
      });
    });

    ipcMain.handle('library:select-and-import', async () => {
      if (!mainWindow) return { tracks: [], duplicates: 0, errors: [] };
      const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Audio Files to Add to Library',
        properties: ['openFile', 'multiSelections'],
        filters: [
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'm4a', 'mp4', 'ogg', 'aac'] },
        ],
      });
      if (res.canceled || res.filePaths.length === 0) {
        return { tracks: [], duplicates: 0, errors: [] };
      }
      return await libraryMgr.importFiles(res.filePaths, (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('library:import-progress', progress);
        }
      });
    });

    ipcMain.handle('library:get-stats', async () => {
      return await libraryMgr.getStats();
    });

    ipcMain.handle('library:open-folder', async () => {
      await shell.openPath(libraryMgr.getLibraryDir());
    });

    ipcMain.handle('library:verify-files', (_event, tracks: any[]) => {
      return libraryMgr.verifyFiles(tracks);
    });

    ipcMain.handle('library:locate-file', async (_event, trackId: string) => {
      if (!mainWindow) return null;
      const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Locate Missing Audio File',
        properties: ['openFile'],
        filters: [
          { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'm4a', 'mp4', 'ogg', 'aac'] },
        ],
      });
      if (res.canceled || res.filePaths.length === 0) {
        return null;
      }
      return await libraryMgr.locateFile(trackId, res.filePaths[0]);
    });

    ipcMain.handle('library:delete-track', async (_event, trackId: string) => {
      return await libraryMgr.deleteTrack(trackId);
    });

    ipcMain.handle('library:cleanup-unused', async (_event, activeTrackIds: string[]) => {
      return await libraryMgr.cleanupUnused(activeTrackIds);
    });

    ipcMain.handle('library:export-backup', async () => {
      if (!mainWindow) return { success: false };
      const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Destination Folder for Library Backup',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (res.canceled || res.filePaths.length === 0) {
        return { success: false };
      }
      return await libraryMgr.exportBackup(res.filePaths[0]);
    });

    ipcMain.handle('library:import-backup', async () => {
      if (!mainWindow) return { success: false, importedCount: 0 };
      const res = await dialog.showOpenDialog(mainWindow, {
        title: 'Select Astralyr Library Backup Folder',
        properties: ['openDirectory'],
      });
      if (res.canceled || res.filePaths.length === 0) {
        return { success: false, importedCount: 0 };
      }
      return await libraryMgr.importBackup(res.filePaths[0]);
    });

    // Register Always-on-top global accelerator
    const toggleAOT = () => {
      if (!mainWindow) return;
      const current = mainWindow.isAlwaysOnTop();
      mainWindow.setAlwaysOnTop(!current);
    };

    globalShortcut.register('CommandOrControl+Shift+T', toggleAOT);

    // IPC Handlers
    ipcMain.handle('toggle-fullscreen', () => {
      if (!mainWindow) return false;
      const next = !mainWindow.isFullScreen();
      mainWindow.setFullScreen(next);
      return next;
    });

    ipcMain.handle('toggle-always-on-top', () => {
      if (!mainWindow) return false;
      const next = !mainWindow.isAlwaysOnTop();
      mainWindow.setAlwaysOnTop(next);
      return next;
    });

    ipcMain.handle('is-always-on-top', () => {
      return mainWindow ? mainWindow.isAlwaysOnTop() : false;
    });

    ipcMain.handle('minimize-window', () => {
      if (mainWindow) mainWindow.minimize();
    });

    ipcMain.handle('maximize-window', () => {
      if (!mainWindow) return;
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    });

    ipcMain.handle('close-window', () => {
      if (mainWindow) mainWindow.close();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

