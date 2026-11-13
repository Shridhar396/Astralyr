import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('System Audio Feature Removal Verification', () => {
  const rootDir = path.resolve(__dirname, '../../..');

  it('confirms systemAudioService.ts and smtc_daemon.ps1 are completely removed', () => {
    const sysAudioService = path.join(rootDir, 'src/services/systemAudioService.ts');
    const smtcDaemon = path.join(rootDir, 'electron/smtc_daemon.ps1');
    const distSmtc = path.join(rootDir, 'dist-electron/smtc_daemon.ps1');

    expect(fs.existsSync(sysAudioService)).toBe(false);
    expect(fs.existsSync(smtcDaemon)).toBe(false);
    expect(fs.existsSync(distSmtc)).toBe(false);
  });

  it('confirms electron/main.ts contains no loopback, smtc, safeStorage, or media session IPC', () => {
    const mainTs = fs.readFileSync(path.join(rootDir, 'electron/main.ts'), 'utf-8');

    expect(mainTs).not.toContain('setDisplayMediaRequestHandler');
    expect(mainTs).not.toContain('smtc_daemon');
    expect(mainTs).not.toContain('startSmtcDaemon');
    expect(mainTs).not.toContain('safeStorage');
    expect(mainTs).not.toContain('safe-storage-encrypt');
    expect(mainTs).not.toContain('safe-storage-decrypt');
    expect(mainTs).not.toContain('get-media-session');
    expect(mainTs).not.toContain('media-session-update');
    expect(mainTs).not.toContain('desktopCapturer');
  });

  it('confirms electron/preload.ts and src/vite-env.d.ts contain no media session or safeStorage APIs', () => {
    const preloadTs = fs.readFileSync(path.join(rootDir, 'electron/preload.ts'), 'utf-8');
    const viteEnvTs = fs.readFileSync(path.join(rootDir, 'src/vite-env.d.ts'), 'utf-8');

    expect(preloadTs).not.toContain('getMediaSession');
    expect(preloadTs).not.toContain('onMediaSessionUpdate');
    expect(preloadTs).not.toContain('encryptSecret');
    expect(preloadTs).not.toContain('decryptSecret');

    expect(viteEnvTs).not.toContain('getMediaSession');
    expect(viteEnvTs).not.toContain('onMediaSessionUpdate');
    expect(viteEnvTs).not.toContain('encryptSecret');
    expect(viteEnvTs).not.toContain('decryptSecret');
  });

  it('confirms package.json does not copy smtc_daemon and has bumped version to 1.0.3', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));

    expect(pkg.version).toBe('1.0.3');
    expect(pkg.scripts['build:electron']).not.toContain('smtc_daemon');
  });

  it('confirms audioManager.ts has no stream attachment or system audio fields', () => {
    const audioMgr = fs.readFileSync(path.join(rootDir, 'src/services/audioManager.ts'), 'utf-8');

    expect(audioMgr).not.toContain('isSystemAudioActive');
    expect(audioMgr).not.toContain('attachMediaStream');
    expect(audioMgr).not.toContain('detachMediaStream');
    expect(audioMgr).not.toContain('mediaStreamSource');
    expect(audioMgr).not.toContain('isStreamAttached');
  });

  it('confirms lrcService.ts has no tab-title hint parser', () => {
    const lrcService = fs.readFileSync(path.join(rootDir, 'src/services/lrcService.ts'), 'utf-8');

    expect(lrcService).not.toContain('parseTabTitleHint');
    expect(lrcService).not.toContain('ParsedTabHint');
  });

  it('confirms BottomTrackPill.tsx has no System Audio switcher, hint banner, or manual search', () => {
    const pill = fs.readFileSync(path.join(rootDir, 'src/components/BottomTrackPill.tsx'), 'utf-8');

    expect(pill).not.toContain('isSystemAudioActive');
    expect(pill).not.toContain('systemAudioStatus');
    expect(pill).not.toContain('Listening… which song is this?');
    expect(pill).not.toContain('onToggleSystemAudio');
    expect(pill).not.toContain('showManualSearch');
    expect(pill).not.toContain('isFingerprinting');
    expect(pill).not.toContain('Share a tab');
    // Ensure Audius and Local File remain
    expect(pill).toContain('Audius');
    expect(pill).toContain('Local File');
    expect(pill).toContain('Glow Color');
  });

  it('confirms AppearanceModal.tsx has no system-audio tab, AudD, or ACRCloud', () => {
    const modal = fs.readFileSync(path.join(rootDir, 'src/components/AppearanceModal.tsx'), 'utf-8');

    expect(modal).not.toContain('system-audio');
    expect(modal).not.toContain('AudD');
    expect(modal).not.toContain('ACRCloud');
    expect(modal).not.toContain('fingerprint');
    expect(modal).not.toContain('systemAudioService');
    // Ensure core tabs remain
    expect(modal).toContain('data-tab="presets"');
    expect(modal).toContain('data-tab="time"');
    expect(modal).toContain('data-tab="date"');
    expect(modal).toContain('data-tab="lyrics"');
    expect(modal).toContain('data-tab="library"');
  });

  it('confirms App.tsx cleans leftover localStorage keys on startup and has no System Audio state', () => {
    const appTsx = fs.readFileSync(path.join(rootDir, 'src/App.tsx'), 'utf-8');

    expect(appTsx).not.toContain('isSystemAudioActive');
    expect(appTsx).not.toContain('systemAudioService');
    expect(appTsx).not.toContain('handleToggleSystemAudio');
    expect(appTsx).toContain("localStorage.removeItem('constella_system_audio_fingerprint_config')");
    expect(appTsx).toContain("localStorage.removeItem('constella_system_audio_notice_shown')");
    expect(appTsx).toContain("localStorage.removeItem('constella_last_source')");
  });

  it('confirms AboutModal.tsx displays v1.0.3', () => {
    const aboutTsx = fs.readFileSync(path.join(rootDir, 'src/components/AboutModal.tsx'), 'utf-8');

    expect(aboutTsx).toContain('v1.0.3');
  });

  it('confirms README.md does not contain the Spotify / Apple Music / system audio capture section', () => {
    const readme = fs.readFileSync(path.join(rootDir, 'README.md'), 'utf-8');

    expect(readme).not.toContain('Works with Spotify, YouTube & Apple Music');
    expect(readme).not.toContain('Loopback Audio Capture');
    expect(readme).not.toContain('ACRCloud');
    expect(readme).not.toContain('AudD');
  });
});
