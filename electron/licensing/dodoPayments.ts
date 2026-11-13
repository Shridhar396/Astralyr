import {
  LicenseProvider,
  LicenseActivationResult,
  LicenseValidationResult,
  LicenseDeactivationResult,
} from './types';
import { LICENSING_CONFIG } from './config';

export class DodoPaymentsProvider implements LicenseProvider {
  readonly name = 'dodopayments' as const;
  private readonly baseUrl: string;

  constructor(apiUrl: string = LICENSING_CONFIG.dodoPayments.apiUrl) {
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          license_key: trimmedKey,
          instance_name: instanceName,
          device_id: instanceName,
        }),
      });

      const data: any = await response.json().catch(() => null);

      if (!response.ok || !data) {
        return {
          success: false,
          error: data?.message || data?.error || `DodoPayments returned ${response.status}`,
        };
      }

      if (data.activated === true || data.status === 'active' || data.success === true) {
        return {
          success: true,
          licenseKey: trimmedKey,
          instanceId: data.instance_id || data.id || `inst_${Date.now()}`,
          customerEmail: data.customer_email || data.email,
          productName: data.product_name || 'Astralyr Pro',
          expiresAt: data.expires_at ?? null,
          activationsLimit: data.activations_limit,
          activationsCount: data.activations_count,
        };
      }

      return {
        success: false,
        error: data.message || data.error || 'Invalid license key or activation limit reached.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Network error connecting to DodoPayments: ${err.message || 'Check your internet connection'}`,
      };
    }
  }

  async validate(licenseKey: string, instanceId?: string): Promise<LicenseValidationResult> {
    const trimmedKey = licenseKey.trim();
    if (!trimmedKey) {
      return { valid: false, error: 'License key is missing' };
    }

    try {
      const response = await fetch(`${this.baseUrl}/validate`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          license_key: trimmedKey,
          instance_id: instanceId,
        }),
      });

      const data: any = await response.json().catch(() => null);

      if (!response.ok || !data) {
        return {
          valid: false,
          error: data?.message || data?.error || `Validation failed (${response.status})`,
        };
      }

      const isValid = data.valid === true || data.status === 'active';

      return {
        valid: isValid,
        error: isValid ? undefined : (data.message || data.error || 'License invalid or expired'),
        expiresAt: data.expires_at ?? null,
        customerEmail: data.customer_email,
        productName: data.product_name,
      };
    } catch (err: any) {
      return {
        valid: false,
        error: `Network error during DodoPayments validation: ${err.message}`,
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
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          license_key: trimmedKey,
          instance_id: instanceId,
        }),
      });

      const data: any = await response.json().catch(() => null);

      if (!response.ok || !data) {
        return {
          success: false,
          error: data?.message || data?.error || `Deactivation failed (${response.status})`,
        };
      }

      if (data.deactivated === true || data.success === true) {
        return { success: true };
      }

      return {
        success: false,
        error: data.message || data.error || 'Could not deactivate instance on DodoPayments.',
      };
    } catch (err: any) {
      return {
        success: false,
        error: `Network error during DodoPayments deactivation: ${err.message}`,
      };
    }
  }
}
