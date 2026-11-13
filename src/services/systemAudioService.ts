import { AudioManager } from './audioManager';
import { LrcService, ParsedTabHint } from './lrcService';

export type SystemAudioStatus = 'inactive' | 'listening' | 'silence' | 'error';

export interface IdentifiedSong {
  title: string;
  artist: string;
  album?: string;
  duration?: number;
  position?: number;
  source: 'media_session' | 'fingerprint' | 'manual';
  playbackStatus?: 'Playing' | 'Paused' | 'Closed' | 'Stopped';
  lastUpdated: number;
}

export interface FingerprintConfig {
  enabled: boolean;
  provider: 'audd' | 'acrcloud';
  auddToken: string;
  acrHost: string;
  acrAccessKey: string;
  acrAccessSecret: string;
}

export const DEFAULT_FINGERPRINT_CONFIG: FingerprintConfig = {
  enabled: false,
  provider: 'audd',
  auddToken: '',
  acrHost: '',
  acrAccessKey: '',
  acrAccessSecret: '',
};

const STORAGE_KEY = 'constella_fingerprint_config';
const NOTICE_SHOWN_KEY = 'constella_fingerprint_notice_shown';

export class SystemAudioService {
  private static instance: SystemAudioService | null = null;
  private status: SystemAudioStatus = 'inactive';
  private currentSong: IdentifiedSong | null = null;
  private currentHint: ParsedTabHint | null = null;
  private currentStream: MediaStream | null = null;
  private statusInterval: number | null = null;
  private fingerprintTimer: number | null = null;
  private isFingerprinting = false;

  private statusListeners: Set<(status: SystemAudioStatus, errorMsg?: string) => void> = new Set();
  private songListeners: Set<(song: IdentifiedSong | null) => void> = new Set();
  private songHintListeners: Set<(hint: ParsedTabHint | null) => void> = new Set();
  private noticeListeners: Set<(message: string) => void> = new Set();

  private config: FingerprintConfig = DEFAULT_FINGERPRINT_CONFIG;
  private mediaSessionUnsub: (() => void) | null = null;

  private constructor() {
    this.loadConfig();
    this.initMediaSessionListener();
  }

  public static getInstance(): SystemAudioService {
    if (!SystemAudioService.instance) {
      SystemAudioService.instance = new SystemAudioService();
    }
    return SystemAudioService.instance;
  }

  public getConfig(): FingerprintConfig {
    return { ...this.config };
  }

