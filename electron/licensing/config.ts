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
  activeProvider: 'offline',
  trialDurationDays: 14,
  offlineGraceDays: 30,
  maxDeviceActivations: 2,
  buyProUrl: 'https://astralyr.app/buy',
  downloadUrl: 'https://astralyr.app/download',
  lemonSqueezy: {
    apiUrl: 'https://api.lemonsqueezy.com/v1/licenses',
    storeId: 'astralyr-store',
    productId: 'astralyr-pro',
  },
  dodoPayments: {
    apiUrl: 'https://api.dodopayments.com/v1/licenses',
    productId: 'astralyr-pro',
  },
};
