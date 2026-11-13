/**
 * Astralyr Licensing Types & Interfaces (Electron Main Process)
 */

export type LicenseProviderName = 'offline' | 'lemonsqueezy' | 'dodopayments';

export interface LicenseActivationResult {
  success: boolean;
  error?: string;
  instanceId?: string;
  licenseKey?: string;
  customerName?: string;
  customerEmail?: string;
  licenseId?: string;
  licenseIssued?: string;
  verifiedOffline?: boolean;
  productName?: string;
  expiresAt?: string | null;
  activationsLimit?: number;
  activationsCount?: number;
}

export interface LicenseValidationResult {
  valid: boolean;
  error?: string;
  expiresAt?: string | null;
  customerName?: string;
  customerEmail?: string;
  productName?: string;
}

export interface LicenseDeactivationResult {
  success: boolean;
  error?: string;
}

export interface LicenseProvider {
  readonly name: LicenseProviderName;
  activate(licenseKey: string, instanceName: string): Promise<LicenseActivationResult>;
  validate(licenseKey: string, instanceId?: string): Promise<LicenseValidationResult>;
  deactivate(licenseKey: string, instanceId: string): Promise<LicenseDeactivationResult>;
}

export interface StoredLicenseState {
  edition: 'desktop-trial' | 'desktop-pro' | 'desktop-free';
  firstLaunchAt: number;
  trialDays: number;
  trialExpiresAt: number;
  lastSeenAt: number;
  tampered?: boolean;
  signature: string;
  licenseKey?: string;
  instanceId?: string;
  customerName?: string;
  customerEmail?: string;
  licenseId?: string;
  licenseIssued?: string;
  verifiedOffline?: boolean;
  activatedAt?: number;
  lastValidatedAt?: number;
  offlineGraceDays: number;
  provider: LicenseProviderName;
}

export interface DesktopLicenseStatus {
  edition: 'desktop-trial' | 'desktop-pro' | 'desktop-free';
  isTrialActive: boolean;
  trialDaysRemaining: number;
  trialExpired: boolean;
  isPro: boolean;
  licenseKeyMasked?: string;
  customerName?: string;
  customerEmail?: string;
  licenseId?: string;
  licenseIssued?: string;
  verifiedOffline?: boolean;
  instanceId?: string;
  offlineDaysRemaining?: number;
  tampered?: boolean;
  provider: LicenseProviderName;
}
