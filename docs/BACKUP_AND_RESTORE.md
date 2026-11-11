# Backups & restore

## What exists and what it costs

| Layer | Mechanism | Status |
|---|---|---|
| PostgreSQL (orders, products, settings) | Supabase automatic daily backups | **Pro plan and above** (7 days on Pro, longer with the PITR add-on). On the free plan there are **no automatic backups**: use the manual dump below. |
| Point-in-time recovery | Supabase PITR add-on | Paid add-on. Not enabled by this project. |
| Images (product photos, gallery, logo) | Supabase Storage buckets `product-images`, `site-media` | Not covered by database backups. Mirror them with the script below. |
| Source code & migrations | Git repository | Push to a remote (GitHub) so the schema can always be recreated. |

Nothing paid has been enabled by this project. Enabling Pro/PITR is the owner's decision.

## Manual database dump (works on any plan)

Requires the Supabase CLI (`npm i -g supabase`) and the database connection string from
Project Settings → Database.

```bash
# Full logical dump (schema + data)
supabase db dump --db-url "$SUPABASE_DB_URL" -f backups/db-$(date +%F).sql
# Data only (faster, smaller)
supabase db dump --db-url "$SUPABASE_DB_URL" --data-only -f backups/data-$(date +%F).sql
```

Recommended cadence: weekly, plus before any migration. Store the files outside the server
(encrypted cloud drive). They contain customer names, phones and addresses.

## Storage mirror

```bash
# Download every object from both buckets to ./backups/storage
supabase storage cp -r ss:///product-images backups/storage/product-images --experimental
supabase storage cp -r ss:///site-media    backups/storage/site-media    --experimental
```

## Restore procedure

1. Create a fresh Supabase project (or use the existing one).
2. Apply the migrations in order: `supabase/migrations/0001_schema.sql` … `0004_seed.sql`
   (SQL editor, or `supabase db push` if the project is linked).
3. Restore data: `psql "$SUPABASE_DB_URL" -f backups/data-YYYY-MM-DD.sql`
   (for a full dump into an empty project use the full file instead of running migrations).
4. Re-upload storage: `supabase storage cp -r backups/storage/product-images ss:///product-images --experimental`
   (same for `site-media`). Public URLs keep the same paths, so no database changes are needed
   when restoring into the **same** project. Restoring into a **different** project changes the
   host part of every stored URL: run
   `update products set ...` is not needed; instead update URLs with
   `update product_images set url = replace(url, 'https://OLD.supabase.co', 'https://NEW.supabase.co');`
   and the same for `gallery_images`, `categories.image_url`, `homepage_content.*_image_url`,
   `business_settings.logo_url`.
5. Re-create the admin: `npm run bootstrap:admin` (auth users are not part of the public schema dump).
6. Point Vercel environment variables at the restored project and redeploy.

## Verifying a backup

Once a quarter, restore the latest dump into a throwaway Supabase project and open the admin
dashboard: order counts and totals must match production for the backup date.
