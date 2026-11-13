import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { Readable } from 'stream';

export interface StoredTrack {
  id: string; // UUID
  title: string;
  artist: string;
  album?: string;
  duration: number; // in seconds
  artwork?: string; // e.g. "astralyr-media://art/<id>"
  storedFileName: string; // e.g. "<id>.mp3"
  originalName: string; // original filename e.g. "Song.mp3"
  size: number; // in bytes
  fileHash: string; // SHA-1 of first 1MB + size
  addedAt: number;
  status?: 'ok' | 'missing' | 'needs-readding';
}

export interface LibraryDatabase {
  version: number;
  tracks: Record<string, StoredTrack>;
}

export class LibraryManager {
  private static instance: LibraryManager | null = null;
  private libraryDir: string;
  private artDir: string;
  private dbPath: string;
  private db: LibraryDatabase = { version: 1, tracks: {} };

  private constructor() {
    const userData = app.getPath('userData');
    this.libraryDir = path.join(userData, 'library');
    this.artDir = path.join(this.libraryDir, 'art');
    this.dbPath = path.join(userData, 'library.json');

    this.ensureDirs();
    this.loadDb();
  }

  public static getInstance(): LibraryManager {
    if (!LibraryManager.instance) {
      LibraryManager.instance = new LibraryManager();
    }
    return LibraryManager.instance;
  }

  public getLibraryDir(): string {
    return this.libraryDir;
  }

  public getArtDir(): string {
    return this.artDir;
  }

  private ensureDirs(): void {
    try {
      if (!fs.existsSync(this.libraryDir)) {
        fs.mkdirSync(this.libraryDir, { recursive: true });
      }
      if (!fs.existsSync(this.artDir)) {
        fs.mkdirSync(this.artDir, { recursive: true });
      }
    } catch (err) {
      console.error('[LibraryManager] Failed to create directories:', err);
    }
  }

  private loadDb(): void {
    try {
      if (fs.existsSync(this.dbPath)) {
        const raw = fs.readFileSync(this.dbPath, 'utf-8');
        this.db = JSON.parse(raw);
        if (!this.db.tracks) this.db.tracks = {};
      } else {
        this.saveDb();
      }
    } catch (err) {
      console.warn('[LibraryManager] Failed to load library.json, initializing empty:', err);
      this.db = { version: 1, tracks: {} };
    }
  }

