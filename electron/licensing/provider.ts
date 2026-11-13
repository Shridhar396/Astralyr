/**
 * Astralyr License Provider Factory & Manager (Electron Main Process)
 */

import {
  LicenseProvider,
  LicenseProviderName,
  LicenseActivationResult,
  LicenseValidationResult,
  LicenseDeactivationResult,
} from './types';
import { LemonSqueezyProvider } from './lemonSqueezy';
import { DodoPaymentsProvider } from './dodoPayments';
import { LICENSING_CONFIG } from './config';
import { verifyOfflineLicenseKey } from './offlineLicense';

export * from './types';
export * from './config';
export { LemonSqueezyProvider } from './lemonSqueezy';
export { DodoPaymentsProvider } from './dodoPayments';

export class OfflineLicenseProvider implements LicenseProvider {
  readonly name = 'offline' as const;

  async activate(licenseKey: string): Promise<LicenseActivationResult> {
    const res = verifyOfflineLicenseKey(licenseKey);
    if (!res.valid || !res.payload) {
      return { success: false, error: res.error || 'Invalid offline license key' };
    }
    return {
      success: true,
      licenseKey,
      instanceId: res.payload.id,
      customerName: res.payload.name,
      customerEmail: res.payload.email,
      productName: 'Astralyr Pro Lifetime',
    };
  }

  async validate(licenseKey: string): Promise<LicenseValidationResult> {
    const res = verifyOfflineLicenseKey(licenseKey);
    if (!res.valid || !res.payload) {
      return { valid: false, error: res.error || 'Invalid offline license' };
    }
    return {
      valid: true,
      customerName: res.payload.name,
      customerEmail: res.payload.email,
      productName: 'Astralyr Pro Lifetime',
    };
  }

  async deactivate(): Promise<LicenseDeactivationResult> {
    return { success: true };
  }
}

const providers: Record<LicenseProviderName, LicenseProvider> = {
  offline: new OfflineLicenseProvider(),
  lemonsqueezy: new LemonSqueezyProvider(),
  dodopayments: new DodoPaymentsProvider(),
};

export function getLicenseProvider(providerName?: LicenseProviderName): LicenseProvider {
  const selected = providerName || LICENSING_CONFIG.activeProvider;
  const provider = providers[selected];
  if (!provider) {
    throw new Error(`Unsupported license provider: ${selected}`);
  }
  return provider;
}
