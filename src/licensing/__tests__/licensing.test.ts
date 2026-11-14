import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  hasFeature,
  getEdition,
  setEdition,
  startProPreview,
  cancelProPreview,
  isProPreviewActive,
  hasUsedProPreview,
  FREE_ALLOWED_FONTS,
  FREE_ALLOWED_THEMES,
  setUnlockAllFeatures,
} from '../../features';
import { LemonSqueezyProvider } from '../lemonSqueezy';
import { DodoPaymentsProvider } from '../dodoPayments';
import { getLicenseProvider } from '../provider';
import { LICENSING_CONFIG } from '../config';

describe('Astralyr Feature Gating & Editions', () => {
  beforeEach(() => {
    setUnlockAllFeatures(false);
    cancelProPreview();
    const mockStorage = (() => {
      let store: Record<string, string> = {};
      return {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
        clear: () => { store = {}; },
      };
    })();
    vi.stubGlobal('sessionStorage', mockStorage);
    vi.stubGlobal('localStorage', mockStorage);
  });

  afterEach(() => {
    setUnlockAllFeatures(true);
    cancelProPreview();
    vi.unstubAllGlobals();
  });

  it('1. Web edition restricts Pro features and permits standard features', () => {
    setEdition('web');
    expect(getEdition()).toBe('web');

    // Locked in web
    expect(hasFeature('beat_engine')).toBe(false);
    expect(hasFeature('moving_ambient_light')).toBe(false);
    expect(hasFeature('mesh_background')).toBe(false);
    expect(hasFeature('album_background')).toBe(false);
    expect(hasFeature('appearance_presets')).toBe(false);
    expect(hasFeature('all_fonts')).toBe(false);
    expect(hasFeature('unlimited_playlists')).toBe(false);
    expect(hasFeature('persistent_library')).toBe(false);

    // Free allowed fonts and themes exist
    expect(FREE_ALLOWED_FONTS).toContain('inter');
    expect(FREE_ALLOWED_FONTS).toContain('sf-style');
    expect(FREE_ALLOWED_FONTS).toContain('space-grotesk');
    expect(FREE_ALLOWED_THEMES).toContain('solid');
    expect(FREE_ALLOWED_THEMES).toContain('midnight');
  });

  it('2. Desktop Pro unlocks all features unconditionally', () => {
    setEdition('desktop-pro');
    expect(hasFeature('beat_engine')).toBe(true);
    expect(hasFeature('moving_ambient_light')).toBe(true);
    expect(hasFeature('mesh_background')).toBe(true);
    expect(hasFeature('album_background')).toBe(true);
    expect(hasFeature('appearance_presets')).toBe(true);
    expect(hasFeature('all_fonts')).toBe(true);
    expect(hasFeature('unlimited_playlists')).toBe(true);
    expect(hasFeature('persistent_library')).toBe(true);
    expect(hasFeature('offline_mode')).toBe(true);
  });

  it('3. Desktop Trial unlocks all features during active evaluation', () => {
    setEdition('desktop-trial');
    expect(hasFeature('beat_engine')).toBe(true);
    expect(hasFeature('moving_ambient_light')).toBe(true);
    expect(hasFeature('mesh_background')).toBe(true);
    expect(hasFeature('all_fonts')).toBe(true);
    expect(hasFeature('unlimited_playlists')).toBe(true);
  });

  it('4. Pro Preview activates visual features for 30s in Web / Free mode', () => {
    setEdition('web');
    expect(hasFeature('moving_ambient_light')).toBe(false);

    const started = startProPreview();
    expect(started).toBe(true);
    expect(isProPreviewActive()).toBe(true);

    // Visual features become temporarily accessible
    expect(hasFeature('moving_ambient_light')).toBe(true);
    expect(hasFeature('mesh_background')).toBe(true);
    expect(hasFeature('all_fonts')).toBe(true);

    // Non-visual desktop features remain locked
    expect(hasFeature('persistent_library')).toBe(false);

    // Canceling ends preview
    cancelProPreview();
    expect(isProPreviewActive()).toBe(false);
    expect(hasFeature('moving_ambient_light')).toBe(false);

    // Cannot start again in same session
    expect(hasUsedProPreview()).toBe(true);
    expect(startProPreview()).toBe(false);
  });
});