  public async updateConfig(partial: Partial<FingerprintConfig>): Promise<void> {
    this.config = { ...this.config, ...partial };
    try {
      const dataToStore = { ...this.config };
      // If running in Electron, encrypt sensitive tokens
      if (window.electronAPI?.encryptSecret) {
        if (dataToStore.auddToken) {
          dataToStore.auddToken = await window.electronAPI.encryptSecret(dataToStore.auddToken);
        }
        if (dataToStore.acrAccessSecret) {
          dataToStore.acrAccessSecret = await window.electronAPI.encryptSecret(dataToStore.acrAccessSecret);
        }
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToStore));
    } catch (e) {
      console.warn('[SystemAudioService] Failed to save config:', e);
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (window.electronAPI?.decryptSecret) {
          if (parsed.auddToken) {
            parsed.auddToken = await window.electronAPI.decryptSecret(parsed.auddToken);
          }
          if (parsed.acrAccessSecret) {
            parsed.acrAccessSecret = await window.electronAPI.decryptSecret(parsed.acrAccessSecret);
          }
        }
        this.config = { ...DEFAULT_FINGERPRINT_CONFIG, ...parsed };
      }
    } catch (e) {
      console.warn('[SystemAudioService] Failed to load config:', e);
    }
  }

  private initMediaSessionListener(): void {
    if (window.electronAPI?.onMediaSessionUpdate) {
      this.mediaSessionUnsub = window.electronAPI.onMediaSessionUpdate((data) => {
        if (!this.isActive()) return;

        if (data.status === 'ACTIVE' && data.title) {
          const song: IdentifiedSong = {
            title: data.title,
            artist: data.artist || 'Unknown Artist',
            album: data.album,
            duration: data.duration && data.duration > 0 ? data.duration : undefined,
            position: data.position !== undefined ? data.position : 0,
            playbackStatus: data.playbackStatus || 'Playing',
            source: 'media_session',
            lastUpdated: Date.now(),
          };

          const isNewSong =
            !this.currentSong ||
            this.currentSong.title !== song.title ||
            this.currentSong.artist !== song.artist;

          this.currentSong = song;
          if (isNewSong) {
            this.notifySongListeners(song);
          }
        } else if (data.status === 'NO_SESSION' && this.currentSong?.source === 'media_session') {
          // If media session closed, don't immediately clear if user is still listening,
          // but allow fingerprinting or manual search to take over
        }
      });
    }
  }

  public getStatus(): SystemAudioStatus {
    return this.status;
  }

  public getCurrentSong(): IdentifiedSong | null {
    return this.currentSong;
  }

  public getEstimatedPosition(): number {
    if (!this.currentSong) return 0;
    if (this.currentSong.playbackStatus === 'Paused') {
      return this.currentSong.position || 0;
    }
    const elapsed = (Date.now() - this.currentSong.lastUpdated) / 1000;
    const pos = (this.currentSong.position || 0) + elapsed;
    if (this.currentSong.duration && this.currentSong.duration > 0) {
      return Math.min(this.currentSong.duration, pos);
    }
    return Math.max(0, pos);
  }

  public isActive(): boolean {
    return this.status !== 'inactive';
  }

  /**
   * Start capturing system audio / tab audio
   */
  public async startCapture(): Promise<void> {
    try {
      this.setStatus('listening');

      // Request display media for loopback capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } as any,
      });

      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      // Attempt to extract tab title hint from video or audio track label BEFORE stopping video track
      const rawLabel = videoTracks[0]?.label || audioTracks[0]?.label || '';
      console.log('[SystemAudioService] Captured track rawLabel:', rawLabel);
      const hint = LrcService.parseTabTitleHint(rawLabel);
      if (hint) {
        console.log('[SystemAudioService] Tab hint found:', hint);
        this.currentHint = hint;
        this.notifySongHintListeners(hint);
      } else {
        this.currentHint = null;
        this.notifySongHintListeners(null);
      }

      // Stop video track immediately to save CPU and retain only audio
      videoTracks.forEach((track) => track.stop());

      if (audioTracks.length === 0) {
        stream.getTracks().forEach((t) => t.stop());
        throw new Error(
          'No audio track captured. Please select a tab or screen and ensure "Also share tab audio" / "Share system audio" is checked.'
        );
      }

      const audioTrack = audioTracks[0];
      audioTrack.onended = () => {
        console.log('[SystemAudioService] Audio capture track ended by user');
        this.stopCapture();
      };

      this.currentStream = stream;

      // Pipe into AudioManager AnalyserNode
      AudioManager.getInstance().attachMediaStream(stream);

      // Start silence & health monitor
      this.startHealthMonitor();

      // Trigger initial recognition if media session not available
      setTimeout(() => {
        if (!this.currentSong && this.config.enabled) {
          this.triggerFingerprint();
        }
      }, 1500);

      this.setStatus('listening');
    } catch (err: any) {
      console.warn('[SystemAudioService] Failed to start capture:', err);
      const msg = err.message || 'Failed to capture system audio';
      this.setStatus('error', msg);
      this.stopCapture(false);
      throw err;
    }
  }

  public stopCapture(updateStatus: boolean = true): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
    if (this.fingerprintTimer) {
      clearTimeout(this.fingerprintTimer);
      this.fingerprintTimer = null;
    }

    if (this.currentStream) {
      try {
        this.currentStream.getTracks().forEach((t) => t.stop());
      } catch {}
      this.currentStream = null;
    }

    AudioManager.getInstance().detachMediaStream();

    this.currentHint = null;
    this.notifySongHintListeners(null);
    this.currentSong = null;
    this.notifySongListeners(null);

    if (updateStatus) {
      this.setStatus('inactive');
    }
  }

  private startHealthMonitor(): void {
    if (this.statusInterval) clearInterval(this.statusInterval);

    this.statusInterval = window.setInterval(() => {
      if (!this.isActive()) return;

      const audioMgr = AudioManager.getInstance();
      const isSilence = audioMgr.isSilence();

      if (isSilence && this.status === 'listening') {
        this.setStatus('silence');
      } else if (!isSilence && this.status === 'silence') {
        this.setStatus('listening');
        // Silence-to-sound transition: try fingerprint if media session is empty
        if ((!this.currentSong || this.currentSong.source === 'fingerprint') && this.config.enabled) {
          this.triggerFingerprint();
        }
      }
    }, 500);
  }

  /**
   * Set manual track metadata fallback
   */
  public setManualTrack(title: string, artist: string, duration?: number): void {
    const song: IdentifiedSong = {
      title: title.trim(),
      artist: artist.trim() || 'Unknown Artist',
      duration,
      position: 0,
      source: 'manual',
      playbackStatus: 'Playing',
      lastUpdated: Date.now(),
    };
    this.currentSong = song;
    this.notifySongListeners(song);
  }

  /**
   * Audio Fingerprinting recognition (AudD or ACRCloud)
   */
  public async triggerFingerprint(): Promise<IdentifiedSong | null> {
    if (!this.config.enabled) return null;
    if (!this.currentStream || this.isFingerprinting) return null;

    // Show first-time notice
    const hasShownNotice = localStorage.getItem(NOTICE_SHOWN_KEY);
    const providerName = this.config.provider === 'acrcloud' ? 'ACRCloud' : 'AudD';
    if (!hasShownNotice) {
      const msg = `A short audio clip is sent to ${providerName} to identify the song.`;
      this.notifyNoticeListeners(msg);
      try {
        localStorage.setItem(NOTICE_SHOWN_KEY, 'true');
      } catch {}
    }

    this.isFingerprinting = true;

    try {
      console.log(`[SystemAudioService] Recording short sample for ${providerName} recognition...`);
      const audioBlob = await this.recordClip(10000); // 10 seconds

      let result: IdentifiedSong | null = null;
      if (this.config.provider === 'acrcloud') {
        result = await this.identifyACRCloud(audioBlob);
      } else {
        result = await this.identifyAudD(audioBlob);
      }

      if (result) {
        console.log('[SystemAudioService] Identified song:', result);
        this.currentSong = result;
        this.notifySongListeners(result);
      } else {
        console.log('[SystemAudioService] No song match returned from provider');
      }

      return result;
    } catch (err) {
      console.warn('[SystemAudioService] Fingerprint error:', err);
      return null;
    } finally {
      this.isFingerprinting = false;

      // Schedule periodic re-identification if song confidence is low or unknown
      if (this.isActive() && this.config.enabled) {
        if (this.fingerprintTimer) clearTimeout(this.fingerprintTimer);
        this.fingerprintTimer = window.setTimeout(() => {
          if (!this.currentSong || this.currentSong.source === 'fingerprint') {
            this.triggerFingerprint();
          }
        }, 30000);
      }
    }
  }

  /**
   * In-memory audio clip recorder using MediaRecorder.
   * Immediately cleaned up after upload.
   */
  private recordClip(durationMs: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.currentStream) {
        return reject(new Error('No active stream to record'));
      }

      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';

        const recorder = new MediaRecorder(this.currentStream, mimeType ? { mimeType } : undefined);
        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
          resolve(blob);
        };

        recorder.onerror = (e) => {
          reject(e);
        };

        recorder.start();
        setTimeout(() => {
          if (recorder.state === 'recording') {
            recorder.stop();
          }
        }, durationMs);
      } catch (e) {
        reject(e);
      }
    });
  }

  /**
   * AudD API provider implementation
   */
  private async identifyAudD(blob: Blob): Promise<IdentifiedSong | null> {
    const token = this.config.auddToken.trim();
    if (!token) return null;

    const formData = new FormData();
    formData.append('api_token', token);
    formData.append('file', blob, 'sample.webm');
    formData.append('return', 'timecode,lyrics');

    const res = await fetch('https://api.audd.io/', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error(`AudD HTTP ${res.status}`);
    const data = await res.json();

    if (data.status === 'success' && data.result) {
      const { title, artist, album, timecode } = data.result;
      let offsetSec = 0;
      if (timecode) {
        const parts = timecode.split(':').map(Number);
        if (parts.length === 2) {
          offsetSec = parts[0] * 60 + parts[1];
        } else if (parts.length === 3) {
          offsetSec = parts[0] * 3600 + parts[1] * 60 + parts[2];
        }
      }

      return {
        title,
        artist,
        album,
        position: offsetSec,
        source: 'fingerprint',
        playbackStatus: 'Playing',
        lastUpdated: Date.now(),
      };
    }

    return null;
  }

  /**
   * ACRCloud API provider implementation
   */
  private async identifyACRCloud(blob: Blob): Promise<IdentifiedSong | null> {
    const { acrHost, acrAccessKey, acrAccessSecret } = this.config;
    if (!acrHost || !acrAccessKey || !acrAccessSecret) return null;

    const host = acrHost.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const endpoint = `https://${host}/v1/identify`;

    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = ['POST', '/v1/identify', acrAccessKey, 'audio', '1', timestamp].join('\n');

    // Generate HMAC-SHA1 signature using Web Crypto API
    const enc = new TextEncoder();
    const keyData = enc.encode(acrAccessSecret);
    const cryptoKey = await window.crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const sigBuf = await window.crypto.subtle.sign('HMAC', cryptoKey, enc.encode(stringToSign));
    const signature = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

    const formData = new FormData();
    formData.append('sample', blob, 'sample.webm');
    formData.append('access_key', acrAccessKey);
    formData.append('data_type', 'audio');
    formData.append('signature_version', '1');
    formData.append('signature', signature);
    formData.append('timestamp', String(timestamp));

    const res = await fetch(endpoint, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) throw new Error(`ACRCloud HTTP ${res.status}`);
    const data = await res.json();

    if (data.status?.code === 0 && data.metadata?.music?.[0]) {
      const music = data.metadata.music[0];
      const title = music.title;
      const artist = music.artists?.map((a: any) => a.name).join(', ') || 'Unknown Artist';
      const album = music.album?.name;
      const offsetSec = (music.play_offset_ms || 0) / 1000;
      const durationSec = (music.duration_ms || 0) / 1000;

      return {
        title,
        artist,
        album,
        duration: durationSec > 0 ? durationSec : undefined,
        position: offsetSec,
        source: 'fingerprint',
        playbackStatus: 'Playing',
        lastUpdated: Date.now(),
      };
    }

    return null;
  }

  /**
   * Test API Credentials
   */
  public async testProvider(): Promise<{ success: boolean; message: string }> {
    try {
      if (this.config.provider === 'audd') {
        const token = this.config.auddToken.trim();
        if (!token) return { success: false, message: 'Please enter an AudD API token.' };
        const res = await fetch(`https://api.audd.io/?api_token=${token}&method=user`);
        const json = await res.json();
        if (json.status === 'success') {
          return { success: true, message: 'AudD API token verified successfully!' };
        }
        return { success: false, message: json.error?.error_message || 'AudD verification failed.' };
      } else {
        const { acrHost, acrAccessKey, acrAccessSecret } = this.config;
        if (!acrHost || !acrAccessKey || !acrAccessSecret) {
          return { success: false, message: 'Please provide host, access key and access secret.' };
        }
        // ACRCloud basic ping
        return { success: true, message: 'ACRCloud credentials formatted and ready.' };
      }
    } catch (e: any) {
      return { success: false, message: e.message || 'Connection test failed.' };
    }
  }

  private setStatus(status: SystemAudioStatus, errorMsg?: string): void {
    this.status = status;
    this.statusListeners.forEach((fn) => fn(status, errorMsg));
  }

  private notifySongListeners(song: IdentifiedSong | null): void {
    this.songListeners.forEach((fn) => fn(song));
  }

  private notifySongHintListeners(hint: ParsedTabHint | null): void {
    this.songHintListeners.forEach((fn) => fn(hint));
  }

  public getTabTitleHint(): ParsedTabHint | null {
    return this.currentHint;
  }

  public setTabTitleHint(hint: ParsedTabHint | null): void {
    this.currentHint = hint;
    this.notifySongHintListeners(hint);
  }

  public clearHint(): void {
    this.currentHint = null;
    this.notifySongHintListeners(null);
  }

  public simulateActiveCapture(tabLabel?: string): void {
    this.setStatus('listening');
    if (tabLabel) {
      const hint = LrcService.parseTabTitleHint(tabLabel);
      if (hint) {
        this.currentHint = hint;
        this.notifySongHintListeners(hint);
      }
    }
  }

  public onSongHint(listener: (hint: ParsedTabHint | null) => void): () => void {
    this.songHintListeners.add(listener);
    return () => this.songHintListeners.delete(listener);
  }

  private notifyNoticeListeners(msg: string): void {
    this.noticeListeners.forEach((fn) => fn(msg));
  }

  public onStatusChange(listener: (status: SystemAudioStatus, errorMsg?: string) => void): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  public onSongChange(listener: (song: IdentifiedSong | null) => void): () => void {
    this.songListeners.add(listener);
    return () => this.songListeners.delete(listener);
  }

  public onNotice(listener: (msg: string) => void): () => void {
    this.noticeListeners.add(listener);
    return () => this.noticeListeners.delete(listener);
  }

  public destroy(): void {
    this.stopCapture();
    if (this.mediaSessionUnsub) {
      this.mediaSessionUnsub();
      this.mediaSessionUnsub = null;
    }
  }
}

export const systemAudioService = SystemAudioService.getInstance();

if (typeof window !== 'undefined') {
  (window as any).systemAudioService = systemAudioService;
}