  private saveDb(): void {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.db, null, 2), 'utf-8');
    } catch (err) {
      console.error('[LibraryManager] Failed to save library.json:', err);
    }
  }

  public getAllTracks(): StoredTrack[] {
    return Object.values(this.db.tracks);
  }

  public getTrack(trackId: string): StoredTrack | undefined {
    return this.db.tracks[trackId];
  }

  /**
   * Quick SHA-1 hash of the first 1MB of the file + size
   */
  public async computeQuickHash(filePath: string): Promise<string> {
    const stat = await fs.promises.stat(filePath);
    const chunkSize = Math.min(stat.size, 1024 * 1024);
    const fd = await fs.promises.open(filePath, 'r');
    const buffer = Buffer.alloc(chunkSize);
    await fd.read(buffer, 0, chunkSize, 0);
    await fd.close();

    const hash = crypto.createHash('sha1');
    hash.update(buffer);
    hash.update(String(stat.size));
    return hash.digest('hex');
  }

  /**
   * Get available free disk space on library volume in bytes
   */
  public async getFreeDiskSpace(): Promise<number> {
    try {
      const stats = await fs.promises.statfs(this.libraryDir);
      return Number(stats.bfree) * Number(stats.bsize);
    } catch {
      return 10 * 1024 * 1024 * 1024; // fallback 10 GB
    }
  }

  /**
   * Extract ID3 metadata and embedded cover artwork
   */
  private async parseMetadataAndArtwork(
    filePath: string,
    trackId: string
  ): Promise<{ title?: string; artist?: string; album?: string; duration?: number; hasArtwork: boolean }> {
    const res: { title?: string; artist?: string; album?: string; duration?: number; hasArtwork: boolean } = {
      hasArtwork: false,
    };

    try {
      const stat = await fs.promises.stat(filePath);
      const readSize = Math.min(stat.size, 262144); // 256 KB
      const fd = await fs.promises.open(filePath, 'r');
      const buf = Buffer.alloc(readSize);
      await fd.read(buf, 0, readSize, 0);
      await fd.close();

      // Check ID3v2
      if (buf.length >= 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
        const majorVersion = buf[3];
        const flags = buf[5];
        const tagSize =
          ((buf[6] & 0x7f) << 21) |
          ((buf[7] & 0x7f) << 14) |
          ((buf[8] & 0x7f) << 7) |
          (buf[9] & 0x7f);

        let offset = 10;
        if (flags & 0x40 && offset + 4 < buf.length) {
          const extSize = buf.readUInt32BE(offset);
          offset += extSize + 4;
        }

        const maxOffset = Math.min(buf.length, 10 + tagSize);

        while (offset + 10 < maxOffset) {
          const frameId = buf.subarray(offset, offset + 4).toString('ascii');
          if (buf[offset] === 0 && buf[offset + 1] === 0) break;

          let frameSize = 0;
          if (majorVersion === 4) {
            frameSize =
              ((buf[offset + 4] & 0x7f) << 21) |
              ((buf[offset + 5] & 0x7f) << 14) |
              ((buf[offset + 6] & 0x7f) << 7) |
              (buf[offset + 7] & 0x7f);
          } else {
            frameSize = buf.readUInt32BE(offset + 4);
          }

          offset += 10;
          if (frameSize <= 0 || offset + frameSize > buf.length) break;

          const frameBytes = buf.subarray(offset, offset + frameSize);

          if (frameId === 'TIT2') {
            res.title = this.decodeTextFrame(frameBytes);
          } else if (frameId === 'TPE1') {
            res.artist = this.decodeTextFrame(frameBytes);
          } else if (frameId === 'TALB') {
            res.album = this.decodeTextFrame(frameBytes);
          } else if (frameId === 'TLEN') {
            const rawLen = this.decodeTextFrame(frameBytes);
            const parsedMs = parseInt(rawLen, 10);
            if (!isNaN(parsedMs) && parsedMs > 0) {
              res.duration = Math.round(parsedMs / 1000);
            }
          } else if (frameId === 'APIC' && !res.hasArtwork) {
            const artSaved = this.saveApicArtwork(frameBytes, trackId);
            if (artSaved) res.hasArtwork = true;
          }

          offset += frameSize;
        }
      }

      // Fallback ID3v1 at end of file if title/artist missing
      if ((!res.title || !res.artist) && stat.size >= 128) {
        const tailFd = await fs.promises.open(filePath, 'r');
        const tailBuf = Buffer.alloc(128);
        await tailFd.read(tailBuf, 0, 128, stat.size - 128);
        await tailFd.close();

        if (tailBuf.subarray(0, 3).toString('ascii') === 'TAG') {
          if (!res.title) {
            res.title = tailBuf.subarray(3, 33).toString('latin1').replace(/\0/g, '').trim();
          }
          if (!res.artist) {
            res.artist = tailBuf.subarray(33, 63).toString('latin1').replace(/\0/g, '').trim();
          }
          if (!res.album) {
            res.album = tailBuf.subarray(63, 93).toString('latin1').replace(/\0/g, '').trim();
          }
        }
      }
    } catch (e) {
      console.warn('[LibraryManager] Metadata parse error:', e);
    }

    return res;
  }

  private decodeTextFrame(bytes: Buffer): string {
    if (bytes.length < 2) return '';
    const encoding = bytes[0];
    const data = bytes.subarray(1);

    try {
      if (encoding === 0) return data.toString('latin1').replace(/\0/g, '').trim();
      if (encoding === 1) return data.toString('utf16le').replace(/\0/g, '').trim();
      if (encoding === 2) return data.toString('utf16le').replace(/\0/g, '').trim();
      if (encoding === 3) return data.toString('utf8').replace(/\0/g, '').trim();
    } catch {}

    return data.toString('utf8').replace(/\0/g, '').trim();
  }

  private saveApicArtwork(bytes: Buffer, trackId: string): boolean {
    try {
      if (bytes.length < 10) return false;
      let offset = 1;
      let mime = '';
      while (offset < bytes.length && bytes[offset] !== 0) {
        mime += String.fromCharCode(bytes[offset]);
        offset++;
      }
      offset++; // skip null
      if (!mime) mime = 'image/jpeg';

      offset++; // skip picture type
      while (offset < bytes.length && bytes[offset] !== 0) {
        offset++;
      }
      offset++; // skip null

      if (offset < bytes.length) {
        const imgBytes = bytes.subarray(offset);
        const artFile = path.join(this.artDir, `${trackId}.jpg`);
        fs.writeFileSync(artFile, imgBytes);
        return true;
      }
    } catch (e) {
      console.warn('[LibraryManager] saveApicArtwork failed:', e);
    }
    return false;
  }

  /**
   * Import batch of files into library folder
   */
  public async importFiles(
    filePaths: string[],
    onProgress?: (progress: { current: number; total: number; filename: string }) => void
  ): Promise<{ tracks: StoredTrack[]; duplicates: number; errors: { filename: string; error: string }[] }> {
    const total = filePaths.length;
    const tracks: StoredTrack[] = [];
    const errors: { filename: string; error: string }[] = [];
    let duplicates = 0;

    // Check disk space
    const freeSpace = await this.getFreeDiskSpace();
    if (freeSpace < 500 * 1024 * 1024) {
      throw new Error('Low disk space: less than 500 MB free on drive.');
    }

    for (let i = 0; i < total; i++) {
      const srcPath = filePaths[i];
      const filename = path.basename(srcPath);

      if (onProgress) {
        onProgress({ current: i + 1, total, filename });
      }

      try {
        if (!fs.existsSync(srcPath)) {
          throw new Error('File does not exist: ' + srcPath);
        }

        const stat = await fs.promises.stat(srcPath);
        const ext = path.extname(srcPath).toLowerCase() || '.mp3';
        const allowedExts = ['.mp3', '.wav', '.flac', '.m4a', '.mp4', '.ogg', '.aac'];
        if (!allowedExts.includes(ext)) {
          throw new Error(`Unsupported audio format: ${ext}`);
        }

        const fileHash = await this.computeQuickHash(srcPath);

        // Check duplicate
        const existing = Object.values(this.db.tracks).find((t) => t.fileHash === fileHash);
        if (existing) {
          const existingFile = path.join(this.libraryDir, existing.storedFileName);
          if (fs.existsSync(existingFile)) {
            duplicates++;
            tracks.push(existing);
            continue;
          }
        }

        const trackId = crypto.randomUUID();
        const storedFileName = `${trackId}${ext}`;
        const destPath = path.join(this.libraryDir, storedFileName);

        // Copy file safely via stream/fs.copyFile (never load entire file in memory)
        await fs.promises.copyFile(srcPath, destPath);

        // Extract metadata & artwork
        const meta = await this.parseMetadataAndArtwork(destPath, trackId);

        // Parse fallback artist and title from filename
        const baseNameNoExt = path.basename(srcPath, ext);
        let fallbackArtist = 'Unknown Artist';
        let fallbackTitle = baseNameNoExt;
        if (baseNameNoExt.includes(' - ')) {
          const parts = baseNameNoExt.split(' - ');
          fallbackArtist = parts[0].trim();
          fallbackTitle = parts.slice(1).join(' - ').trim();
        }

        const track: StoredTrack = {
          id: trackId,
          title: meta.title || fallbackTitle,
          artist: meta.artist || fallbackArtist,
          album: meta.album || 'Local Audio',
          duration: meta.duration || 180,
          artwork: meta.hasArtwork ? `astralyr-media://art/${trackId}` : undefined,
          storedFileName,
          originalName: filename,
          size: stat.size,
          fileHash,
          addedAt: Date.now(),
          status: 'ok',
        };

        this.db.tracks[trackId] = track;
        this.saveDb();
        tracks.push(track);
      } catch (err: any) {
        console.warn(`[LibraryManager] Failed to import ${filename}:`, err);
        errors.push({ filename, error: err.message || 'Import error' });
      }
    }

    return { tracks, duplicates, errors };
  }

  /**
   * Verify whether all stored files exist on disk
   */
  public verifyFiles(
    tracks: { id: string; storedFileName?: string; audioUrl?: string }[]
  ): Record<string, 'ok' | 'missing' | 'needs-readding'> {
    const results: Record<string, 'ok' | 'missing' | 'needs-readding'> = {};

    for (const t of tracks) {
      if (!t.id) continue;

      if (t.audioUrl && (t.audioUrl.startsWith('http://') || t.audioUrl.startsWith('https://'))) {
        results[t.id] = 'ok';
        continue;
      }

      if (t.audioUrl && (t.audioUrl.startsWith('blob:') || t.audioUrl.startsWith('file://'))) {
        results[t.id] = 'needs-readding';
        continue;
      }

      const stored = this.db.tracks[t.id];
      const fileName = stored?.storedFileName || t.storedFileName || `${t.id}.mp3`;
      const fullPath = path.join(this.libraryDir, fileName);

      if (fs.existsSync(fullPath)) {
        results[t.id] = 'ok';
      } else {
        // Fallback: check if any file in library matches t.id prefix
        try {
          const files = fs.readdirSync(this.libraryDir);
          const match = files.find((f) => f.startsWith(t.id + '.'));
          if (match) {
            results[t.id] = 'ok';
          } else {
            results[t.id] = 'missing';
          }
        } catch {
          results[t.id] = 'missing';
        }
      }
    }

    return results;
  }

  /**
   * Re-locate a missing track by copying user's chosen file into library
   */
  public async locateFile(trackId: string, newFilePath: string): Promise<StoredTrack> {
    if (!fs.existsSync(newFilePath)) {
      throw new Error('Selected file does not exist');
    }

    const stat = await fs.promises.stat(newFilePath);
    const ext = path.extname(newFilePath).toLowerCase() || '.mp3';
    const storedFileName = `${trackId}${ext}`;
    const destPath = path.join(this.libraryDir, storedFileName);

    await fs.promises.copyFile(newFilePath, destPath);
    const meta = await this.parseMetadataAndArtwork(destPath, trackId);
    const fileHash = await this.computeQuickHash(destPath);

    const existing = this.db.tracks[trackId];
    const updated: StoredTrack = {
      id: trackId,
      title: existing?.title || meta.title || path.basename(newFilePath, ext),
      artist: existing?.artist || meta.artist || 'Unknown Artist',
      album: existing?.album || meta.album || 'Local Audio',
      duration: meta.duration || existing?.duration || 180,
      artwork: meta.hasArtwork ? `astralyr-media://art/${trackId}` : existing?.artwork,
      storedFileName,
      originalName: path.basename(newFilePath),
      size: stat.size,
      fileHash,
      addedAt: existing?.addedAt || Date.now(),
      status: 'ok',
    };

    this.db.tracks[trackId] = updated;
    this.saveDb();
    return updated;
  }

  /**
   * Delete a track and its artwork permanently from disk and library registry
   */
  public async deleteTrack(trackId: string): Promise<boolean> {
    const track = this.db.tracks[trackId];
    if (track) {
      try {
        const filePath = path.join(this.libraryDir, track.storedFileName);
        if (fs.existsSync(filePath)) {
          await fs.promises.unlink(filePath);
        }
      } catch (e) {
        console.warn('[LibraryManager] Failed to delete audio file:', e);
      }

      try {
        const artPath = path.join(this.artDir, `${trackId}.jpg`);
        if (fs.existsSync(artPath)) {
          await fs.promises.unlink(artPath);
        }
      } catch {}

      delete this.db.tracks[trackId];
      this.saveDb();
      return true;
    }
    return false;
  }

  /**
   * Remove unused files from library folder (files not in activeTrackIds)
   */
  public async cleanupUnused(activeTrackIds: string[]): Promise<{
    deletedCount: number;
    deletedAudio: number;
    deletedArt: number;
    freedBytes: number;
  }> {
    const activeSet = new Set(activeTrackIds);
    let deletedAudio = 0;
    let deletedArt = 0;
    let freedBytes = 0;

    try {
      const files = await fs.promises.readdir(this.libraryDir);
      for (const file of files) {
        if (file === 'art' || file === 'library.json') continue;
        const fullPath = path.join(this.libraryDir, file);
        const stat = await fs.promises.stat(fullPath);
        if (stat.isDirectory()) continue;

        const id = path.parse(file).name;
        if (!activeSet.has(id)) {
          freedBytes += stat.size;
          await fs.promises.unlink(fullPath);
          delete this.db.tracks[id];
          deletedAudio++;
        }
      }

      // Cleanup unreferenced art
      if (fs.existsSync(this.artDir)) {
        const artFiles = await fs.promises.readdir(this.artDir);
        for (const af of artFiles) {
          const id = path.parse(af).name;
          if (!activeSet.has(id)) {
            const artPath = path.join(this.artDir, af);
            try {
              const artStat = await fs.promises.stat(artPath);
              freedBytes += artStat.size;
              await fs.promises.unlink(artPath);
              deletedArt++;
            } catch {}
          }
        }
      }

      this.saveDb();
    } catch (e) {
      console.warn('[LibraryManager] cleanupUnused error:', e);
    }

    return {
      deletedCount: deletedAudio + deletedArt,
      deletedAudio,
      deletedArt,
      freedBytes,
    };
  }

  /**
   * Get library statistics
   */
  public async getStats(): Promise<{
    libraryDir: string;
    libraryPath: string;
    trackCount: number;
    totalSizeBytes: number;
    freeSpaceBytes: number;
  }> {
    let totalSize = 0;
    let trackCount = 0;

    try {
      const files = await fs.promises.readdir(this.libraryDir);
      for (const f of files) {
        if (f === 'art') continue;
        const p = path.join(this.libraryDir, f);
        const st = await fs.promises.stat(p);
        if (st.isFile()) {
          totalSize += st.size;
          trackCount++;
        }
      }
    } catch {}

    const freeSpace = await this.getFreeDiskSpace();

    return {
      libraryDir: this.libraryDir,
      libraryPath: this.libraryDir,
      trackCount,
      totalSizeBytes: totalSize,
      freeSpaceBytes: freeSpace,
    };
  }

  /**
   * Export library backup (database JSON + audio files + artwork)
   */
  public async exportBackup(destFolder: string): Promise<{ success: boolean; backupPath: string }> {
    const backupDirName = `Astralyr_Library_Backup_${Date.now()}`;
    const targetDir = path.join(destFolder, backupDirName);

    await fs.promises.mkdir(targetDir, { recursive: true });
    await fs.promises.mkdir(path.join(targetDir, 'library'), { recursive: true });
    await fs.promises.mkdir(path.join(targetDir, 'library', 'art'), { recursive: true });

    // Copy library.json
    await fs.promises.copyFile(this.dbPath, path.join(targetDir, 'library.json'));

    // Copy audio files
    const files = await fs.promises.readdir(this.libraryDir);
    for (const f of files) {
      if (f === 'art') continue;
      const src = path.join(this.libraryDir, f);
      const dest = path.join(targetDir, 'library', f);
      if ((await fs.promises.stat(src)).isFile()) {
        await fs.promises.copyFile(src, dest);
      }
    }

    // Copy art files
    if (fs.existsSync(this.artDir)) {
      const artFiles = await fs.promises.readdir(this.artDir);
      for (const af of artFiles) {
        const src = path.join(this.artDir, af);
        const dest = path.join(targetDir, 'library', 'art', af);
        await fs.promises.copyFile(src, dest);
      }
    }

    return { success: true, backupPath: targetDir };
  }

  /**
   * Import library backup
   */
  public async importBackup(backupSourceDir: string): Promise<{ success: boolean; importedCount: number }> {
    const backupDbPath = path.join(backupSourceDir, 'library.json');
    if (!fs.existsSync(backupDbPath)) {
      throw new Error('Invalid backup: library.json not found in selected folder');
    }

    const backupDbRaw = await fs.promises.readFile(backupDbPath, 'utf-8');
    const backupDb: LibraryDatabase = JSON.parse(backupDbRaw);

    let count = 0;
    const backupLibDir = path.join(backupSourceDir, 'library');
    if (fs.existsSync(backupLibDir)) {
      const files = await fs.promises.readdir(backupLibDir);
      for (const f of files) {
        if (f === 'art') continue;
        const src = path.join(backupLibDir, f);
        const dest = path.join(this.libraryDir, f);
        if ((await fs.promises.stat(src)).isFile()) {
          await fs.promises.copyFile(src, dest);
          count++;
        }
      }

      // Copy art
      const backupArtDir = path.join(backupLibDir, 'art');
      if (fs.existsSync(backupArtDir)) {
        const artFiles = await fs.promises.readdir(backupArtDir);
        for (const af of artFiles) {
          const src = path.join(backupArtDir, af);
          const dest = path.join(this.artDir, af);
          await fs.promises.copyFile(src, dest);
        }
      }
    }

    // Merge tracks into current db
    Object.assign(this.db.tracks, backupDb.tracks);
    this.saveDb();

    return { success: true, importedCount: count };
  }
}
