export interface PlaylistTrack {
  id: string; // unique ID or audio URL
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  artworkUrl?: string;
  audioUrl: string;
  rawLrc?: string;
  addedAt: number;
  storedFileName?: string;
  originalName?: string;
  size?: number;
  fileHash?: string;
  status?: 'ok' | 'missing' | 'needs-readding';
}

export interface Playlist {
  id: string;
  name: string;
  isDefault?: boolean; // Favorites cannot be deleted
  createdAt: number;
  updatedAt: number;
  orderIndex: number;
  coverColor?: string;
  coverEmoji?: string;
  tracks: PlaylistTrack[];
}

export type PlaylistSortOption = 'updated' | 'name' | 'created';

const DB_NAME = 'astralyr_library_db';
const LEGACY_DB_NAME = 'constella_library_db';
const DB_VERSION = 1;
const PLAYLISTS_STORE = 'playlists';
const SETTINGS_STORE = 'settings';

export const DEFAULT_FAVORITES_ID = 'favorites';

class PlaylistDbService {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private listeners: Set<() => void> = new Set();

  private getDb(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = request.result;
        if (!db.objectStoreNames.contains(PLAYLISTS_STORE)) {
          const store = db.createObjectStore(PLAYLISTS_STORE, { keyPath: 'id' });
          store.createIndex('orderIndex', 'orderIndex', { unique: false });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        }
      };

      request.onsuccess = async () => {
        const db = request.result;
        try {
          await this.migrateFromLegacyDb(db);
        } catch (e) {
          console.warn('[Astralyr] Non-fatal legacy DB migration error:', e);
        }

        // Ensure default 'Favorites' playlist exists
        this.ensureDefaultFavorites(db)
          .then(() => resolve(db))
          .catch(() => resolve(db));
      };

