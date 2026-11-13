import { describe, it, expect, beforeEach } from 'vitest';
import { AdaptiveQualityService, QUALITY_PROFILES } from '../adaptiveQuality';

describe('AdaptiveQualityService', () => {
  let service: AdaptiveQualityService;

  beforeEach(() => {
    service = new AdaptiveQualityService();
  });

  it('provides comprehensive quality profiles for all 4 tiers', () => {
    expect(QUALITY_PROFILES.high.maxComets).toBe(3);
    expect(QUALITY_PROFILES.high.meshFpsLimit).toBe(60);
    expect(QUALITY_PROFILES.medium.maxComets).toBe(2);
    expect(QUALITY_PROFILES.medium.meshFpsLimit).toBe(30);
    expect(QUALITY_PROFILES.low.maxComets).toBe(1);
    expect(QUALITY_PROFILES.low.meshFpsLimit).toBe(0);
    expect(QUALITY_PROFILES.minimal.enableComets).toBe(false);
  });

  it('respects manual user tier selection over auto', () => {
    expect(service.getEffectiveTier('high')).toBe('high');
    expect(service.getEffectiveTier('medium')).toBe('medium');
    expect(service.getEffectiveTier('low')).toBe('low');
    expect(service.getEffectiveTier('minimal')).toBe('minimal');
  });

  it('tracks rolling average frame times over 120 frames', () => {
    let now = 1000;
    for (let i = 0; i < 60; i++) {
      service.recordFrame(now);
      now += 16.6; // 60 FPS
    }
    const avg = service.getRollingAverageFrameTime();
    expect(avg).toBeCloseTo(16.6, 1);
  });

  it('drops tier when frame time stays above 20ms for 3s (hysteresis)', () => {
    service.setAutoTierForTesting('high');
    let now = 1000;

    // Simulate 5000ms of slow frames (30ms per frame, ~166 frames)
    for (let elapsed = 0; elapsed < 5000; elapsed += 30) {
      service.recordFrame(now);
      now += 30;
    }

    expect(service.getEffectiveTier('auto')).toBe('medium');
  });

  it('upgrades tier only after 15s below 10ms (hysteresis)', () => {
    service.setAutoTierForTesting('medium');
    let now = 1000;

    // Simulate 16000ms of blazing fast frames (8ms per frame, 2000 frames)
    for (let elapsed = 0; elapsed < 16000; elapsed += 8) {
      service.recordFrame(now);
      now += 8;
    }

    expect(service.getEffectiveTier('auto')).toBe('high');
  });
});
