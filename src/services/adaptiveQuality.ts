import { VisualQuality } from './appearanceConfig';

export type QualityTier = 'high' | 'medium' | 'low' | 'minimal';

export interface QualityProfile {
  tier: QualityTier;
  maxComets: number;
  maxBlobs: number;
  maxRippleRings: number;
  meshFpsLimit: number; // 60, 30, or 0 (static)
  dprScale: number; // 1.0 or 0.5
  enableComets: boolean;
  enableBlobs: boolean;
  enableRipples: boolean;
  staticBackground: boolean;
}

export const QUALITY_PROFILES: Record<QualityTier, QualityProfile> = {
  high: {
    tier: 'high',
    maxComets: 3,
    maxBlobs: 4,
    maxRippleRings: 3,
    meshFpsLimit: 60,
    dprScale: 1.0,
    enableComets: true,
    enableBlobs: true,
    enableRipples: true,
    staticBackground: false,
  },
  medium: {
    tier: 'medium',
    maxComets: 2,
    maxBlobs: 2,
    maxRippleRings: 2,
    meshFpsLimit: 30,
    dprScale: 0.5,
    enableComets: true,
    enableBlobs: true,
    enableRipples: true,
    staticBackground: false,
  },
  low: {
    tier: 'low',
    maxComets: 1,
    maxBlobs: 1,
    maxRippleRings: 1,
    meshFpsLimit: 0,
    dprScale: 0.5,
    enableComets: true,
    enableBlobs: false,
    enableRipples: true,
    staticBackground: true,
  },
  minimal: {
    tier: 'minimal',
    maxComets: 0,
    maxBlobs: 0,
    maxRippleRings: 0,
    meshFpsLimit: 0,
    dprScale: 0.5,
    enableComets: false,
    enableBlobs: false,
    enableRipples: false,
    staticBackground: true,
  },
};

const TIER_ORDER: QualityTier[] = ['minimal', 'low', 'medium', 'high'];

export class AdaptiveQualityService {
  private bufferSize = 120;
  private frameTimes = new Float32Array(120);
  private frameIndex = 0;
  private frameCount = 0;
  private lastFrameTimestamp = 0;

  private currentAutoTier: QualityTier = 'high';
  private downgradeTimeAccumulator = 0; // ms accumulated with rolling avg > 20ms
  private upgradeTimeAccumulator = 0; // ms accumulated with rolling avg < 10ms

  private listeners: Set<(tier: QualityTier) => void> = new Set();

  constructor() {
    this.initDefaultTier();
  }

  private initDefaultTier() {
    if (typeof window !== 'undefined' && typeof navigator !== 'undefined') {
      const concurrency = navigator.hardwareConcurrency || 4;
      const memory = (navigator as any).deviceMemory || 4;
      // Start on Medium when hardwareConcurrency <= 4 or deviceMemory <= 4
      if (concurrency <= 4 || memory <= 4) {
        this.currentAutoTier = 'medium';
        return;
      }
    }
    this.currentAutoTier = 'high';
  }

  public recordFrame(nowMs: number = performance.now()): void {
    if (this.lastFrameTimestamp > 0) {
      const delta = Math.max(1, Math.min(100, nowMs - this.lastFrameTimestamp));
      this.frameTimes[this.frameIndex] = delta;
      this.frameIndex = (this.frameIndex + 1) % this.bufferSize;
      if (this.frameCount < this.bufferSize) {
        this.frameCount++;
      }

      this.updateAdaptiveTier(delta);
    }
    this.lastFrameTimestamp = nowMs;
  }

  public getRollingAverageFrameTime(): number {
    if (this.frameCount === 0) return 16.6;
    let sum = 0;
    for (let i = 0; i < this.frameCount; i++) {
      sum += this.frameTimes[i];
    }
    return sum / this.frameCount;
  }

  private updateAdaptiveTier(dtMs: number): void {
    // Only adapt after at least 30 frames of data
    if (this.frameCount < 30) return;

    const avg = this.getRollingAverageFrameTime();
    const currentIdx = TIER_ORDER.indexOf(this.currentAutoTier);

    // Drop a tier if average frame time stays above 20ms for 3s (3000ms)
    if (avg > 20) {
      this.downgradeTimeAccumulator += dtMs;
      this.upgradeTimeAccumulator = 0;

      if (this.downgradeTimeAccumulator >= 3000) {
        if (currentIdx > 0) {
          this.currentAutoTier = TIER_ORDER[currentIdx - 1];
          this.notifyListeners();
        }
        this.downgradeTimeAccumulator = 0;
      }
    } else if (avg < 10) {
      // Go up only after 15s (15000ms) below 10ms (hysteresis)
      this.upgradeTimeAccumulator += dtMs;
      this.downgradeTimeAccumulator = 0;

      if (this.upgradeTimeAccumulator >= 15000) {
        if (currentIdx < TIER_ORDER.length - 1) {
          this.currentAutoTier = TIER_ORDER[currentIdx + 1];
          this.notifyListeners();
        }
        this.upgradeTimeAccumulator = 0;
      }
    } else {
      // In comfortable zone [10ms, 20ms]
      this.downgradeTimeAccumulator = Math.max(0, this.downgradeTimeAccumulator - dtMs * 0.5);
      this.upgradeTimeAccumulator = Math.max(0, this.upgradeTimeAccumulator - dtMs * 0.5);
    }
  }

  public getEffectiveTier(setting: VisualQuality = 'auto'): QualityTier {
    if (setting !== 'auto') {
      return setting;
    }
    return this.currentAutoTier;
  }

  public getProfile(setting: VisualQuality = 'auto'): QualityProfile {
    const tier = this.getEffectiveTier(setting);
    return QUALITY_PROFILES[tier];
  }

  public setAutoTierForTesting(tier: QualityTier): void {
    this.currentAutoTier = tier;
    this.notifyListeners();
  }

  public reset(): void {
    this.frameIndex = 0;
    this.frameCount = 0;
    this.lastFrameTimestamp = 0;
    this.downgradeTimeAccumulator = 0;
    this.upgradeTimeAccumulator = 0;
    this.initDefaultTier();
  }

  public subscribe(cb: (tier: QualityTier) => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentAutoTier);
      } catch (err) {
        console.error('Error in adaptive quality listener:', err);
      }
    }
  }
}

export const adaptiveQuality = new AdaptiveQualityService();

