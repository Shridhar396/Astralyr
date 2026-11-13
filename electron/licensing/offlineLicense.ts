/**
 * Astralyr Desktop — Cryptographic Offline License System (Electron Main)
 * Ed25519 signature verification, packaging, and revocation handling.
 */

import crypto from 'crypto';
import { ASTRALYR_PUBLIC_KEY } from './publicKey';
import bundledRevoked from './revoked.json';

export interface LicensePayload {
  v: number;       // 1
  name: string;    // Customer Name
  email: string;   // Customer Email
  plan: 'pro';     // "pro"
  issued: string;  // YYYY-MM-DD
  id: string;      // Random 8-character ID
}

export interface LicenseVerifyResult {
  valid: boolean;
  error?: string;
  payload?: LicensePayload;
}

export const REVOCATION_LIST_URL =
  'https://raw.githubusercontent.com/Shridhar396/Astralyr/main/src/licensing/revoked.json';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function bufferToBase32(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

export function base32ToBuffer(str: string): Buffer {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(bytes);
}

/**
 * Format string into grouped blocks: ASTR-XXXXX-XXXXX-...
 */
export function formatLicenseKey(base32String: string): string {
  const clean = base32String.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const chunks = clean.match(/.{1,5}/g) || [clean];
  return 'ASTR-' + chunks.join('-');
}

/**
 * Encodes and signs a license payload into an ASTR-XXXXX-XXXXX-... key string.
 */
export function generateLicenseKey(payload: LicensePayload, privateKeyPem: string): string {
  const json = JSON.stringify(payload);
  const payloadBuf = Buffer.from(json, 'utf8');
  const signature = crypto.sign(null, payloadBuf, privateKeyPem);
  const packed = Buffer.concat([signature, payloadBuf]);
  return formatLicenseKey(bufferToBase32(packed));
}

/**
 * Unpacks and verifies an Ed25519-signed license key completely offline.
 */
export function verifyOfflineLicenseKey(
  keyString: string,
  publicKeyPem: string = ASTRALYR_PUBLIC_KEY,
  revokedIds: string[] = bundledRevoked
): LicenseVerifyResult {
  if (!keyString || !keyString.trim()) {
    return { valid: false, error: 'Please enter a license key.' };
  }

  const rawKey = keyString.trim().replace(/^ASTR-?/i, '');
  let buffer: Buffer;

  try {
    buffer = base32ToBuffer(rawKey);
    if (buffer.length < 65) {
      buffer = Buffer.from(rawKey.replace(/-/g, ''), 'base64url');
    }
  } catch {
    return { valid: false, error: 'Invalid license key format.' };
  }

  if (buffer.length <= 64) {
    return { valid: false, error: 'Invalid license key format.' };
  }

  // First 64 bytes are the Ed25519 signature
  const signature = buffer.slice(0, 64);
  const payloadBytes = buffer.slice(64);

  let payload: LicensePayload;
  try {
    const jsonStr = payloadBytes.toString('utf8');
    payload = JSON.parse(jsonStr);
  } catch {
    return { valid: false, error: 'Invalid license key format.' };
  }

  if (!payload || payload.v !== 1 || !payload.id || !payload.name || payload.plan !== 'pro') {
    return { valid: false, error: 'Invalid license key format.' };
  }

  // Check revocation list
  if (revokedIds.includes(payload.id)) {
    return { valid: false, error: 'This license key has been revoked.' };
  }

  // Cryptographic Ed25519 signature verification
  try {
    const isValid = crypto.verify(
      null,
      payloadBytes,
      publicKeyPem,
      signature
    );

    if (!isValid) {
      return { valid: false, error: 'Invalid license signature.' };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: 'Invalid license signature.' };
  }
}

/**
 * Optional daily update check for revocation list from GitHub raw content.
 * Gracefully times out in 2.5s and returns null when offline.
 */
export async function fetchOnlineRevokedList(
  url: string = REVOCATION_LIST_URL,
  timeoutMs: number = 2500
): Promise<string[] | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' },
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data)) {
      return data;
    }
    return null;
  } catch {
    return null; // Safe fallback when offline
  }
}
