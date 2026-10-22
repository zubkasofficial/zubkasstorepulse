/*
# Rename store_url to woocommerce_url in store_settings

1. Purpose
   - The store URL column in `store_settings` needs to be renamed from `store_url`
     to `woocommerce_url` to match the expected schema naming convention.

2. Changes
   - Rename column `store_url` → `woocommerce_url` on `store_settings` table.
   - No data is lost (table is empty / singleton with 0 rows).

3. Security
   - No RLS policy changes — existing policies remain valid.
*/

ALTER TABLE store_settings RENAME COLUMN store_url TO woocommerce_url;
