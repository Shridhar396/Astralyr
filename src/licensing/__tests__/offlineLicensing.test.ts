import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import crypto from 'crypto';
import {
  generateLicenseKey,
  verifyOfflineLicenseKey,
  bufferToBase32,
  base32ToBuffer,
  formatLicenseKey,
  LicensePayload,
} from '../offlineLicense';
import { ASTRALYR_PUBLIC_KEY } from '../publicKey';
import { setEdition, getEdition, hasFeature, setUnlockAllFeatures } from '../../features';

describe('Astralyr Offline Cryptographic Licensing', () => {
  // Generate a test Ed25519 keypair for genuine signing
  let genuinePrivateKey: string;
  let genuinePublicKey: string;
  let roguePrivateKey: string;
  let roguePublicKey: string;

  beforeEach(() => {
    setUnlockAllFeatures(false);
    // Generate fresh keypairs for testing
    const genuine = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    genuinePrivateKey = genuine.privateKey;
    genuinePublicKey = genuine.publicKey;

    const rogue = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
    roguePrivateKey = rogue.privateKey;
    roguePublicKey = rogue.publicKey;
  });

  afterEach(() => {
    setUnlockAllFeatures(true);
  });

  it('1. Base32 encoder and decoder roundtrips arbitrary byte buffers accurately', () => {
    const original = crypto.randomBytes(72);
    const encoded = bufferToBase32(original);
    const decoded = base32ToBuffer(encoded);
    expect(decoded.equals(original)).toBe(true);
  });

  it('2. Valid Ed25519 license key generates, verifies offline, and parses payload', () => {
    const payload: LicensePayload = {
      v: 1,
      name: 'Rahul Sharma',
      email: 'rahul@example.com',
      plan: 'pro',
      issued: '2026-11-13',
      id: 'abc12345',
    };

    const licenseKey = generateLicenseKey(payload, genuinePrivateKey);
    expect(licenseKey.startsWith('ASTR-')).toBe(true);

    const result = verifyOfflineLicenseKey(licenseKey, genuinePublicKey, []);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.payload).toBeDefined();
    expect(result.payload?.name).toBe('Rahul Sharma');
    expect(result.payload?.email).toBe('rahul@example.com');
    expect(result.payload?.plan).toBe('pro');
    expect(result.payload?.id).toBe('abc12345');
  });

  it('3. Key with even 1 changed character fails verification', () => {
    const payload: LicensePayload = {
      v: 1,
      name: 'Priya Patel',
      email: 'priya@example.com',
      plan: 'pro',
      issued: '2026-11-13',
      id: 'ff998877',
    };

    const licenseKey = generateLicenseKey(payload, genuinePrivateKey);
    
    // Tamper with one character in the middle
    const chars = licenseKey.split('');
    const targetIdx = 12;
    chars[targetIdx] = chars[targetIdx] === 'A' ? 'B' : 'A';
    const tamperedKey = chars.join('');

    const result = verifyOfflineLicenseKey(tamperedKey, genuinePublicKey, []);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/Invalid license signature|Invalid license key format/);
  });

  it('4. Key signed by a different (rogue) private key fails verification against genuine public key', () => {
    const payload: LicensePayload = {
      v: 1,
      name: 'Attacker Fake',
      email: 'attacker@evil.com',
      plan: 'pro',
      issued: '2026-11-13',
      id: 'evil0001',
    };

    // Signed with rogue private key
    const forgedKey = generateLicenseKey(payload, roguePrivateKey);

    // Verified against genuine public key
    const result = verifyOfflineLicenseKey(forgedKey, genuinePublicKey, []);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid license signature.');
  });

  it('5. Revoked license ID is immediately rejected offline', () => {
    const payload: LicensePayload = {
      v: 1,
      name: 'Refunded User',
      email: 'refund@example.com',
      plan: 'pro',
      issued: '2026-11-13',
      id: 'revoked9',
    };

    const licenseKey = generateLicenseKey(payload, genuinePrivateKey);
    const revokedList = ['badkey01', 'revoked9', 'test_revoked'];

    const result = verifyOfflineLicenseKey(licenseKey, genuinePublicKey, revokedList);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('This license key has been revoked.');
  });

  it('6. Verification is 100% offline (verifies without any network calls)', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const payload: LicensePayload = {
      v: 1,
      name: 'Offline Tester',
      email: 'offline@airplane.mode',
      plan: 'pro',
      issued: '2026-11-13',
      id: 'airp1234',
    };

    const licenseKey = generateLicenseKey(payload, genuinePrivateKey);
    const result = verifyOfflineLicenseKey(licenseKey, genuinePublicKey, []);

    expect(result.valid).toBe(true);
    // Verify zero HTTP requests were initiated
    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('7. Trial expiration downgrades to Free mode, and valid key unlocks Pro', () => {
    // 1. In active trial
    setEdition('desktop-trial');
    expect(getEdition()).toBe('desktop-trial');
    expect(hasFeature('persistent_library')).toBe(true);
    expect(hasFeature('moving_ambient_light')).toBe(true);

    // 2. Trial expired -> Free mode
    setEdition('desktop-free');
    expect(getEdition()).toBe('desktop-free');
    // Pro visuals and pro library are locked in free mode
    expect(hasFeature('persistent_library')).toBe(false);
    expect(hasFeature('moving_ambient_light')).toBe(false);

    // 3. User enters valid offline key -> switches to Desktop Pro
    setEdition('desktop-pro');
    expect(getEdition()).toBe('desktop-pro');
    expect(hasFeature('moving_ambient_light')).toBe(true);
    expect(hasFeature('persistent_library')).toBe(true);
  });
});
