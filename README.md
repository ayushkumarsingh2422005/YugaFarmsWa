# Yuga Farms — WhatsApp service (`yuga-farms-wa`)

Separate Next.js app on the **same VPS** as `YugaFarms` (storefront) and `YugaFarmsBackend` (Strapi).  
All WhatsApp messaging, webhooks, and scheduling live here — not in the storefront or Strapi.

## Client flows

| Trigger | Message |
|--------|---------|
| Order placed | Thank you (immediate) |
| Order `DELIVERED` in Strapi + cron | Review ask (~4 days after delivery) |
| Same | Other-product insights (~10 days) |
| Same | Repurchase reminder per variant weight (e.g. 500→12d, 1000→25d) |
| Cart updated (storefront) | Snapshot + optional chatbot webhook; WA text only if `WA_SEND_CART_MESSAGES=true` |

## Setup

1. Copy `.env.example` → `.env.local` and fill Meta WhatsApp Cloud API values.
2. Set `STRAPI_DATABASE_PATH` to the Strapi SQLite file (read-only), e.g. `../YugaFarmsBackend/.tmp/data.db`.
3. Use the **same** `WA_INTERNAL_SECRET` in `YugaFarms` `.env.local` as `NEXT_PUBLIC_WA_SERVICE_URL` + server secret.
4. Install and run:

```bash
npm install
npm run dev   # port 3001 by default
```

5. Meta webhook URL: `https://<your-wa-host>/api/webhooks/whatsapp`
6. Cron on VPS (every 5–15 min):

```bash
curl -s -H "x-cron-secret: YOUR_CRON_SECRET" "https://<your-wa-host>/api/cron/process-messages"
```

Mark orders **DELIVERED** in Strapi admin when shipped — cron schedules review / insights / repurchase messages.

## API (internal)

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/internal/order-placed` | `x-wa-internal-secret` | Queue thank-you + process immediate sends |
| `POST /api/internal/cart-sync` | `x-wa-internal-secret` | Save cart snapshot + chatbot webhook |
| `GET /api/cron/process-messages` | `x-cron-secret` | Delivered-order scan + send due messages |
| `GET/POST /api/webhooks/whatsapp` | Meta verify token / signature | Inbound messages & status |
| `GET /api/health` | — | Health check |

## Databases

- **Strapi** (`STRAPI_DATABASE_PATH`): read-only orders, users, cart JSON.
- **Local** (`WA_DATABASE_PATH`): scheduled messages, cart snapshots, logs.

## Product consumption cycles

Configure in `.env`:

```env
PRODUCT_CONSUMPTION_CYCLES={"500":12,"1000":25,"250":7}
```

Keys match `weight` on cart line items (from Strapi variant `Weight`).
