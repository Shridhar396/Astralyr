import { RadioStation, PlaybackState, AudioVisualizerData } from '../types/radio';
import { BeatEngine, BeatState } from '../audio/beat';

export class AudioManager {
  private static instance: AudioManager | null = null;
  private audio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;

  private playbackState: PlaybackState = 'idle';
  private volume: number = 0.9;
  private isMuted: boolean = false;

  private readonly FFT_SIZE = 1024;
  private readonly BIN_COUNT = 512;
  private readonly LEGACY_BIN_COUNT = 64;
  private frequencyArray: Uint8Array = new Uint8Array(512);
  private legacyFrequencyArray: Uint8Array = new Uint8Array(64);
  private timeDomainArray: Uint8Array = new Uint8Array(1024);
  private legacyTimeDomainArray: Uint8Array = new Uint8Array(128);

  private beatEngine: BeatEngine = new BeatEngine({ sampleRate: 44100, fftSize: 1024, sensitivity: 65 });

  private simulatedTime: number = 0;
  private lastTimeUpdate: number = performance.now();

  private stateListeners: Set<(state: PlaybackState) => void> = new Set();
  private errorListeners: Set<(err: string) => void> = new Set();

  private constructor() {}

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  public init(): void {
    if (this.audio) return;

    this.audio = new Audio();
    this.audio.preload = 'none';

    this.audio.addEventListener('playing', () => {
      console.log('[AudioManager] Audio is now actively playing');
      this.setPlaybackState('playing');
    });

    this.audio.addEventListener('waiting', () => {
      this.setPlaybackState('connecting');
    });

    this.audio.addEventListener('pause', () => {
      if (this.playbackState !== 'connecting') {
        this.setPlaybackState('paused');
      }
    });

    this.audio.addEventListener('timeupdate', () => {
      if (this.audio && !this.audio.paused && !isNaN(this.audio.currentTime)) {
        this.simulatedTime = this.audio.currentTime;
      }
    });

    this.audio.addEventListener('error', (e: Event) => {
      const err = this.audio?.error;
      console.warn('[AudioManager] Audio element error:', err || e);
      if (this.audio?.src && this.audio.src !== '') {
        this.setPlaybackState('error');
      }
    });
  }

