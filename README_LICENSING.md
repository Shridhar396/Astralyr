# Astralyr Desktop — Licensing Guide

Astralyr Desktop features an **offline cryptographic licensing system** powered by Ed25519 digital signatures.

---

## 🚨 LOUD WARNING: BACK UP YOUR PRIVATE KEY!

> ### ⚠️ CRITICAL PRIVATE KEY SECURITY NOTICE
> 
> The entire offline licensing system relies on the **Ed25519 private key** (`license_private.pem`) held only by the project owner.
> 
> - **NEVER commit the private key to Git.** It is listed in `.gitignore` and omitted from all build artifacts.
> - **NEVER distribute the private key with the application or share it with anyone.**
> - **BACK UP THE PRIVATE KEY SECURELY NOW.** Store copies on an encrypted external drive, Bitwarden/1Password, or a secure offline vault.
> - **IF YOU LOSE THE PRIVATE KEY:** You will be permanently unable to issue new license keys or reissue keys for paying customers.
> - **IF THE PRIVATE KEY LEAKS:** Anyone with the key can generate unlimited valid Astralyr Pro licenses.

---

## 1. Offline Cryptographic Licensing (Primary / UPI Sales)

Astralyr Pro is sold directly via manual UPI payments with 100% offline key generation and verification.

### Architecture
- **Public Key Embedded in Client:** `src/licensing/publicKey.ts` embeds only the public key (`MCowBQYDK2VwAyEAWTNaZAUDfbRoygmgxM2A/7hYM08AaCK8+s7Dw4DowUw=`).
- **Completely Offline Verification:** The app verifies the Ed25519 digital signature locally on the client's machine using `node:crypto`. Zero internet pings or remote servers are contacted during verification.
- **Key Format:** Base32-encoded package `[64-byte signature + UTF-8 JSON payload]` formatted as `ASTR-XXXXX-XXXXX-XXXXX-...`.
- **Payload Schema:**
  ```json
  {
    "v": 1,
    "name": "Customer Name",
    "email": "customer@email.com",
    "plan": "pro",
    "issued": "YYYY-MM-DD",
    "id": "8-char-hex-id"
  }
  ```
- **Storage:** Verified license state is saved inside the OS user data directory (`<app.getPath('userData')>/license.json`).

### Key Generation CLI (`tools/keygen.js`)
The key generator CLI is located in `tools/` (gitignored and excluded from production builds):

1. **Issue a new license key after UPI payment:**
   ```bash
   node tools/keygen.js --name "Rahul Sharma" --email "rahul@example.com" --utr "UPI123456789012"
   ```
   Outputs the copy-friendly key and logs transaction details to `tools/sales_log.csv`.

2. **Revoke a license ID:**
   ```bash
   node tools/keygen.js revoke --id <8-char-id>
   ```
   Appends the ID to `src/licensing/revoked.json` and `electron/licensing/revoked.json`.

3. **Initialize / Rotate keypair:**
   ```bash
   node tools/keygen.js init
   ```

For complete instructions on the manual selling workflow, see [HOW_I_SELL_LICENSES.md](file:///d:/Music%20visualizer/HOW_I_SELL_LICENSES.md).

---

## 2. Remote Providers (Optional / Fallback)

Astralyr also supports automated remote providers (LemonSqueezy, DodoPayments) if enabled in `src/licensing/config.ts`:
- **LemonSqueezy:** Uses License API v1 (`/activate`, `/validate`, `/deactivate`).
- **DodoPayments:** Direct license key validation.
- **Offline Grace Period:** 30 days of offline playback following remote validation.

---

## 3. Editions & Feature Gates

| Feature | Astralyr Web | Astralyr Desktop Free | Astralyr Desktop Pro |
|---|:---:|:---:|:---:|
| Constellation Synced Lyrics | ✅ | ✅ | ✅ |
| Audius Streaming & Search | ✅ | ✅ | ✅ |
| Local Music Playback | ✅ (Temp blob) | ✅ (Persistent library) | ✅ (Persistent library) |
| Basic Ambient Glow | ✅ | ✅ | ✅ |
| 14-Day Full Pro Trial | — | — | ✅ |
| Beat-Reactive Moving Light | 🔒 | 🔒 | ✅ |
| Custom Backgrounds & Wallpapers | 🔒 | 🔒 | ✅ |
| Offline Cryptographic Activation | — | — | ✅ |