      request.onerror = () => {
        console.error('Failed to open Astralyr Playlist IndexedDB:', request.error);
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  private async migrateFromLegacyDb(newDb: IDBDatabase): Promise<void> {
    if (typeof window === 'undefined' || !window.indexedDB) return;
    const migrationDoneKey = 'astralyr_idb_migrated';
    if (localStorage.getItem(migrationDoneKey)) return;

    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(LEGACY_DB_NAME);
        req.onsuccess = () => {
          const legacyDb = req.result;
          if (!legacyDb.objectStoreNames.contains(PLAYLISTS_STORE)) {
            legacyDb.close();
            localStorage.setItem(migrationDoneKey, 'true');
            return resolve();
          }

          const legacyTx = legacyDb.transaction(PLAYLISTS_STORE, 'readonly');
          const legacyStore = legacyTx.objectStore(PLAYLISTS_STORE);
          const getAllReq = legacyStore.getAll();

          getAllReq.onsuccess = () => {
            const oldPlaylists: Playlist[] = getAllReq.result || [];
            legacyDb.close();

            if (oldPlaylists.length > 0) {
              const writeTx = newDb.transaction([PLAYLISTS_STORE], 'readwrite');
              const writeStore = writeTx.objectStore(PLAYLISTS_STORE);
              for (const pl of oldPlaylists) {
                writeStore.put(pl);
              }
              writeTx.oncomplete = () => {
                localStorage.setItem(migrationDoneKey, 'true');
                resolve();
              };
              writeTx.onerror = () => {
                localStorage.setItem(migrationDoneKey, 'true');
                resolve();
              };
            } else {
              localStorage.setItem(migrationDoneKey, 'true');
              resolve();
            }
          };

          getAllReq.onerror = () => {
            legacyDb.close();
            localStorage.setItem(migrationDoneKey, 'true');
            resolve();
          };
        };

        req.onerror = () => {
          localStorage.setItem(migrationDoneKey, 'true');
          resolve();
        };
      } catch {
        localStorage.setItem(migrationDoneKey, 'true');
        resolve();
      }
    });
  }

  private async ensureDefaultFavorites(db: IDBDatabase): Promise<void> {
    return new Promise((resolve) => {
      const tx = db.transaction(PLAYLISTS_STORE, 'readwrite');
      const store = tx.objectStore(PLAYLISTS_STORE);
      const req = store.get(DEFAULT_FAVORITES_ID);

      req.onsuccess = () => {
        if (!req.result) {
          const defaultFav: Playlist = {
            id: DEFAULT_FAVORITES_ID,
            name: 'Favorites',
            isDefault: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            orderIndex: 0,
            coverEmoji: '❤️',
            tracks: [],
          };
          store.put(defaultFav);
        }
        resolve();
      };
      req.onerror = () => resolve();
    });
  }

  public subscribe(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify() {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (e) {
        console.error(e);
      }
    });
  }

  public async getAllPlaylists(): Promise<Playlist[]> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PLAYLISTS_STORE, 'readonly');
      const store = tx.objectStore(PLAYLISTS_STORE);
      const req = store.getAll();

      req.onsuccess = () => {
        const playlists: Playlist[] = req.result || [];
        resolve(playlists);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async getPlaylist(id: string): Promise<Playlist | undefined> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PLAYLISTS_STORE, 'readonly');
      const store = tx.objectStore(PLAYLISTS_STORE);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  public async savePlaylist(playlist: Playlist): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PLAYLISTS_STORE, 'readwrite');
      const store = tx.objectStore(PLAYLISTS_STORE);
      const req = store.put({
        ...playlist,
        updatedAt: Date.now(),
      });

      req.onsuccess = () => {
        this.notify();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async createPlaylist(
    name: string,
    options: { coverColor?: string; coverEmoji?: string; initialTracks?: PlaylistTrack[] } = {}
  ): Promise<Playlist> {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('Playlist name cannot be empty');

    const all = await this.getAllPlaylists();
    const isDup = all.some((p) => p.name.toLowerCase() === trimmed.toLowerCase());
    if (isDup) throw new Error(`A playlist named "${trimmed}" already exists`);

    const maxOrder = all.reduce((max, p) => Math.max(max, p.orderIndex ?? 0), 0);

    const newPlaylist: Playlist = {
      id: 'pl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
      name: trimmed,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      orderIndex: maxOrder + 1,
      coverColor: options.coverColor,
      coverEmoji: options.coverEmoji,
      tracks: options.initialTracks || [],
    };

    await this.savePlaylist(newPlaylist);
    return newPlaylist;
  }

  public async renamePlaylist(
    id: string,
    newName: string,
    options?: { coverColor?: string; coverEmoji?: string }
  ): Promise<Playlist> {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Playlist name cannot be empty');

    const all = await this.getAllPlaylists();
    const isDup = all.some((p) => p.id !== id && p.name.toLowerCase() === trimmed.toLowerCase());
    if (isDup) throw new Error(`A playlist named "${trimmed}" already exists`);

    const playlist = await this.getPlaylist(id);
    if (!playlist) throw new Error('Playlist not found');

    const updated: Playlist = {
      ...playlist,
      name: trimmed,
      coverColor: options?.coverColor !== undefined ? options.coverColor : playlist.coverColor,
      coverEmoji: options?.coverEmoji !== undefined ? options.coverEmoji : playlist.coverEmoji,
      updatedAt: Date.now(),
    };

    await this.savePlaylist(updated);
    return updated;
  }

  public async deletePlaylist(id: string): Promise<Playlist | null> {
    const playlist = await this.getPlaylist(id);
    if (!playlist) return null;
    if (playlist.isDefault || playlist.id === DEFAULT_FAVORITES_ID) {
      throw new Error('The default Favorites playlist cannot be deleted');
    }

    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PLAYLISTS_STORE, 'readwrite');
      const store = tx.objectStore(PLAYLISTS_STORE);
      const req = store.delete(id);

      req.onsuccess = () => {
        this.notify();
        resolve(playlist);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async restorePlaylist(playlist: Playlist): Promise<void> {
    const db = await this.getDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PLAYLISTS_STORE, 'readwrite');
      const store = tx.objectStore(PLAYLISTS_STORE);
      const req = store.put(playlist);

      req.onsuccess = () => {
        this.notify();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async reorderPlaylists(orderedIds: string[]): Promise<void> {
    const db = await this.getDb();
    const all = await this.getAllPlaylists();
    const map = new Map(all.map((p) => [p.id, p]));

    return new Promise((resolve, reject) => {
      const tx = db.transaction(PLAYLISTS_STORE, 'readwrite');
      const store = tx.objectStore(PLAYLISTS_STORE);

      orderedIds.forEach((id, index) => {
        const item = map.get(id);
        if (item) {
          item.orderIndex = index;
          store.put(item);
        }
      });

      tx.oncomplete = () => {
        this.notify();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }

  public async addTrackToPlaylist(
    playlistId: string,
    track: PlaylistTrack
  ): Promise<{ added: boolean; isDuplicate: boolean; playlistName: string }> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) throw new Error('Playlist not found');

    const isDuplicate = playlist.tracks.some(
      (t) => t.id === track.id || (t.title.toLowerCase() === track.title.toLowerCase() && t.artist.toLowerCase() === track.artist.toLowerCase())
    );

    if (isDuplicate) {
      return { added: false, isDuplicate: true, playlistName: playlist.name };
    }

    const updatedTracks = [
      ...playlist.tracks,
      {
        ...track,
        addedAt: Date.now(),
      },
    ];

    await this.savePlaylist({
      ...playlist,
      tracks: updatedTracks,
      updatedAt: Date.now(),
    });

    return { added: true, isDuplicate: false, playlistName: playlist.name };
  }

  public async removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    const playlist = await this.getPlaylist(playlistId);
    if (!playlist) return;

    const updatedTracks = playlist.tracks.filter((t) => t.id !== trackId);
    await this.savePlaylist({
      ...playlist,
      tracks: updatedTracks,
      updatedAt: Date.now(),
    });
  }

  public async isTrackInFavorites(trackId: string): Promise<boolean> {
    const fav = await this.getPlaylist(DEFAULT_FAVORITES_ID);
    if (!fav) return false;
    return fav.tracks.some((t) => t.id === trackId);
  }

  public async toggleFavorite(track: PlaylistTrack): Promise<boolean> {
    const fav = await this.getPlaylist(DEFAULT_FAVORITES_ID);
    if (!fav) return false;

    const exists = fav.tracks.some((t) => t.id === track.id || (t.title.toLowerCase() === track.title.toLowerCase() && t.artist.toLowerCase() === track.artist.toLowerCase()));
    if (exists) {
      await this.removeTrackFromPlaylist(DEFAULT_FAVORITES_ID, track.id);
      return false;
    } else {
      await this.addTrackToPlaylist(DEFAULT_FAVORITES_ID, track);
      return true;
    }
  }

  public async getAllUniqueTracks(): Promise<PlaylistTrack[]> {
    const playlists = await this.getAllPlaylists();
    const map = new Map<string, PlaylistTrack>();
    for (const pl of playlists) {
      for (const t of pl.tracks) {
        if (!map.has(t.id)) {
          map.set(t.id, t);
        }
      }
    }
    return Array.from(map.values());
  }

  public async getAllTrackIds(): Promise<string[]> {
    const tracks = await this.getAllUniqueTracks();
    return tracks.map((t) => t.id);
  }

  public async updateTrack(trackId: string, updates: Partial<PlaylistTrack>): Promise<void> {
    const playlists = await this.getAllPlaylists();
    let changed = false;

    for (const pl of playlists) {
      let plChanged = false;
      const newTracks = pl.tracks.map((t) => {
        if (t.id === trackId) {
          plChanged = true;
          return { ...t, ...updates };
        }
        return t;
      });

      if (plChanged) {
        await this.savePlaylist({ ...pl, tracks: newTracks });
        changed = true;
      }
    }

    if (changed) {
      this.notify();
    }
  }

  public async updateTrackStatuses(statuses: Record<string, 'ok' | 'missing' | 'needs-readding'>): Promise<void> {
    const playlists = await this.getAllPlaylists();
    let changed = false;

    for (const pl of playlists) {
      let plChanged = false;
      const newTracks = pl.tracks.map((t) => {
        const nextStatus = statuses[t.id];
        if (nextStatus && t.status !== nextStatus) {
          plChanged = true;
          return { ...t, status: nextStatus };
        }
        return t;
      });

      if (plChanged) {
        await this.savePlaylist({ ...pl, tracks: newTracks });
        changed = true;
      }
    }

    if (changed) {
      this.notify();
    }
  }

  public async removeTrackEverywhere(trackId: string): Promise<void> {
    const playlists = await this.getAllPlaylists();
    for (const pl of playlists) {
      const hasTrack = pl.tracks.some((t) => t.id === trackId);
      if (hasTrack) {
        await this.removeTrackFromPlaylist(pl.id, trackId);
      }
    }
  }
}

export const playlistDb = new PlaylistDbService();

