# PHANTOM CARDS

Site A runs the Phantom Cards marketplace on port 3000. It owns accounts, Wallet Balance,
Redeemed Balance, cards, redemptions, and withdrawals. The independently deployable
Site B is now in `data-bundle-site/`; it runs on port 4000 and is the only process that
has `PAYSTACK_SECRET_KEY`.

## Payments and withdrawal verification

`Browser → Site A pending WALLET_TOPUP → Site B → Paystack → Site B webhook/verification → signed Site A callback → Wallet Balance`

Card purchases remain `POST /api/purchases`, an internal Wallet Balance debit. Redemption credits only Redeemed Balance; withdrawals debit only Redeemed Balance.

Withdrawals unlock after **three lifetime card redemptions**. The requested amount is held from Redeemed Balance and a 10% operational charge is shown before confirmation. Unverified users can submit KYC for review, or choose the per-withdrawal GHS 70 KYC bypass. The bypass is a Paystack checkout: it only auto-approves the withdrawal after Paystack verification and a signed callback from Site B. It never marks the account as KYC verified.

Copy `.env.example` to `.env` for Site A. Do **not** put a Paystack secret in it.
Then copy `data-bundle-site/.env.example` to `data-bundle-site/.env`, configure the
same `SITE_A_TO_SITE_B_SECRET` and `SITE_B_TO_SITE_A_SECRET` values in both files, and
put the Paystack **test** secret only in the Site B `.env`.

Run in two terminals:

```bash
npm run dev
cd data-bundle-site && npm run dev
```

For phone/browser testing, expose **both** local services through HTTPS tunnels:

```bash
cloudflared tunnel --url http://localhost:3000  # Site A URL, e.g. https://cards.example.com
cloudflared tunnel --url http://localhost:4000  # Site B URL, e.g. https://payments.example.com
```

Then update and restart both processes:

```env
# .env (Site A)
APP_BASE_URL=https://cards.example.com
SITE_B_BASE_URL=https://payments.example.com

# data-bundle-site/.env (Site B)
SITE_A_BASE_URL=https://cards.example.com
SITE_B_BASE_URL=https://payments.example.com
```

Configure the Paystack dashboard webhook as `https://payments.example.com/api/v1/webhooks/paystack`. Site B redirects only to the configured `SITE_A_BASE_URL`; it never accepts a browser-provided redirect address.

## Site B public portal

Site B also serves a separate public-facing bundle catalog at `http://127.0.0.1:4000/`.
The interface presents Ghana data plans for MTN, Telecel, and AirtelTigo, accepts
Paystack checkout, and stores manual-fulfillment orders separately from Site A.

The existing payment routes remain internal and unchanged: Site A still initializes
`WALLET_TOPUP` and `KYC_BYPASS` sessions through the signed
`POST /api/v1/payments/initialize` route, Paystack still returns through
`/payment/return`, and webhook verification/callback reconciliation remains on Site B.

Bundle checkout is a separate Paystack flow. It stores orders in
`data-bundle-site/data/data-bundles.json`, verifies payment through Paystack, and marks
successful orders as `PAID_AWAITING_MANUAL_DELIVERY`. The operator can use the
recipient network and phone number from the order to purchase the bundle manually.
After verification, the customer sees a 2–5 minute delivery confirmation. Marking an
order fulfilled is available through the token-protected manual fulfillment API:

```bash
GET  /api/v1/data-bundles/admin/orders
POST /api/v1/data-bundles/admin/orders/:reference/fulfill
Authorization: Bearer $DATA_BUNDLE_ADMIN_TOKEN
```

## Admin console

Site A now includes a separate desktop-first operations console at `/admin`.
It provides server-side views for overview metrics, users, cards, purchases,
deposits, payment references, redemptions, withdrawals, KYC, transactions,
and audit logs. Existing withdrawal and KYC mutations are protected by an
admin session and require a note/reason; historical financial records and
balances are not directly editable.

Configure admin login credentials in Site A's `.env` before using the console:

```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=<preferred-scrypt-hash>
```

For local-only development, `ADMIN_PASSWORD` may be used instead of
`ADMIN_PASSWORD_HASH`. Do not commit either value. The old
`ADMIN_APPROVAL_TOKEN` remains accepted for backwards-compatible server-to-
server/manual calls, but the dashboard uses the session login.

Open `http://127.0.0.1:3000/admin` after starting Site A.

## APIs

- Site A → Site B: `POST /api/v1/payments/initialize`, Bearer authentication, HMAC-SHA256 over raw JSON, request ID and timestamp.
- Paystack → Site B: `POST /api/v1/webhooks/paystack`, raw-body HMAC-SHA512 validation.
- Site B → Site A: `POST /api/v1/webhooks/payment-status`, Bearer plus HMAC-SHA256, timestamp and replay protection.
- Site A user status: `GET /api/deposits/:transactionId` (owner only).

Top-ups store minor units, purpose `WALLET_TOPUP`, expiry, Paystack reference, Site B transaction ID, and processed callback IDs. Site A credits the wallet only on a reconciled `SUCCESS` callback, and the receipt/ledger reference makes the credit idempotent.
