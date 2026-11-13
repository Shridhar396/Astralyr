import { RadioStation, PlaybackState, AudioVisualizerData } from '../types/radio';

export class AudioManager {
  private static instance: AudioManager | null = null;
  private audio: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private currentStream: MediaStream | null = null;
  private isSystemAudioActive: boolean = false;
  private lastSoundDetectedTime: number = performance.now();
  private gainNode: GainNode | null = null;

  private playbackState: PlaybackState = 'idle';
  private volume: number = 0.9;
  private isMuted: boolean = false;

  private readonly FFT_SIZE = 128;
  private readonly BIN_COUNT = 64;
  private frequencyArray: Uint8Array = new Uint8Array(64);
  private timeDomainArray: Uint8Array = new Uint8Array(128);

  private simulatedTime: number = 0;
  private lastTimeUpdate: number = performance.now();

  private energyHistory: number[] = [];
  private readonly HISTORY_SIZE = 30;
  private lastBeatTime = 0;
  private beatDecay = 0;

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
      this.analyser.smoothingTimeConstant = 0.82;
      this.analyser.minDecibels = -90;
      this.analyser.maxDecibels = -10;

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

  /**
   * Pipe external media stream (System Audio / Tab Audio loopback) directly into AnalyserNode.
   * NOTE: We intentionally DO NOT connect to audioContext.destination to avoid echoing or feedback.
   */
  public attachMediaStream(stream: MediaStream): void {
    this.setupAudioNodes();
    if (!this.audioContext || !this.analyser) return;

    // Pause internal audio playback to eliminate clash
    if (this.audio) {
      this.audio.pause();
    }

    if (this.mediaStreamSource) {
      try {
        this.mediaStreamSource.disconnect();
      } catch {}
      this.mediaStreamSource = null;
    }

    if (this.currentStream && this.currentStream !== stream) {
      try {
        this.currentStream.getTracks().forEach((t) => t.stop());
      } catch {}
    }

    this.currentStream = stream;
    this.isSystemAudioActive = true;
    this.lastSoundDetectedTime = performance.now();

    try {
      this.mediaStreamSource = this.audioContext.createMediaStreamSource(stream);
      this.mediaStreamSource.connect(this.analyser);
      this.setPlaybackState('playing');
      console.log('[AudioManager] System Audio MediaStream piped to AnalyserNode');
    } catch (err) {
      console.error('[AudioManager] Failed to attach MediaStream to analyser:', err);
    }
  }

  public detachMediaStream(): void {
    if (this.mediaStreamSource) {
      try {
        this.mediaStreamSource.disconnect();
      } catch {}
      this.mediaStreamSource = null;
    }
    if (this.currentStream) {
      try {
        this.currentStream.getTracks().forEach((t) => t.stop());
      } catch {}
      this.currentStream = null;
    }
    this.isSystemAudioActive = false;
    this.setPlaybackState('idle');
  }

  public isStreamAttached(): boolean {
    return this.isSystemAudioActive && !!this.currentStream;
  }

  public isSilence(): boolean {
    if (!this.isSystemAudioActive) return false;
    return performance.now() - this.lastSoundDetectedTime > 1800;
  }

  public getCurrentMediaStream(): MediaStream | null {
    return this.currentStream;
  }

  public async playUrl(url: string, resetTime: boolean = true, isLocal: boolean = false): Promise<void> {
    if (this.isSystemAudioActive) {
      this.detachMediaStream();
    }
    this.init();
    await this.resumeAudioContext();

    if (!this.audio) return;

    this.setPlaybackState('connecting');

    if (resetTime) {
      this.simulatedTime = 0;
    }
    this.lastTimeUpdate = performance.now();

    this.audio.pause();

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

  public getVisualizerData(sensitivity: number = 1.35): AudioVisualizerData {
    if (this.analyser && this.playbackState === 'playing') {
      (this.analyser as unknown as { getByteFrequencyData: (arr: Uint8Array) => void }).getByteFrequencyData(
        this.frequencyArray
      );
      (this.analyser as unknown as { getByteTimeDomainData: (arr: Uint8Array) => void }).getByteTimeDomainData(
        this.timeDomainArray
      );
    } else {
      const now = performance.now() * 0.002;
      for (let i = 0; i < this.BIN_COUNT; i++) {
        const wave = Math.sin(now + i * 0.15) * 22 + Math.cos(now * 0.7 - i * 0.08) * 16 + 25;
        this.frequencyArray[i] = Math.max(0, Math.min(255, wave));
        this.timeDomainArray[i] = 128 + Math.sin(now * 2 + i * 0.1) * 8;
      }
    }

    // Sub-bass energy (0–60Hz: bins 0 & 1)
    const subBassEnergy = (this.frequencyArray[0] * 0.65 + this.frequencyArray[1] * 0.35) / 255;

    // Bass energy (bins 0-6: 20Hz-220Hz)
    let bassSum = 0;
    const bassBins = Math.min(8, this.BIN_COUNT);
    for (let i = 0; i < bassBins; i++) {
      bassSum += this.frequencyArray[i];
    }
    const bassEnergy = bassSum / (bassBins * 255);

    // Mid energy
    let midSum = 0;
    const midEnd = Math.min(24, this.BIN_COUNT);
    for (let i = bassBins; i < midEnd; i++) {
      midSum += this.frequencyArray[i];
    }
    const midEnergy = midSum / ((midEnd - bassBins) * 255);

    // Treble energy
    let trebleSum = 0;
    for (let i = midEnd; i < this.BIN_COUNT; i++) {
      trebleSum += this.frequencyArray[i];
    }
    const trebleEnergy = trebleSum / ((this.BIN_COUNT - midEnd) * 255);

    // Average total & peak
    let totalSum = 0;
    let peakVal = 0;
    for (let i = 0; i < this.BIN_COUNT; i++) {
      const val = this.frequencyArray[i];
      totalSum += val;
      if (val > peakVal) peakVal = val;
    }
    const avgFreq = totalSum / (this.BIN_COUNT * 255);
    const nowMs = performance.now();

    // Track active sound vs silence for System Audio
    if (this.isSystemAudioActive) {
      if (avgFreq > 0.02 || bassEnergy > 0.04) {
        this.lastSoundDetectedTime = nowMs;
      }
    }

    // Beat Detection
    this.energyHistory.push(bassEnergy);
    if (this.energyHistory.length > this.HISTORY_SIZE) {
      this.energyHistory.shift();
    }

    const avgHistoryEnergy =
      this.energyHistory.reduce((a, b) => a + b, 0) / (this.energyHistory.length || 1);

    let isBeat = false;
    if (bassEnergy > avgHistoryEnergy * sensitivity && bassEnergy > 0.22) {
      if (nowMs - this.lastBeatTime > 260) {
        isBeat = true;
        this.lastBeatTime = nowMs;
        this.beatDecay = 1.0;
      }
    }

    this.beatDecay = Math.max(0, this.beatDecay - 0.05);
    const peakDb = peakVal > 0 ? Math.round(20 * Math.log10(peakVal / 255)) : -90;

    return {
      frequencyData: this.frequencyArray,
      timeData: this.timeDomainArray,
      binCount: this.BIN_COUNT,
      averageFrequency: avgFreq,
      subBassEnergy,
      bassEnergy,
      midEnergy,
      trebleEnergy,
      isBeat: isBeat || this.beatDecay > 0.6,
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
