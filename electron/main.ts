import { app, BrowserWindow, ipcMain, globalShortcut, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

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
    const ico = path.join(brandingDir, 'icon.ico');
    if (fs.existsSync(ico)) return ico;
  } else if (process.platform === 'darwin') {
    const icns = path.join(brandingDir, 'icon.icns');
    if (fs.existsSync(icns)) return icns;
  } else {
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
    title: 'Constella',
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

