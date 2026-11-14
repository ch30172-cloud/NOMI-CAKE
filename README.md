# Nomi Nebentzhal – Cakes and Boutique Conditoria

Customer ordering site + owner admin for a boutique cake business.
Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind 4 · shadcn/ui · Supabase (Postgres, Auth, Storage, RLS) · next-intl (he/en, RTL/LTR) · Recharts · Resend · Vercel.

## What is implemented

| Area | Status |
|---|---|
| Customer site: home, catalog (categories, search), product page, cart (localStorage), checkout, order confirmation with WhatsApp hand-off | Done |
| Flexible pricing (fixed / by size / by quantity tiers / custom quote), server-side recomputation | Done (`priceLine` + SQL `create_order`) |
| Availability: working hours per day & type, lead days, blocked dates/slots, daily capacity with pending-hold, race-safe | Done – see `docs/CAPACITY_POLICY.md` |
| Coupons: percent / fixed / free delivery, product/category scope, min order, dates, max uses (atomic), release on cancel | Done |
| Orders: idempotent creation, snapshots, status history, WhatsApp messages per status | Done |
| Payments: multiple payments/refunds per order, deposit flag, automatic payment status, balance | Done |
| Admin: login (email+password, Google OAuth), TOTP two-factor, dashboard with Recharts, products (+images, variants, translation approval), categories, orders, coupons, delivery cities, availability, site content & gallery, settings & logo (owner only), audit log | Done |
| Notifications: admin outbox + email via Resend with retries (cron) | Done (needs `RESEND_API_KEY`) |
| Automatic translation suggestion (Google / DeepL) | Done (needs `TRANSLATE_*`) |
| SEO: metadata, Open Graph, hreflang alternates, sitemap, robots, noindex for admin/order pages | Done |
| Unit tests (pricing, coupons, WhatsApp message, phone normalization, slots) | Done – `npm test` |
| Integration / E2E tests against a real database | **Not done** – requires a Supabase project (see "Testing") |
| Backups | Documented in `docs/BACKUP_AND_RESTORE.md`; automatic backups depend on the Supabase plan |

Nothing is mocked: without Supabase credentials the site renders empty states and the checkout returns `not_configured`.

## 1. Local setup

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev                  # http://localhost:3000 (redirects to /he)
```

## 2. Supabase

1. Create a project at supabase.com (EU/Frankfurt is the closest region to Israel).
2. Project Settings → API: copy `URL`, `anon` key and `service_role` key into `.env.local`.
   The service role key is server-only. Never prefix it with `NEXT_PUBLIC_`.
3. Run the migrations **in order** in the SQL editor (or `supabase db push` with the CLI):
   `supabase/migrations/0001_schema.sql`, `0002_rls.sql`, `0003_functions.sql`, `0004_seed.sql`.
   0004 only inserts the six agreed categories and default working hours; no products or prices.
4. Authentication → Providers → Email: enabled. Users that are not in `admin_users` are ignored by the app.
5. Authentication → MFA: enable TOTP.
6. Storage: buckets `product-images` and `site-media` are created by migration 0001 (public read, admin-only write via RLS).

### Regenerating types
`npx supabase gen types typescript --linked > src/types/database.ts` (optional; the hand-written file matches the migrations).

## 3. First admin (owner)

```bash
ADMIN_BOOTSTRAP_EMAIL=owner@example.com ADMIN_BOOTSTRAP_PASSWORD='a-long-password' npm run bootstrap:admin
```
The script refuses to run if an admin already exists. Then sign in at `/he/admin/login` and enable
two-factor authentication from Settings. Additional admins: insert a row into `admin_users`
(`role = 'staff'` or `'owner'`) for an existing auth user.

## 4. Google OAuth (optional)

1. Google Cloud Console → Credentials → OAuth client (Web). Authorized redirect URI:
   `https://<project-ref>.supabase.co/auth/v1/callback`.
2. Supabase → Authentication → Providers → Google: paste client ID/secret.
3. Supabase → Authentication → URL configuration: add `http://localhost:3000/api/auth/callback`
   and `https://<your-domain>/api/auth/callback` to the redirect URLs.
Only accounts present in `admin_users` get access, regardless of provider.

## 5. Email notifications (Resend)

1. resend.com → API key → `RESEND_API_KEY`. Verify your sending domain and set `EMAIL_FROM`.
2. Set the recipient in Admin → Settings → "Business email".
3. Emails are queued in `notifications` and sent right after each order; failures are retried by
   `GET /api/cron/notifications` (Vercel Cron every 10 min, `Authorization: Bearer $CRON_SECRET`).
   Without an API key the rows stay `pending` and nothing is lost.

## 6. Automatic translation (optional)

`TRANSLATE_PROVIDER=google` with a Cloud Translation API key, or `TRANSLATE_PROVIDER=deepl` with a
DeepL key. Suggestions appear in the product form; nothing is published in English until the owner
ticks "approved".

## 7. Logo

Save the original logo as `public/branding/logo-original.jpg`. Until then the site shows a typographic
wordmark. The owner can upload a replacement from Admin → Settings (owner role only).

## 8. Testing

```bash
npm test          # vitest unit tests (pricing, coupons, WhatsApp, phone, slots)
npm run typecheck
npm run lint
```
Integration/E2E tests for the full order flow need a live Supabase project. Suggested approach:
Playwright against `npm run dev` with a dedicated test project and the migrations applied.

## 9. Deploy (Netlify or Vercel)

Live demo: https://nomi-nebentzhal-cakes.netlify.app (Netlify, free tier). `netlify.toml` + `@netlify/plugin-nextjs` are configured; deploy with `npx netlify-cli deploy --build --prod`. Note: Netlify has no cron for `/api/cron/notifications`; emails are still sent immediately after each order, and the cron route can be pinged by any external scheduler with the `CRON_SECRET`.

### Vercel alternative

1. Push the repo to GitHub and import it in Vercel.
2. Add all variables from `.env.example` (set `NEXT_PUBLIC_SITE_URL` to the production URL).
3. `vercel.json` registers the notifications cron. Set `CRON_SECRET` to a long random string.
4. Add the production callback URL to Supabase (see §4) even if Google is not used.
No deployment has been performed by this repository; it is prepared, not deployed.

## 10. Security notes

- Admin authorization is enforced by `admin_users` + RLS policies and re-checked in every server action (`assertAdmin`). Hiding buttons is never the only guard.
- Orders, payments, customer data and audit logs are readable only by admins (RLS). Customers reach their confirmation page via a random per-order token.
- Public order creation goes through one `SECURITY DEFINER` function executable only by the service role; prices, coupons and capacity are recomputed there.
- Zod validation on both sides; React escapes output; Supabase uses parameterized queries. Server actions are same-origin by Next.js. Uploads are MIME/size checked and stored under random names.
- Rate limiting for order creation is in-memory per instance; for strict limits plug Upstash/Redis into `src/lib/rate-limit.ts`.
- No card data is stored anywhere; payments are recorded manually by the owner.
- Privacy policy page at `/he/privacy` (text in `src/i18n/messages/*.json`).

## Project layout

```
src/app/[locale]/(site)        customer pages
src/app/[locale]/admin         admin (login, mfa, dashboard & modules)
src/app/api                    auth callback, cron
src/components/{site,cart,checkout,admin,branding,ui}
src/lib/{pricing,orders,availability,whatsapp,email,translate,auth,admin,data,supabase}
src/i18n                       routing + he/en messages
supabase/migrations            schema, RLS, functions, seed
tests                          vitest
docs                           capacity policy, backup & restore
```
