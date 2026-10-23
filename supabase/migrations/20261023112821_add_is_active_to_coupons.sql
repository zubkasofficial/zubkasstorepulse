/*
# Add is_active column to coupons table

1. Changes
- Adds `is_active` boolean column to `coupons` table, defaulting to `true`.
- This allows explicit activation/deactivation of coupons independent of expiry dates.
- Existing coupons are set to `is_active = true`.

2. Security
- No RLS policy changes. Existing policies already allow anon + authenticated CRUD.
*/

ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE coupons SET is_active = true WHERE is_active IS NULL;
