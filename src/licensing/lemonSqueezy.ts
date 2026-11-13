/**
 * LemonSqueezy License API Provider
 * Uses LemonSqueezy's public License API endpoints.
 * Docs: https://docs.lemonsqueezy.com/help/licensing/license-api
 */

import {
  LicenseProvider,
  LicenseActivationResult,
  LicenseValidationResult,
  LicenseDeactivationResult,
} from './types';
import { LICENSING_CONFIG } from './config';

export class LemonSqueezyProvider implements LicenseProvider {
  readonly name = 'lemonsqueezy' as const;
  private readonly baseUrl: string;

  constructor(apiUrl: string = LICENSING_CONFIG.lemonSqueezy.apiUrl) {
    this.baseUrl = apiUrl.replace(/\/+$/, '');
  }

  async activate(licenseKey: string, instanceName: string): Promise<LicenseActivationResult> {
    const trimmedKey = licenseKey.trim();
    if (!trimmedKey) {
      return { success: false, error: 'Please enter a valid license key' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/activate`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          license_key: trimmedKey,
          instance_name: instanceName,
        }).toString(),
      });

      const data: any = await response.json().catch(() => null);

      if (!response.ok || !data) {
        const errorMsg = data?.error || `License server returned ${response.status}`;
        return { success: false, error: errorMsg };
      }

      if (data.activated === true && data.instance?.id) {
        return {
          success: true,
          licenseKey: trimmedKey,
          instanceId: data.instance.id,
          customerEmail: data.meta?.customer_email,
          productName: data.meta?.product_name || 'Astralyr Pro',
          expiresAt: data.license_key?.expires_at ?? null,
          activationsLimit: data.license_key?.activation_limit,
          activationsCount: data.license_key?.activation_usage,
        };
      }

      return {
        success: false,
        error: data.error || 'Failed to activate license. Please check your key or activation limit.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Network error connecting to LemonSqueezy: ${err.message || 'Check your internet connection'}`,
      };
    }
  }

  async validate(licenseKey: string, instanceId?: string): Promise<LicenseValidationResult> {
    const trimmedKey = licenseKey.trim();
    if (!trimmedKey) {
      return { valid: false, error: 'License key is missing' };
    }

    try {
      const params: Record<string, string> = { license_key: trimmedKey };
      if (instanceId) params.instance_id = instanceId;

      const response = await fetch(`${this.baseUrl}/validate`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(params).toString(),
      });

      const data: any = await response.json().catch(() => null);

      if (!response.ok || !data) {
        return { valid: false, error: data?.error || `Validation failed (${response.status})` };
      }

      const isValid = data.valid === true && data.license_key?.status !== 'expired' && data.license_key?.status !== 'disabled';

      return {
        valid: isValid,
        error: isValid ? undefined : (data.error || `License is ${data.license_key?.status || 'invalid'}`),
        expiresAt: data.license_key?.expires_at ?? null,
        customerEmail: data.meta?.customer_email,
        productName: data.meta?.product_name,
      };
    } catch (err: any) {
      return {
        valid: false,
        error: `Network error during validation: ${err.message}`,
      };
    }
  }

  async deactivate(licenseKey: string, instanceId: string): Promise<LicenseDeactivationResult> {
    const trimmedKey = licenseKey.trim();
    if (!trimmedKey || !instanceId) {
      return { success: false, error: 'License key and instance ID are required for deactivation' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/deactivate`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          license_key: trimmedKey,
          instance_id: instanceId,
        }).toString(),
      });

      const data: any = await response.json().catch(() => null);

      if (!response.ok || !data) {
        return { success: false, error: data?.error || `Deactivation failed (${response.status})` };
      }

      if (data.deactivated === true) {
        return { success: true };
      }

      return {
        success: false,
        error: data.error || 'Could not deactivate instance on LemonSqueezy.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Network error during deactivation: ${err.message}`,
      };
    }
  }
}
