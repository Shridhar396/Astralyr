/// <reference types="vite/client" />

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

declare module '@fontsource/*';

interface Window {
  electronAPI?: {
    isElectron: boolean;
    platform: string;
    toggleFullscreen: () => Promise<boolean>;
    toggleAlwaysOnTop: () => Promise<boolean>;
    isAlwaysOnTop: () => Promise<boolean>;
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    getMediaSession: () => Promise<any>;
    onMediaSessionUpdate: (callback: (data: any) => void) => () => void;
    encryptSecret: (plain: string) => Promise<string>;
    decryptSecret: (cipher: string) => Promise<string>;
  };
}

