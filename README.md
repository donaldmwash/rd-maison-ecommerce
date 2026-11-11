# R. & D. Maison — Full-stack Commerce

A premium, responsive cosmetics storefront and commerce application for R. & D. Maison, designed for the Kenyan market.

## Application stack
- Next.js App Router, React and TypeScript
- Supabase Postgres, Auth and Row Level Security
- Safaricom Daraja STK Push for M-Pesa
- Vercel deployment

## Product scope
- Responsive storefront, product catalogue, category filtering, search, sorting and shade selection
- Shopping bag and server-validated checkout in KES
- Customer profiles, orders, payments and inventory data model
- Private administrator workspace for orders and catalogue management
- Secure M-Pesa STK Push and callback processing

## Setup
1. Create a dedicated Supabase project for R. & D. Maison.
2. Apply the SQL migration in `supabase/migrations/`.
3. Copy `.env.example` to `.env.local` and configure Supabase and Daraja.
4. Run `npm install`, then `npm run dev`.

Never reuse credentials from another application. Never expose the Supabase service role key, Daraja consumer secret or M-Pesa passkey in browser code.

## M-Pesa safety
The browser must never be treated as proof of payment. Orders are marked paid only after the server processes a Daraja callback and validates the transaction amount and receipt. Sandbox testing and Safaricom business onboarding are required before production payments.

## Verify before launch
The owner must confirm product details, prices, stock quantities, ingredients and claims, WhatsApp contact details, delivery fees, delivery coverage, returns policy and payment onboarding. Delivery charges must be confirmed before payment and must not be invented by the application.
