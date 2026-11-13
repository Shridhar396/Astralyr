/**
 * Astralyr Desktop Licensing Manager
 * Manages 14-day trial, offline Ed25519 license key verification,
 * clock-tampering detection, and background revocation checks.
 */

import { app, ipcMain } from 'electron';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import {
  StoredLicenseState,
  DesktopLicenseStatus,
  LicenseProviderName,
} from './licensing/types';
import { getLicenseProvider } from './licensing/provider';
import { LICENSING_CONFIG } from './licensing/config';
import {
  verifyOfflineLicenseKey,
  fetchOnlineRevokedList,
  REVOCATION_LIST_URL,
} from './licensing/offlineLicense';
import bundledRevoked from './licensing/revoked.json';

const SALT = 'astralyr_license_salt_v1_secure_node';
const LICENSE_FILENAME = 'license.json';
const REVOKED_CACHE_FILENAME = 'revoked_cache.json';

export class LicensingManager {
  private licenseFilePath: string;
  private revokedCachePath: string;
  private state: StoredLicenseState | null = null;
  private machineId: string = '';
  private initialized: boolean = false;
  private cachedRevokedList: string[] = [...bundledRevoked];

  constructor() {
    this.licenseFilePath = path.join(app.getPath('userData'), LICENSE_FILENAME);
    this.revokedCachePath = path.join(app.getPath('userData'), REVOKED_CACHE_FILENAME);
  }

  public async initialize(): Promise<DesktopLicenseStatus> {
    if (this.initialized && this.state) {
      return this.getStatus();
    }

    this.machineId = this.generateMachineId();
    this.loadCachedRevocationList();
    await this.loadOrCreateState();
    this.initialized = true;

    // Background revocation / validation check if licensed
    if (this.state && this.state.edition === 'desktop-pro' && this.state.licenseKey) {
      this.revalidateInBackground().catch((err) => {
        console.warn('[Licensing] Background revalidation error:', err);
      });
    }

    return this.getStatus();
  }

