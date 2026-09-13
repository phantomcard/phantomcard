# Separate Site A / Site B Deployment

The current workspace now treats the root directory as Phantom Cards Site A and
`data-bundle-site/` as the standalone Site B application. Site B can be copied to a
completely different server or folder.

## Local folders

```text
final cards/                 # Phantom Cards Site A
  .env
  server.js
  index.html
  app.js
  data/

data-bundle-site/            # independent Site B
  .env
  server.js
  bundle-service.js
  payment-config.js
  public/
  data/
```

## Site A `.env`

Start from the root `.env.example`:

```env
PORT=3000
APP_BASE_URL=http://127.0.0.1:3000
SITE_B_BASE_URL=http://127.0.0.1:4000
PAYSTACK_CURRENCY=GHS
SITE_A_TO_SITE_B_SECRET=the_same_site_a_to_site_b_secret_used_by_site_b
SITE_B_TO_SITE_A_SECRET=the_same_site_b_to_site_a_secret_used_by_site_b
PAYMENT_SESSION_MINUTES=15
PHANTOM_DATA_FILE=./data/phantom-cards.json
```

Keep the existing Site A admin settings in this file too. Do not put
`PAYSTACK_SECRET_KEY` in Site A's `.env`.

## Site B `.env`

Copy `data-bundle-site/.env.example` to `data-bundle-site/.env`:

```env
PORT=4000
SITE_B_BASE_URL=http://127.0.0.1:4000
SITE_A_BASE_URL=http://127.0.0.1:3000
SITE_A_TO_SITE_B_SECRET=the_exact_same_value_as_site_a
SITE_B_TO_SITE_A_SECRET=the_exact_same_value_as_site_a
PAYSTACK_SECRET_KEY=your_paystack_test_or_live_secret
PAYSTACK_API_BASE_URL=https://api.paystack.co
PAYSTACK_CURRENCY=GHS
PAYMENT_DATA_FILE=./data/payment-service.json
DATA_BUNDLE_DATA_FILE=./data/data-bundles.json
DATA_BUNDLE_PAYMENT_EMAIL=your_paystack_approved_receipt_email
DATA_BUNDLE_ADMIN_TOKEN=your_private_manual_fulfillment_token
```

Only Site B receives the Paystack secret. Keep `.env` files private and do not commit
them.

## Run locally

Terminal 1, from the Phantom Cards root:

```bash
npm run dev
```

Terminal 2, from the independent Site B directory:

```bash
cd data-bundle-site
npm run dev
```

The two services communicate over:

```text
Site A → POST /api/v1/payments/initialize → Site B
Site B → POST /api/v1/webhooks/payment-status → Site A
Paystack → POST /api/v1/webhooks/paystack → Site B
```

## Production URLs

Replace the local URLs in both `.env` files with the deployed HTTPS origins:

```env
# Site A
APP_BASE_URL=https://cards.example.com
SITE_B_BASE_URL=https://data.example.com

# Site B
SITE_A_BASE_URL=https://cards.example.com
SITE_B_BASE_URL=https://data.example.com
```

Configure Paystack's webhook URL as:

```text
https://data.example.com/api/v1/webhooks/paystack
```

The callback and redirect URLs are generated from `SITE_A_BASE_URL` and
`SITE_B_BASE_URL`; they must be publicly reachable over HTTPS in production.
