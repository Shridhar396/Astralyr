/**
 * Astralyr Licensing Configuration
 * Public configuration for client-side license activation and validation.
 * No private merchant API secrets are stored here.
 */

import { LicenseProviderName } from './types';

export interface LicensingConfig {
  activeProvider: LicenseProviderName;
  trialDurationDays: number;
  offlineGraceDays: number;
  maxDeviceActivations: number;
  buyProUrl: string;
  downloadUrl: string;
  lemonSqueezy: {
    apiUrl: string;
    storeId?: string;
    productId?: string;
  };
  dodoPayments: {
    apiUrl: string;
    productId?: string;
  };
}

export const LICENSING_CONFIG: LicensingConfig = {
  // Select active provider: 'offline', 'lemonsqueezy' or 'dodopayments'
  activeProvider: 'offline',

  // 14-day full Pro trial from first launch
  trialDurationDays: 14,

  // 30-day offline grace period after successful validation
  offlineGraceDays: 30,

  // Maximum devices per license key (default: 2)
  maxDeviceActivations: 2,

  // Public URLs
  buyProUrl: 'https://astralyr.app/buy',
  downloadUrl: 'https://astralyr.app/download',

  // LemonSqueezy public endpoints (Uses official License API v1)
  lemonSqueezy: {
    apiUrl: 'https://api.lemonsqueezy.com/v1/licenses',
    storeId: 'astralyr-store',
    productId: 'astralyr-pro',
  },

  // DodoPayments public endpoints
  dodoPayments: {
    apiUrl: 'https://api.dodopayments.com/v1/licenses',
    productId: 'astralyr-pro',
  },
};
