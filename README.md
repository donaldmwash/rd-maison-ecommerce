# R. & D. Maison — E-commerce

A premium cosmetics storefront and full-stack commerce foundation for R. & D. Maison, built for a Kenyan KES checkout experience.

## Live application

- Production: https://rd-maison-ecommerce.vercel.app
- Repository: https://github.com/donaldmwash/rd-maison-ecommerce

## Stack

- Next.js App Router, React and TypeScript
- Supabase Postgres, Auth and Row Level Security
- Safaricom Daraja STK Push (sandbox/production)
- Vercel hosting and GitHub Actions quality checks

## Included

- Responsive storefront, catalogue search and category filtering
- Product details and shade selection
- Shopping bag and checkout
- Server-side product-price lookup; browser prices are never trusted for order totals
- Order and order-item persistence
- M-Pesa STK Push endpoint and callback handler
- Callback checks for configured shared token, checkout request, amount and receipt before an order is marked paid
- Supabase schema, RLS policies and seeded catalogue
- Private administrator sign-in and order/product workspace
- Health endpoint at `/api/health`

The storefront starts with a local catalogue preview and switches to the active database catalogue when Supabase is configured. Product price/name/visibility edits in the admin workspace then flow through to the storefront.

## Local setup

1. Install Node.js 22.
2. Run `npm install`.
3. Copy `.env.example` to `.env.local`.
4. Create a **dedicated Supabase project** for R. & D. Maison. Do not reuse credentials from another project.
5. Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor.
6. Add the Supabase values to `.env.local`.
7. Run `npm run dev` and open `http://localhost:3000`.

Without Supabase environment variables, the site is a storefront preview. Database checkout and admin features remain unavailable; the app does not fake order or payment confirmation.

## Required environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Dedicated Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key for trusted API routes; never prefix with NEXT_PUBLIC |
| `MPESA_ENVIRONMENT` | `sandbox` until production approval |
| `MPESA_CONSUMER_KEY` | Daraja app consumer key |
| `MPESA_CONSUMER_SECRET` | Daraja app consumer secret |
| `MPESA_SHORTCODE` | Approved Paybill/Till shortcode |
| `MPESA_PASSKEY` | Lipa na M-Pesa Online passkey |
| `MPESA_CALLBACK_URL` | Public HTTPS callback URL, including the shared token query parameter |
| `MPESA_CALLBACK_SECRET` | Long random callback token |
| `MPESA_TRANSACTION_TYPE` | Daraja transaction type |

Set these in Vercel Project Settings → Environment Variables and redeploy. Keep service-role and Daraja secrets server-side.

## Create the first administrator

1. Enable Email/Password authentication in Supabase.
2. Create the store owner's user account in Supabase Auth.
3. In the SQL Editor, replace the email below with the exact owner email and run:

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'owner@example.com');
```

The role cannot be self-assigned from the browser.

## M-Pesa setup and safety

1. Create a Safaricom Daraja app with Lipa na M-Pesa Online.
2. Configure sandbox credentials first.
3. Set `MPESA_CALLBACK_URL` to `https://rd-maison-ecommerce.vercel.app/api/mpesa/callback?token=YOUR_RANDOM_SECRET` (replace the token with the same value stored in `MPESA_CALLBACK_SECRET`).
4. Verify the callback endpoint is reachable, then test sandbox payments end to end.
5. Use production credentials only after Safaricom business onboarding and approval.

The browser never marks an order paid. Only a successful server-processed Daraja callback with matching order amount and receipt can do that. Never collect or store an M-Pesa PIN.

## Quality commands

```bash
npm run typecheck
npm run lint
npm run build
```

GitHub Actions runs the same checks for pushes and pull requests to `main`.

## Business verification required before launch

The owner must verify product names, prices, ingredients and claims; stock; WhatsApp contact details; delivery coverage and charges; returns/refunds policy; and any business contact details. The checkout currently records a zero delivery fee because delivery is quoted separately; configure a verified fee workflow before accepting paid orders.

## Launch status

The code and Vercel project are deployed, but the commerce backend is **not live-ready** until a dedicated Supabase project is connected, the SQL migration is applied, an admin account is promoted, Daraja sandbox is configured and tested, and business/stock/delivery details are verified.