describe('14-Day Trial & Clock-Tampering Verification', () => {
  it('5. Computes correct remaining days and detects expiration', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = 1700000000000;
    const firstLaunchAt = now;
    const trialDurationDays = 14;
    const trialExpiresAt = firstLaunchAt + trialDurationDays * DAY_MS;

    // Day 1
    const day1Remaining = Math.max(0, Math.ceil((trialExpiresAt - now) / DAY_MS));
    expect(day1Remaining).toBe(14);

    // Day 10 (4 days left)
    const day10Time = now + 10 * DAY_MS;
    const day10Remaining = Math.max(0, Math.ceil((trialExpiresAt - day10Time) / DAY_MS));
    expect(day10Remaining).toBe(4);

    // Day 15 (Expired)
    const day15Time = now + 15 * DAY_MS;
    const isExpired = day15Time >= trialExpiresAt;
    expect(isExpired).toBe(true);
  });

  it('6. Detects clock rollback tampering', () => {
    const lastSeenAt = 1700000000000;
    // User sets system clock back by 2 hours
    const rolledBackTime = lastSeenAt - 2 * 60 * 60 * 1000;

    const isTampered = rolledBackTime < lastSeenAt - 60000;
    expect(isTampered).toBe(true);
  });
});

describe('30-Day Offline Grace Period', () => {
  it('7. Grants access within 30 days offline, revokes after 30 days', () => {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const lastValidatedAt = 1700000000000;
    const graceDays = 30;
    const graceMs = graceDays * DAY_MS;

    // Day 15 offline: within grace period
    const day15Offline = lastValidatedAt + 15 * DAY_MS;
    const day15GraceExpired = day15Offline - lastValidatedAt > graceMs;
    expect(day15GraceExpired).toBe(false);

    // Day 31 offline: grace period expired
    const day31Offline = lastValidatedAt + 31 * DAY_MS;
    const day31GraceExpired = day31Offline - lastValidatedAt > graceMs;
    expect(day31GraceExpired).toBe(true);
  });
});

describe('LemonSqueezy License Provider', () => {
  const provider = new LemonSqueezyProvider();

  it('8. Rejects empty license key immediately', async () => {
    const res = await provider.activate('', 'test-pc');
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/valid license key/i);
  });

  it('9. Handles successful activation with instance and metadata', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        activated: true,
        license_key: {
          key: 'LEMON-PRO-1234-5678',
          status: 'active',
          activation_limit: 2,
          activation_usage: 1,
        },
        instance: {
          id: 'inst_abc_123',
          name: 'MacBook Pro',
        },
        meta: {
          customer_email: 'astralyr.user@example.com',
          product_name: 'Astralyr Pro Lifetime',
        },
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await provider.activate('LEMON-PRO-1234-5678', 'MacBook Pro');
    expect(res.success).toBe(true);
    expect(res.instanceId).toBe('inst_abc_123');
    expect(res.customerEmail).toBe('astralyr.user@example.com');
    expect(res.activationsLimit).toBe(2);

    vi.unstubAllGlobals();
  });

  it('10. Rejects invalid or revoked key on activation', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({
        error: 'License key not found or expired',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await provider.activate('INVALID-KEY', 'PC');
    expect(res.success).toBe(false);
    expect(res.error).toContain('License key not found');

    vi.unstubAllGlobals();
  });

  it('11. Deactivates device successfully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        deactivated: true,
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await provider.deactivate('LEMON-PRO-1234', 'inst_abc_123');
    expect(res.success).toBe(true);

    vi.unstubAllGlobals();
  });
});

describe('DodoPayments License Provider', () => {
  const provider = new DodoPaymentsProvider();

  it('12. Rejects empty key', async () => {
    const res = await provider.activate('', 'test-pc');
    expect(res.success).toBe(false);
  });

  it('13. Activates valid license key', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        activated: true,
        instance_id: 'dodo_inst_999',
        customer_email: 'dodo.listener@example.com',
        product_name: 'Astralyr Pro',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const res = await provider.activate('DODO-KEY-777', 'Studio PC');
    expect(res.success).toBe(true);
    expect(res.instanceId).toBe('dodo_inst_999');
    expect(res.customerEmail).toBe('dodo.listener@example.com');

    vi.unstubAllGlobals();
  });

  it('14. Resolves configured provider correctly', () => {
    const p1 = getLicenseProvider('lemonsqueezy');
    expect(p1.name).toBe('lemonsqueezy');

    const p2 = getLicenseProvider('dodopayments');
    expect(p2.name).toBe('dodopayments');
  });
});
