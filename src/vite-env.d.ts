/// <reference types="vite/client" />

declare module '*.css' {
  const content: Record<string, string>;
  export default content;
}

declare module '@fontsource/*';

interface PersistentTrack {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: number;
  fileName: string;
  filePath: string;
  artworkUrl?: string;
  addedAt: number;
}

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
    getPathForFile?: (file: File) => string;
    library?: {
      importSongs: (filePaths?: string[]) => Promise<PersistentTrack[]>;
      getPlaylist: () => Promise<PersistentTrack[]>;
      removeSong: (trackIdOrFileName: string) => Promise<PersistentTrack[]>;
      importFiles: (filePaths: string[]) => Promise<{
        tracks: Array<{
          id: string;
          title: string;
          artist: string;
          album?: string;
          duration: number;
          artwork?: string;
          storedFileName: string;
          originalName: string;
          size: number;
          fileHash: string;
          addedAt: number;
          status?: 'ok' | 'missing' | 'needs-readding';
        }>;
        duplicates: number;
        errors: Array<{ filename: string; error: string }>;
      }>;
      selectAndImport: () => Promise<{
        tracks: Array<{
          id: string;
          title: string;
          artist: string;
          album?: string;
          duration: number;
          artwork?: string;
          storedFileName: string;
          originalName: string;
          size: number;
          fileHash: string;
          addedAt: number;
          status?: 'ok' | 'missing' | 'needs-readding';
        }>;
        duplicates: number;
        errors: Array<{ filename: string; error: string }>;
      }>;
      onImportProgress: (
        callback: (data: { current: number; total: number; filename: string }) => void
      ) => () => void;
      getStats: () => Promise<{
        libraryDir: string;
        trackCount: number;
        totalSizeBytes: number;
        freeSpaceBytes: number;
      }>;
      openFolder: () => Promise<void>;
      verifyFiles: (
        tracks: Array<{ id: string; storedFileName?: string; audioUrl?: string }>
      ) => Promise<Record<string, 'ok' | 'missing' | 'needs-readding'>>;
      locateFile: (
        trackId: string
      ) => Promise<{
        id: string;
        title: string;
        artist: string;
        album?: string;
        duration: number;
        artwork?: string;
        storedFileName: string;
        originalName: string;
        size: number;
        fileHash: string;
        addedAt: number;
        status?: 'ok' | 'missing' | 'needs-readding';
      } | null>;
      deleteTrack: (trackId: string) => Promise<boolean>;
      cleanupUnused: (
        activeTrackIds: string[]
      ) => Promise<{ deletedAudio: number; deletedArt: number; freedBytes: number }>;
      exportBackup: () => Promise<{ success: boolean; destDir?: string; error?: string }>;
      importBackup: () => Promise<{ success: boolean; importedCount: number; error?: string }>;
    };
  };
}

