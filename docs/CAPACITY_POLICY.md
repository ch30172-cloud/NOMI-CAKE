# Capacity & availability policy

All date logic runs in the business timezone (`business_settings.timezone`, default `Asia/Jerusalem`).

## What counts against a day's capacity

Implemented in `public.capacity_used(date)` (migration 0003) and mirrored in the admin availability screen.

| Order status | Counts? |
|---|---|
| `confirmed`, `in_preparation`, `ready`, `completed` | Always |
| `pending` | Only while `created_at > now() - availability_rules.pending_hold_hours` (default 48h) |
| `cancelled` | Never |

Rationale: opening WhatsApp does not prove the customer sent the message. A pending order therefore
holds its slot for a limited time. If the owner does not confirm it within the hold window, the slot
is released automatically **without deleting or cancelling the order**: it is still listed in the admin
and can be confirmed later (which immediately counts it again, even if the day is now "full").

## The limit for a day

`capacity_limit(date)` = `daily_order_limits.max_orders` for that date if present, otherwise
`availability_rules.default_daily_limit`. A limit of `0` closes the day for new orders.

## Concurrency

`create_order()` takes `pg_advisory_xact_lock(hashtext('order-date:' || date))` before checking
`capacity_used >= capacity_limit`, so two customers ordering the last slot at the same moment are
serialized and only one succeeds. Coupons are locked with `SELECT ... FOR UPDATE` in the same
transaction, and `idempotency_key` is unique, so a double click never creates two orders.

## Validation performed server-side on every order

- Date within `[today + min_lead_days, today + max_days_ahead]`
- Not in `blocked_dates`
- `business_hours` row exists and is active for that weekday and fulfillment type (pickup/delivery)
- Time within open/close, aligned to `slot_minutes`, not inside a `blocked_time_slots` range
- Delivery city active and not deleted; address required for delivery
- Every product available, quantity within min/max, size chosen when required
- Coupon active, in date range, under max redemptions, minimum order met
- All prices recomputed from the database (the browser never sends prices)

## Customer-facing data

Customers never read `daily_order_limits` or order counts. `get_availability()` only returns
`is_available` plus a reason code (`too_soon`, `too_far`, `closed`, `blocked`, `full`).