  private generateMachineId(): string {
    const raw = `${os.hostname()}-${os.platform()}-${os.arch()}-${app.getPath('userData')}`;
    return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 16);
  }

  private getInstanceName(): string {
    return `${os.hostname()} (${os.platform()})`;
  }

  private computeSignature(firstLaunchAt: number, trialExpiresAt: number): string {
    return crypto
      .createHmac('sha256', SALT)
      .update(`${firstLaunchAt}:${trialExpiresAt}:${this.machineId}`)
      .digest('hex');
  }

  private loadCachedRevocationList(): void {
    try {
      if (fs.existsSync(this.revokedCachePath)) {
        const raw = fs.readFileSync(this.revokedCachePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const merged = new Set([...bundledRevoked, ...parsed]);
          this.cachedRevokedList = Array.from(merged);
        }
      }
    } catch {
      this.cachedRevokedList = [...bundledRevoked];
    }
  }

  private async loadOrCreateState(): Promise<void> {
    const now = Date.now();
    const trialMs = LICENSING_CONFIG.trialDurationDays * 24 * 60 * 60 * 1000;

    if (!fs.existsSync(this.licenseFilePath)) {
      // First launch: initialize 14-day trial
      const firstLaunchAt = now;
      const trialExpiresAt = firstLaunchAt + trialMs;
      const signature = this.computeSignature(firstLaunchAt, trialExpiresAt);

      this.state = {
        edition: 'desktop-trial',
        firstLaunchAt,
        trialDays: LICENSING_CONFIG.trialDurationDays,
        trialExpiresAt,
        lastSeenAt: now,
        tampered: false,
        signature,
        offlineGraceDays: LICENSING_CONFIG.offlineGraceDays,
        provider: LICENSING_CONFIG.activeProvider,
      };

      await this.saveState();
      return;
    }

    // Read existing state
    try {
      const data = fs.readFileSync(this.licenseFilePath, 'utf8');
      const loaded: StoredLicenseState = JSON.parse(data);

      // Verify signature to guard against manual editing of trial timestamp
      const expectedSig = this.computeSignature(loaded.firstLaunchAt, loaded.trialExpiresAt);
      let tampered = loaded.tampered || expectedSig !== loaded.signature;

      // Clock rollback detection: if current time is over 60s behind lastSeenAt
      if (now < (loaded.lastSeenAt || 0) - 60000) {
        tampered = true;
      }

      loaded.lastSeenAt = Math.max(loaded.lastSeenAt || 0, now);
      loaded.tampered = tampered;

      // Determine edition
      if (loaded.edition === 'desktop-pro' && loaded.licenseKey) {
        if (loaded.provider === 'offline' || loaded.licenseKey.startsWith('ASTR-')) {
          // Verify offline Ed25519 key against cached revocation list
          const offlineCheck = verifyOfflineLicenseKey(
            loaded.licenseKey,
            undefined,
            this.cachedRevokedList
          );

          if (!offlineCheck.valid) {
            console.warn('[Licensing] Offline key invalid on load:', offlineCheck.error);
            loaded.edition = 'desktop-free';
          } else {
            loaded.edition = 'desktop-pro';
            loaded.verifiedOffline = true;
            if (offlineCheck.payload) {
              loaded.customerName = loaded.customerName || offlineCheck.payload.name;
              loaded.customerEmail = loaded.customerEmail || offlineCheck.payload.email;
              loaded.licenseId = loaded.licenseId || offlineCheck.payload.id;
              loaded.licenseIssued = loaded.licenseIssued || offlineCheck.payload.issued;
            }
          }
        } else {
          // Remote provider grace period check
          const graceMs = (loaded.offlineGraceDays || LICENSING_CONFIG.offlineGraceDays) * 24 * 60 * 60 * 1000;
          const lastVal = loaded.lastValidatedAt || loaded.activatedAt || 0;
          const graceExpired = now - lastVal > graceMs;

          if (graceExpired) {
            loaded.edition = 'desktop-free';
          } else {
            loaded.edition = 'desktop-pro';
          }
        }
      } else if (loaded.edition === 'desktop-trial') {
        const isTrialActive = !tampered && now < loaded.trialExpiresAt;
        if (!isTrialActive) {
          loaded.edition = 'desktop-free';
        }
      }

      this.state = loaded;
      await this.saveState();
    } catch (err) {
      console.error('[Licensing] Error reading license file, resetting:', err);
      const firstLaunchAt = now;
      const trialExpiresAt = firstLaunchAt + trialMs;
      this.state = {
        edition: 'desktop-trial',
        firstLaunchAt,
        trialDays: LICENSING_CONFIG.trialDurationDays,
        trialExpiresAt,
        lastSeenAt: now,
        tampered: false,
        signature: this.computeSignature(firstLaunchAt, trialExpiresAt),
        offlineGraceDays: LICENSING_CONFIG.offlineGraceDays,
        provider: LICENSING_CONFIG.activeProvider,
      };
      await this.saveState();
    }
  }

  private async saveState(): Promise<void> {
    if (!this.state) return;
    try {
      const dir = path.dirname(this.licenseFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.licenseFilePath, JSON.stringify(this.state, null, 2), 'utf8');
    } catch (err) {
      console.error('[Licensing] Failed to save license state:', err);
    }
  }

  public getStatus(): DesktopLicenseStatus {
    const now = Date.now();
    const state = this.state || {
      edition: 'desktop-trial',
      firstLaunchAt: now,
      trialDays: 14,
      trialExpiresAt: now + 14 * 86400000,
      lastSeenAt: now,
      tampered: false,
      signature: '',
      offlineGraceDays: 30,
      provider: 'offline' as const,
    };

    const isTrialActive = !state.tampered && state.edition === 'desktop-trial' && now < state.trialExpiresAt;
    const trialDaysRemaining = isTrialActive
      ? Math.max(0, Math.ceil((state.trialExpiresAt - now) / (1000 * 60 * 60 * 24)))
      : 0;
    const trialExpired = !isTrialActive && (now >= state.trialExpiresAt || Boolean(state.tampered));

    let offlineDaysRemaining: number | undefined;
    if (state.edition === 'desktop-pro' && state.provider !== 'offline' && state.lastValidatedAt) {
      const graceMs = (state.offlineGraceDays || 30) * 86400000;
      const remainingMs = graceMs - (now - state.lastValidatedAt);
      offlineDaysRemaining = Math.max(0, Math.ceil(remainingMs / 86400000));
    }

    const maskedKey = state.licenseKey
      ? `${state.licenseKey.slice(0, 9)}...${state.licenseKey.slice(-6)}`
      : undefined;

    return {
      edition: state.edition,
      isTrialActive,
      trialDaysRemaining,
      trialExpired,
      isPro: state.edition === 'desktop-pro',
      licenseKeyMasked: maskedKey,
      customerName: state.customerName,
      customerEmail: state.customerEmail,
      licenseId: state.licenseId,
      licenseIssued: state.licenseIssued,
      verifiedOffline: state.verifiedOffline || state.provider === 'offline',
      instanceId: state.instanceId,
      offlineDaysRemaining,
      tampered: state.tampered,
      provider: state.provider,
    };
  }

  public async activateLicense(
    licenseKey: string,
    providerName?: LicenseProviderName
  ): Promise<{ success: boolean; error?: string; status: DesktopLicenseStatus }> {
    const trimmed = licenseKey.trim();
    if (!trimmed) {
      return { success: false, error: 'Please enter a valid license key.', status: this.getStatus() };
    }

    // Check if offline license format or provider is offline
    const isOfflineFormat = trimmed.toUpperCase().startsWith('ASTR-') || providerName === 'offline';

    if (isOfflineFormat || (!providerName && LICENSING_CONFIG.activeProvider === 'offline')) {
      const result = verifyOfflineLicenseKey(trimmed, undefined, this.cachedRevokedList);

      if (!result.valid || !result.payload) {
        return {
          success: false,
          error: result.error || 'Invalid license key.',
          status: this.getStatus(),
        };
      }

      const now = Date.now();
      if (this.state) {
        this.state.edition = 'desktop-pro';
        this.state.licenseKey = trimmed;
        this.state.customerName = result.payload.name;
        this.state.customerEmail = result.payload.email;
        this.state.licenseId = result.payload.id;
        this.state.licenseIssued = result.payload.issued;
        this.state.verifiedOffline = true;
        this.state.tampered = false;
        this.state.activatedAt = now;
        this.state.lastValidatedAt = now;
        this.state.provider = 'offline';
        await this.saveState();
      }

      return {
        success: true,
        status: this.getStatus(),
      };
    }

    // Fallback to remote provider if specified
    const provider = getLicenseProvider(providerName || this.state?.provider || 'lemonsqueezy');
    const instanceName = this.getInstanceName();

    try {
      const result = await provider.activate(trimmed, instanceName);
      if (!result.success || !result.instanceId) {
        return {
          success: false,
          error: result.error || 'Failed to activate license',
          status: this.getStatus(),
        };
      }

      const now = Date.now();
      if (this.state) {
        this.state.edition = 'desktop-pro';
        this.state.licenseKey = trimmed;
        this.state.instanceId = result.instanceId;
        this.state.customerEmail = result.customerEmail;
        this.state.activatedAt = now;
        this.state.lastValidatedAt = now;
        this.state.provider = provider.name;
        await this.saveState();
      }

      return {
        success: true,
        status: this.getStatus(),
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Activation failed: ${err.message}`,
        status: this.getStatus(),
      };
    }
  }

  public async deactivateLicense(): Promise<{ success: boolean; error?: string; status: DesktopLicenseStatus }> {
    if (!this.state || !this.state.licenseKey) {
      return { success: false, error: 'No active license to deactivate', status: this.getStatus() };
    }

    if (this.state.provider === 'offline' || !this.state.instanceId) {
      this.state.edition = 'desktop-free';
      delete this.state.licenseKey;
      delete this.state.customerName;
      delete this.state.customerEmail;
      delete this.state.licenseId;
      delete this.state.licenseIssued;
      delete this.state.verifiedOffline;
      delete this.state.activatedAt;
      delete this.state.lastValidatedAt;
      await this.saveState();

      return {
        success: true,
        status: this.getStatus(),
      };
    }

    const provider = getLicenseProvider(this.state.provider);
    const key = this.state.licenseKey;
    const instanceId = this.state.instanceId;

    try {
      const result = await provider.deactivate(key, instanceId);
      this.state.edition = 'desktop-free';
      delete this.state.licenseKey;
      delete this.state.instanceId;
      delete this.state.customerEmail;
      delete this.state.activatedAt;
      delete this.state.lastValidatedAt;
      await this.saveState();

      return {
        success: result.success,
        error: result.error,
        status: this.getStatus(),
      };
    } catch (err: any) {
      this.state.edition = 'desktop-free';
      delete this.state.licenseKey;
      delete this.state.instanceId;
      await this.saveState();

      return {
        success: false,
        error: `Deactivated locally, but server notification failed: ${err.message}`,
        status: this.getStatus(),
      };
    }
  }

  public async continueFreeMode(): Promise<DesktopLicenseStatus> {
    if (this.state) {
      this.state.edition = 'desktop-free';
      await this.saveState();
    }
    return this.getStatus();
  }

  private async revalidateInBackground(): Promise<void> {
    if (!this.state || !this.state.licenseKey || this.state.edition !== 'desktop-pro') {
      return;
    }

    if (this.state.provider === 'offline' || this.state.licenseKey.startsWith('ASTR-')) {
      // Check online revocation list at most once per 24 hours
      const now = Date.now();
      const lastCheck = this.state.lastValidatedAt || 0;
      if (now - lastCheck > 24 * 60 * 60 * 1000) {
        try {
          const freshRevoked = await fetchOnlineRevokedList(REVOCATION_LIST_URL, 2500);
          if (freshRevoked && Array.isArray(freshRevoked)) {
            const merged = Array.from(new Set([...this.cachedRevokedList, ...freshRevoked]));
            this.cachedRevokedList = merged;
            fs.writeFileSync(this.revokedCachePath, JSON.stringify(merged, null, 2), 'utf8');

            if (this.state.licenseId && merged.includes(this.state.licenseId)) {
              console.warn('[Licensing] Active license was revoked in updated list.');
              this.state.edition = 'desktop-free';
              await this.saveState();
              return;
            }
          }
          this.state.lastValidatedAt = now;
          await this.saveState();
        } catch {
          // Safe offline fallback: silent continuation
        }
      }
      return;
    }

    try {
      const provider = getLicenseProvider(this.state.provider);
      const res = await provider.validate(this.state.licenseKey, this.state.instanceId);

      if (res.valid) {
        this.state.lastValidatedAt = Date.now();
        if (res.customerEmail) this.state.customerEmail = res.customerEmail;
        await this.saveState();
      } else {
        console.warn('[Licensing] Background validation failed:', res.error);
        this.state.edition = 'desktop-free';
        await this.saveState();
      }
    } catch {
      console.log('[Licensing] Background validation offline, continuing grace period');
    }
  }

  public registerIpcHandlers(): void {
    ipcMain.handle('license:get-status', async () => {
      await this.initialize();
      return this.getStatus();
    });

    ipcMain.handle('license:activate', async (_event, licenseKey: string, providerName?: LicenseProviderName) => {
      await this.initialize();
      return this.activateLicense(licenseKey, providerName);
    });

    ipcMain.handle('license:deactivate', async () => {
      await this.initialize();
      return this.deactivateLicense();
    });

    ipcMain.handle('license:continue-free', async () => {
      await this.initialize();
      return this.continueFreeMode();
    });
  }
}

export const licensingManager = new LicensingManager();