  public async resumeAudioContext(): Promise<void> {
    this.setupAudioNodes();
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
          console.log('[AudioManager] AudioContext resumed successfully. State:', this.audioContext.state);
        } catch (err) {
          console.warn('[AudioManager] Error resuming AudioContext:', err);
        }
      }
    }
  }

  private setupAudioNodes(): void {
    if (!this.audio) this.init();
    if (this.audioContext && this.sourceNode) return;

    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtx();

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = this.FFT_SIZE;
      this.analyser.smoothingTimeConstant = 0.8;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;

      // Update beat engine sample rate if different
      if (this.audioContext.sampleRate) {
        this.beatEngine.sampleRate = this.audioContext.sampleRate;
      }

      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.audioContext.currentTime);

      if (this.audio) {
        this.sourceNode = this.audioContext.createMediaElementSource(this.audio);
        // Connect complete audio graph: source -> analyser -> gain -> speakers
        this.sourceNode.connect(this.analyser);
        this.analyser.connect(this.gainNode);
        this.gainNode.connect(this.audioContext.destination);

        console.log('[AudioManager] Web Audio graph connected: source -> analyser -> gain -> destination');
      }
    } catch (err) {
      console.error('[AudioManager] setupAudioNodes error:', err);
    }
  }

  public async playUrl(url: string, resetTime: boolean = true, isLocal: boolean = false): Promise<void> {
    this.init();
    await this.resumeAudioContext();

    if (!this.audio) return;

    this.setPlaybackState('connecting');

    if (resetTime) {
      this.simulatedTime = 0;
    }
    this.lastTimeUpdate = performance.now();

    this.audio.pause();

    // Resolve relative root paths with BASE_URL if applicable
    if (url.startsWith('/') && typeof import.meta !== 'undefined' && import.meta.env?.BASE_URL) {
      const base = import.meta.env.BASE_URL;
      if (!url.startsWith(base)) {
        url = (base + url.replace(/^\/+/, '')).replace('//', '/');
      }
    }

    // For blob: and local files, avoid setting crossOrigin to prevent CORS rejection on local URLs
    if (isLocal || url.startsWith('blob:') || url.startsWith('/') || url.startsWith('data:')) {
      this.audio.removeAttribute('crossorigin');
    } else {
      this.audio.crossOrigin = 'anonymous';
    }

    this.audio.src = url;
    this.audio.volume = this.volume;
    this.audio.muted = this.isMuted;
    this.audio.load();

    try {
      await this.audio.play();
      this.setPlaybackState('playing');
      console.log('[AudioManager] Successfully started playback for:', url);
    } catch (err) {
      console.warn('[AudioManager] audio.play() promise rejected:', err);
      // Try resuming AudioContext and retrying once
      await this.resumeAudioContext();
      try {
        await this.audio.play();
        this.setPlaybackState('playing');
      } catch (retryErr) {
        console.error('[AudioManager] Play retry failed:', retryErr);
        this.setPlaybackState('paused');
      }
    }
  }

  public async togglePlay(fallbackUrl?: string): Promise<void> {
    this.init();
    await this.resumeAudioContext();

    if (!this.audio) return;

    // If audio has no source yet, load fallbackUrl
    if (!this.audio.src || this.audio.src === '' || this.audio.src === window.location.href) {
      if (fallbackUrl) {
        await this.playUrl(fallbackUrl);
        return;
      }
    }

    if (this.playbackState === 'playing' && !this.audio.paused) {
      this.audio.pause();
      this.setPlaybackState('paused');
    } else {
      try {
        this.setPlaybackState('connecting');
        await this.audio.play();
        this.setPlaybackState('playing');
      } catch (err) {
        console.warn('[AudioManager] Failed to resume in togglePlay:', err);
        if (fallbackUrl) {
          await this.playUrl(fallbackUrl);
        } else {
          this.setPlaybackState('paused');
        }
      }
    }
  }

  public pause(): void {
    if (this.audio) {
      this.audio.pause();
    }
    this.setPlaybackState('paused');
  }

  public seek(seconds: number): void {
    if (this.audio && !isNaN(this.audio.duration) && isFinite(this.audio.duration)) {
      this.audio.currentTime = seconds;
    }
    this.simulatedTime = seconds;
    this.lastTimeUpdate = performance.now();
  }

  public getCurrentTime(): number {
    if (this.audio && this.audio.currentTime > 0 && isFinite(this.audio.currentTime)) {
      return this.audio.currentTime;
    }

    const now = performance.now();
    if (this.playbackState === 'playing') {
      const dt = (now - this.lastTimeUpdate) / 1000;
      this.simulatedTime += dt;
    }
    this.lastTimeUpdate = now;
    return this.simulatedTime;
  }

  /**
   * Returns current audio playback time compensated for audio output hardware latency
   * (AudioContext.outputLatency and baseLatency) for millisecond-accurate lyric synchronization.
   */
  public getAcousticTime(): number {
    let time = this.getCurrentTime();
    if (this.audioContext && this.playbackState === 'playing') {
      const outputLatency = (this.audioContext as any).outputLatency || 0;
      const baseLatency = (this.audioContext as any).baseLatency || 0;
      const totalLatency = outputLatency + baseLatency;
      if (totalLatency > 0 && totalLatency < 0.5) {
        time = Math.max(0, time - totalLatency);
      }
    }
    return time;
  }

  public getDuration(): number {
    if (this.audio && !isNaN(this.audio.duration) && isFinite(this.audio.duration) && this.audio.duration > 0) {
      return this.audio.duration;
    }
    return 40;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.gainNode && this.audioContext && !this.isMuted) {
      this.gainNode.gain.setValueAtTime(this.volume, this.audioContext.currentTime);
    }
    if (this.audio) {
      this.audio.volume = this.volume;
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.gainNode && this.audioContext) {
      const target = this.isMuted ? 0 : this.volume;
      this.gainNode.gain.setValueAtTime(target, this.audioContext.currentTime);
    }
    if (this.audio) {
      this.audio.muted = this.isMuted;
    }
    return this.isMuted;
  }

  public getVolume(): number {
    return this.volume;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getPlaybackState(): PlaybackState {
    return this.playbackState;
  }

  public getBeatEngine(): BeatEngine {
    return this.beatEngine;
  }

  public getBeatState(): BeatState {
    return this.beatEngine.getState();
  }

  public getAnalyserNode(): AnalyserNode | null {
    return this.analyser;
  }

  public getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  public getVisualizerData(sensitivity: number = 65): AudioVisualizerData {
    const isPlaying = this.analyser && this.playbackState === 'playing';

    if (isPlaying) {
      (this.analyser as unknown as { getByteFrequencyData: (arr: Uint8Array) => void }).getByteFrequencyData(
        this.frequencyArray
      );
      (this.analyser as unknown as { getByteTimeDomainData: (arr: Uint8Array) => void }).getByteTimeDomainData(
        this.timeDomainArray
      );

      // Downsample 512 bins to 64 bins for legacy visualizer components
      const step = this.BIN_COUNT / this.LEGACY_BIN_COUNT; // 8
      for (let i = 0; i < this.LEGACY_BIN_COUNT; i++) {
        let sum = 0;
        const start = i * step;
        for (let j = 0; j < step; j++) {
          sum += this.frequencyArray[start + j];
        }
        this.legacyFrequencyArray[i] = Math.round(sum / step);
      }

      const tdStep = this.FFT_SIZE / 128; // 8
      for (let i = 0; i < 128; i++) {
        this.legacyTimeDomainArray[i] = this.timeDomainArray[i * tdStep];
      }
    } else {
      const now = performance.now() * 0.002;
      for (let i = 0; i < this.BIN_COUNT; i++) {
        this.frequencyArray[i] = 0;
      }
      for (let i = 0; i < this.LEGACY_BIN_COUNT; i++) {
        const wave = Math.sin(now + i * 0.15) * 22 + Math.cos(now * 0.7 - i * 0.08) * 16 + 25;
        this.legacyFrequencyArray[i] = Math.max(0, Math.min(255, wave));
        this.legacyTimeDomainArray[i] = 128 + Math.sin(now * 2 + i * 0.1) * 8;
      }
    }

    // Process BeatEngine
    this.beatEngine.setSensitivity(sensitivity);
    const nowSec = performance.now() / 1000;
    const beatState = this.beatEngine.process(this.frequencyArray, nowSec);

    let totalSum = 0;
    let peakVal = 0;
    for (let i = 0; i < this.BIN_COUNT; i++) {
      const val = this.frequencyArray[i];
      totalSum += val;
      if (val > peakVal) peakVal = val;
    }
    const avgFreq = totalSum / (this.BIN_COUNT * 255);
    const peakDb = peakVal > 0 ? Math.round(20 * Math.log10(peakVal / 255)) : -90;

    return {
      frequencyData: this.legacyFrequencyArray,
      timeData: this.legacyTimeDomainArray,
      binCount: this.LEGACY_BIN_COUNT,
      averageFrequency: avgFreq,
      subBassEnergy: beatState.smoothedSubBass,
      bassEnergy: beatState.smoothedBass,
      midEnergy: beatState.smoothedMids,
      trebleEnergy: beatState.smoothedHighs,
      isBeat: beatState.isBeat,
      peakDb,
    };
  }

  private setPlaybackState(state: PlaybackState): void {
    this.playbackState = state;
    this.stateListeners.forEach((fn) => fn(state));
  }

  public onStateChange(listener: (state: PlaybackState) => void): () => void {
    this.stateListeners.add(listener);
    return () => this.stateListeners.delete(listener);
  }
}
