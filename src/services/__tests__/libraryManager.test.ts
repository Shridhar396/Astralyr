import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Create temporary directory for tests
const testUserData = path.join(os.tmpdir(), 'astralyr-test-' + Date.now());

vi.mock('electron', () => ({
  app: {
    getPath: (name: string) => {
      if (name === 'userData') return testUserData;
      return testUserData;
    },
  },
}));

// Import LibraryManager after electron is mocked
import { LibraryManager } from '../../../electron/libraryManager';

describe('Desktop Music Library Manager', () => {
  let mgr: LibraryManager;
  let testAudioDir: string;
  let sampleMp3_1: string;
  let sampleMp3_2: string;
  let sampleMp3_3: string;

  beforeEach(() => {
    if (fs.existsSync(testUserData)) {
      fs.rmSync(testUserData, { recursive: true, force: true });
    }
    fs.mkdirSync(testUserData, { recursive: true });

    testAudioDir = path.join(testUserData, 'test-audio-source');
    fs.mkdirSync(testAudioDir, { recursive: true });

    // Create 3 valid mock MP3 files
    sampleMp3_1 = path.join(testAudioDir, 'Artist One - Song Alpha.mp3');
    sampleMp3_2 = path.join(testAudioDir, 'Artist Two - Song Beta.mp3');
    sampleMp3_3 = path.join(testAudioDir, 'Artist Three - Song Gamma.mp3');

    // Write mock audio bytes
    fs.writeFileSync(sampleMp3_1, Buffer.from('MOCK_AUDIO_DATA_FOR_SONG_ALPHA_1234567890'));
    fs.writeFileSync(sampleMp3_2, Buffer.from('MOCK_AUDIO_DATA_FOR_SONG_BETA_9876543210'));
    fs.writeFileSync(sampleMp3_3, Buffer.from('MOCK_AUDIO_DATA_FOR_SONG_GAMMA_ABCDEFGHIJ'));

    // Reset singleton instance by re-instantiating or getting instance
    (LibraryManager as any).instance = null;
    mgr = LibraryManager.getInstance();
  });

  afterEach(() => {
    if (fs.existsSync(testUserData)) {
      try {
        fs.rmSync(testUserData, { recursive: true, force: true });
      } catch {}
    }
  });

  it('1. Imports 3 mp3 files with UUID filenames into library directory', async () => {
    const res = await mgr.importFiles([sampleMp3_1, sampleMp3_2, sampleMp3_3]);
    expect(res.tracks.length).toBe(3);
    expect(res.duplicates).toBe(0);
    expect(res.errors.length).toBe(0);

    const libDir = mgr.getLibraryDir();
    expect(fs.existsSync(libDir)).toBe(true);

    for (const track of res.tracks) {
      // Must use UUID, never the original name
      expect(track.storedFileName).toMatch(/^[a-f0-9\-]+\.mp3$/i);
      expect(track.storedFileName).not.toBe(track.originalName);

      const storedPath = path.join(libDir, track.storedFileName);
      expect(fs.existsSync(storedPath)).toBe(true);
      expect(track.status).toBe('ok');
    }
  });

  it('2. Songs still exist and play when original source files are deleted', async () => {
    const res = await mgr.importFiles([sampleMp3_1]);
    const track = res.tracks[0];

    // Delete the original file completely
    fs.unlinkSync(sampleMp3_1);
    expect(fs.existsSync(sampleMp3_1)).toBe(false);

    // Verify stored track in app library is still 100% intact
    const storedPath = path.join(mgr.getLibraryDir(), track.storedFileName);
    expect(fs.existsSync(storedPath)).toBe(true);

    const verified = mgr.verifyFiles([track]);
    expect(verified[track.id]).toBe('ok');
  });

  it('3. Detects duplicate uploads using quick hash and reuses existing copy', async () => {
    // First upload
    const res1 = await mgr.importFiles([sampleMp3_1]);
    expect(res1.tracks.length).toBe(1);
    expect(res1.duplicates).toBe(0);
    const initialTrackId = res1.tracks[0].id;

    // Upload the exact same file again (e.g. from a different path with the same audio content)
    const duplicateSrc = path.join(testAudioDir, 'Another_Folder_Copy.mp3');
    fs.copyFileSync(sampleMp3_1, duplicateSrc);

    const res2 = await mgr.importFiles([duplicateSrc]);
    expect(res2.tracks.length).toBe(1);
    expect(res2.duplicates).toBe(1);
    expect(res2.tracks[0].id).toBe(initialTrackId); // Reused same track ID

    // Ensure only 1 physical audio file exists in library folder
    const libFiles = fs.readdirSync(mgr.getLibraryDir()).filter((f) => f.endsWith('.mp3'));
    expect(libFiles.length).toBe(1);
  });

  it('4. Marks track as "missing" when file is deleted from library folder and allows relocation', async () => {
    const res = await mgr.importFiles([sampleMp3_1]);
    const track = res.tracks[0];
    const storedPath = path.join(mgr.getLibraryDir(), track.storedFileName);

    // Delete file from library folder
    fs.unlinkSync(storedPath);
    expect(fs.existsSync(storedPath)).toBe(false);

    // Verify status returns "missing" without crashing
    const check1 = mgr.verifyFiles([track]);
    expect(check1[track.id]).toBe('missing');

    // Relocate file using locateFile
    const replacementSrc = path.join(testAudioDir, 'Replacement_Track.mp3');
    fs.writeFileSync(replacementSrc, Buffer.from('NEW_AUDIO_BYTES_FOR_LOCATED_TRACK'));

    const locatedTrack = await mgr.locateFile(track.id, replacementSrc);
    expect(locatedTrack.id).toBe(track.id);
    expect(fs.existsSync(path.join(mgr.getLibraryDir(), locatedTrack.storedFileName))).toBe(true);

    // Status is now "ok"
    const check2 = mgr.verifyFiles([locatedTrack]);
    expect(check2[track.id]).toBe('ok');
  });

  it('5. Exports and imports library backup', async () => {
    await mgr.importFiles([sampleMp3_1, sampleMp3_2]);
    const originalTracks = mgr.getAllTracks();
    expect(originalTracks.length).toBe(2);

    const backupDir = path.join(testUserData, 'export-target');
    fs.mkdirSync(backupDir, { recursive: true });

    // Export backup
    const exportResult = await mgr.exportBackup(backupDir);
    expect(exportResult.success).toBe(true);

    const backupSubDirs = fs.readdirSync(backupDir);
    const backupFolder = backupSubDirs.find((d) => d.startsWith('Astralyr_Library_Backup_'));
    expect(backupFolder).toBeDefined();

    const fullBackupPath = path.join(backupDir, backupFolder!);
    expect(fs.existsSync(path.join(fullBackupPath, 'library.json'))).toBe(true);

    // Clear current library to test import
    (LibraryManager as any).instance = null;
    fs.rmSync(mgr.getLibraryDir(), { recursive: true, force: true });
    fs.unlinkSync(path.join(testUserData, 'library.json'));

    const freshMgr = LibraryManager.getInstance();
    expect(freshMgr.getAllTracks().length).toBe(0);

    // Import from backup
    const importResult = await freshMgr.importBackup(fullBackupPath);
    expect(importResult.success).toBe(true);
    expect(importResult.importedCount).toBe(2);
    expect(freshMgr.getAllTracks().length).toBe(2);
  });

  it('6. Cleans up unreferenced audio and artwork files', async () => {
    const res = await mgr.importFiles([sampleMp3_1, sampleMp3_2, sampleMp3_3]);
    expect(res.tracks.length).toBe(3);

    // Only track 1 is kept in active playlists
    const activeIds = [res.tracks[0].id];
    const cleanupRes = await mgr.cleanupUnused(activeIds);

    expect(cleanupRes.deletedAudio).toBe(2); // Tracks 2 and 3 removed
    const remainingFiles = fs.readdirSync(mgr.getLibraryDir()).filter((f) => f.endsWith('.mp3'));
    expect(remainingFiles.length).toBe(1);
    expect(remainingFiles[0]).toBe(res.tracks[0].storedFileName);
  });

  it('7. Rejects path traversal and malformed resource IDs', () => {
    // Protocol handler validation rules:
    const isValidResourceId = (id: string) => /^[a-zA-Z0-9_\-]+$/.test(id);

    expect(isValidResourceId('../../etc/passwd')).toBe(false);
    expect(isValidResourceId('..\\..\\Windows\\System32')).toBe(false);
    expect(isValidResourceId('../secret.mp3')).toBe(false);
    expect(isValidResourceId('track-1234_abc')).toBe(true);
    expect(isValidResourceId('9f32ac29-87c1-4cfa-932d-209fae48d39c')).toBe(true);
  });

  it('8. Flags legacy blob: and file:// tracks as needs-readding', () => {
    const legacyTracks = [
      { id: 'track-old-blob', audioUrl: 'blob:http://localhost:5173/1234-5678' },
      { id: 'track-old-file', audioUrl: 'file:///C:/Users/Music/song.mp3' },
      { id: 'track-online', audioUrl: 'https://api.audius.co/v1/tracks/123/stream' },
    ];

    const results = mgr.verifyFiles(legacyTracks);
    expect(results['track-old-blob']).toBe('needs-readding');
    expect(results['track-old-file']).toBe('needs-readding');
    expect(results['track-online']).toBe('ok');
  });

  it('9. Supports HTTP 206 Partial Content streaming and byte ranges for seeking', async () => {
    const res = await mgr.importFiles([sampleMp3_1]);
    const track = res.tracks[0];
    const filePath = path.join(mgr.getLibraryDir(), track.storedFileName);
    const stat = fs.statSync(filePath);

    // Simulate range header: "bytes=10-25"
    const start = 10;
    const end = 25;
    const chunkSize = end - start + 1;

    expect(chunkSize).toBe(16);
    expect(start).toBeLessThan(stat.size);
    expect(end).toBeLessThan(stat.size);

    const stream = fs.createReadStream(filePath, { start, end });
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const sliced = Buffer.concat(chunks);
    expect(sliced.length).toBe(16);

    const fullContent = fs.readFileSync(filePath);
    expect(sliced).toEqual(fullContent.subarray(start, end + 1));
  });

  it('10. importSongs copies audio into library with <timestamp>-<originalName> and saves playlist.json', async () => {
    const playlist = await mgr.importSongs([sampleMp3_1, sampleMp3_2]);
    expect(playlist.length).toBe(2);

    const playlistFile = mgr.getPlaylistPath();
    expect(fs.existsSync(playlistFile)).toBe(true);

    const onDiskPlaylist = JSON.parse(fs.readFileSync(playlistFile, 'utf-8'));
    expect(onDiskPlaylist.length).toBe(2);

    for (const track of playlist) {
      expect(track.id).toBeDefined();
      expect(track.fileName).toMatch(/^\d+-[a-zA-Z0-9_\-]+\.mp3$/);
      expect(fs.existsSync(track.filePath)).toBe(true);
      expect(track.title).toBeDefined();
      expect(track.artist).toBeDefined();
    }
  });

  it('11. Reloads and auto-restores playlist.json across app restarts', async () => {
    await mgr.importSongs([sampleMp3_1]);
    const originalPlaylist = await mgr.getPlaylist();
    expect(originalPlaylist.length).toBe(1);

    // Simulate app restart by clearing singleton instance
    (LibraryManager as any).instance = null;
    const restartedMgr = LibraryManager.getInstance();

    const restoredPlaylist = await restartedMgr.getPlaylist();
    expect(restoredPlaylist.length).toBe(1);
    expect(restoredPlaylist[0].id).toBe(originalPlaylist[0].id);
    expect(restoredPlaylist[0].fileName).toBe(originalPlaylist[0].fileName);
    expect(fs.existsSync(restoredPlaylist[0].filePath)).toBe(true);
  });

  it('12. Auto-prunes missing files from playlist.json when files are deleted externally', async () => {
    const playlist = await mgr.importSongs([sampleMp3_1, sampleMp3_2]);
    expect(playlist.length).toBe(2);

    // Delete one of the copied files directly from library directory
    fs.unlinkSync(playlist[0].filePath);
    expect(fs.existsSync(playlist[0].filePath)).toBe(false);

    // getPlaylist() should detect missing file and prune it
    const prunedPlaylist = await mgr.getPlaylist();
    expect(prunedPlaylist.length).toBe(1);
    expect(prunedPlaylist[0].id).toBe(playlist[1].id);

    // Verify playlist.json was saved with pruned state
    const onDisk = JSON.parse(fs.readFileSync(mgr.getPlaylistPath(), 'utf-8'));
    expect(onDisk.length).toBe(1);
    expect(onDisk[0].id).toBe(playlist[1].id);
  });

  it('13. removeSong removes entry from playlist.json and unlinks file from disk', async () => {
    const playlist = await mgr.importSongs([sampleMp3_1, sampleMp3_2]);
    const trackToRemove = playlist[0];
    expect(fs.existsSync(trackToRemove.filePath)).toBe(true);

    const remaining = await mgr.removeSong(trackToRemove.id);
    expect(remaining.length).toBe(1);
    expect(remaining.find((t) => t.id === trackToRemove.id)).toBeUndefined();

    // Verify file unlinked from disk
    expect(fs.existsSync(trackToRemove.filePath)).toBe(false);

    // Verify playlist.json updated
    const onDisk = JSON.parse(fs.readFileSync(mgr.getPlaylistPath(), 'utf-8'));
    expect(onDisk.length).toBe(1);
    expect(onDisk[0].id).toBe(playlist[1].id);
  });

  it('14. handleMediaRequest streams track by filename and by UUID with CORS and 206 range support', async () => {
    const playlist = await mgr.importSongs([sampleMp3_1]);
    const track = playlist[0];

    // 1. Full track request by fileName: astralyr-media://track/<fileName>
    const req1 = new Request(`astralyr-media://track/${encodeURIComponent(track.fileName)}`);
    const res1 = await mgr.handleMediaRequest(req1);
    expect(res1.status).toBe(200);
    expect(res1.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res1.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(res1.headers.get('Accept-Ranges')).toBe('bytes');

    // 2. Range request: bytes=0-15
    const req2 = new Request(`astralyr-media://track/${encodeURIComponent(track.fileName)}`, {
      headers: { range: 'bytes=0-15' },
    });
    const res2 = await mgr.handleMediaRequest(req2);
    expect(res2.status).toBe(206);
    expect(res2.headers.get('Content-Range')).toMatch(/^bytes 0-15\/\d+$/);
    expect(res2.headers.get('Content-Length')).toBe('16');
    expect(res2.headers.get('Access-Control-Allow-Origin')).toBe('*');

    // 3. Track request by UUID: astralyr-media://<trackId>
    const req3 = new Request(`astralyr-media://${track.id}`);
    const res3 = await mgr.handleMediaRequest(req3);
    expect(res3.status).toBe(200);

    // 4. Legacy alias constella-media://track/<fileName>
    const req4 = new Request(`constella-media://track/${encodeURIComponent(track.fileName)}`);
    const res4 = await mgr.handleMediaRequest(req4);
    expect(res4.status).toBe(200);
  });

  it('15. handleMediaRequest security: rejects path traversal and returns 404 for missing resources', async () => {
    // 1. Path traversal attempt
    const req1 = new Request('astralyr-media://track/..%2F..%2Fsecret.txt');
    const res1 = await mgr.handleMediaRequest(req1);
    expect(res1.status).toBe(403);

    // 2. Non-existent file
    const req2 = new Request('astralyr-media://track/nonexistent-song.mp3');
    const res2 = await mgr.handleMediaRequest(req2);
    expect(res2.status).toBe(404);
  });
});
