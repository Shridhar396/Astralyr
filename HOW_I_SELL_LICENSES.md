# How I Sell Astralyr Pro Licenses (Manual UPI Flow)

Astralyr uses a 100% offline, cryptographic licensing system powered by Ed25519 digital signatures. No external license servers, payment gateways, or runtime internet pings are required.

---

## 1. The Sale Workflow

1. **Customer sends payment via UPI**:
   - Customer pays the license fee (e.g., ₹299 / $4.99).
   - Customer provides their **Name**, **Email**, and the bank **UPI Reference / UTR Number** (12-digit transaction ID).

2. **Generate the license key locally**:
   Open a terminal in the Astralyr workspace and run:
   ```bash
   node tools/keygen.js --name "Customer Name" --email "customer@email.com" --utr "123456789012"
   ```

3. **Key is printed and logged**:
   - The CLI outputs a formatted key: `ASTR-XXXXX-XXXXX-XXXXX-...`
   - It automatically appends a CSV record to `tools/sales_log.csv`:
     ```csv
     "2026-11-13 17:30:00","Customer Name","customer@email.com","c4ab96f4","123456789012","ASTR-..."
     ```

4. **Send receipt and key to customer**:
   Send the buyer an email or WhatsApp message with their key and activation instructions:
   > **Thank you for purchasing Astralyr Pro!**
   > 
   > Here is your personal license key:
   > `ASTR-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX...`
   > 
   > **How to activate:**
   > 1. Open Astralyr Desktop.
   > 2. Open Settings or About, and click **Manage Desktop License** (or click the Pro banner).
   > 3. Click **Paste** (or Ctrl+V) and click **Activate**.
   > 4. Astralyr Pro will activate instantly offline. No internet is required.

---

## 2. Sales Log (`tools/sales_log.csv`)

`tools/sales_log.csv` is automatically created and updated by `keygen.js`. It is `.gitignore`d and never packaged into app builds.

Columns recorded:
- `Timestamp`: Date and time of key issuance.
- `Name`: Full name of customer.
- `Email`: Email address of customer.
- `LicenseId`: 8-character unique hex ID embedded in the key.
- `UTR`: UPI transaction reference ID for reconciliation.
- `LicenseKey`: The generated license string.

---

## 3. Revoking a License

If a customer requests a refund or charges back:
1. Run:
   ```bash
   node tools/keygen.js revoke --id <8-char-license-id>
   ```
2. This adds the ID to `src/licensing/revoked.json` and `electron/licensing/revoked.json`.
3. Commit and push the updated `revoked.json` to GitHub:
   - Apps fetch the revocation list once daily if connected to the internet.
   - Any app running that license ID is automatically downgraded to Free mode.
   - The next desktop app release will bundle the revocation permanently.

---

## 4. Key Rotation for Major Versions

- The Ed25519 private key signs all v1.x licenses (`v: 1` in payload).
- For a future major version (e.g. Astralyr v2.0):
  1. Run `node tools/keygen.js init` to generate a new keypair.
  2. Embed the new public key in `src/licensing/publicKey.ts`.
  3. Set payload version `v: 2`.
  4. If desired, support grandfathered v1 keys by maintaining an array of accepted public keys.

---

## ⚠️ CRITICAL WARNING: Private Key Backup

- **NEVER share, leak, or commit the private key (`license_private.pem`)**.
- Store a secure offline backup (e.g. on an encrypted flash drive or secure password manager).
- **If you lose the private key**: You cannot issue new keys or replace lost customer keys.
- **If the private key leaks**: Anyone can generate valid Pro keys for Astralyr without paying.

