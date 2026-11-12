import { DesktopWindowMode } from '../types/visualizer';

// Check if app is running inside Tauri v2 runtime
export const isTauriEnvironment = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export async function setDesktopMode(mode: DesktopWindowMode): Promise<boolean> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_window_mode', { mode });
      return true;
    } catch (err) {
      console.error('Failed to invoke set_window_mode on Tauri backend:', err);
      return false;
    }
  } else {
    console.log(`[Browser Fallback] Desktop mode changed to: ${mode}`);
    return true;
  }
}

export async function setClickThrough(enabled: boolean): Promise<boolean> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_click_through', { enabled });
      return true;
    } catch (err) {
      console.error('Failed to invoke set_click_through on Tauri backend:', err);
      return false;
    }
  } else {
    console.log(`[Browser Fallback] Click-through set to: ${enabled}`);
    return true;
  }
}

export async function toggleClickThrough(): Promise<boolean> {
  if (isTauriEnvironment()) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke<boolean>('toggle_click_through');
    } catch (err) {
      console.error('Failed to toggle click-through:', err);
      return false;
    }
  } else {
    console.log('[Browser Fallback] Click-through toggled');
    return false;
  }
}

export async function minimizeWindow(): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().minimize();
    } catch (err) {
      console.error('Failed to minimize window:', err);
    }
  }
}

export async function closeWindow(): Promise<void> {
  if (isTauriEnvironment()) {
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window');
      await getCurrentWindow().close();
    } catch (err) {
      console.error('Failed to close window:', err);
    }
  }
}

export function subscribeToTauriEvents(callbacks: {
  onModeChange?: (mode: DesktopWindowMode) => void;
  onTogglePlay?: () => void;
  onNextStation?: () => void;
  onToggleHUD?: () => void;
}): () => void {
  if (!isTauriEnvironment()) {
    return () => {};
  }

  let unlisteners: Array<() => void> = [];

  import('@tauri-apps/api/event').then(({ listen }) => {
    if (callbacks.onModeChange) {
      listen<string>('desktop-mode-changed', (event) => {
        callbacks.onModeChange?.(event.payload as DesktopWindowMode);
      }).then((unlisten) => unlisteners.push(unlisten));
    }
    if (callbacks.onTogglePlay) {
      listen('tray-toggle-play', () => {
        callbacks.onTogglePlay?.();
      }).then((unlisten) => unlisteners.push(unlisten));
    }
    if (callbacks.onNextStation) {
      listen('tray-next-station', () => {
        callbacks.onNextStation?.();
      }).then((unlisten) => unlisteners.push(unlisten));
    }
    if (callbacks.onToggleHUD) {
      listen('tray-toggle-hud', () => {
        callbacks.onToggleHUD?.();
      }).then((unlisten) => unlisteners.push(unlisten));
    }
  });

  return () => {
    unlisteners.forEach((u) => u());
  };
}

