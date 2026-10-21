/*
# Add stock_status, categories, images columns to products table

1. Purpose
   The standalone Cloud POS mode needs to store richer product metadata so the
   ProductsPage can insert/update products directly in Supabase with the same
   fields the UI already collects. The existing `products` table only has
   `image_url` (single string) and no stock-status or category-array columns.
   This migration adds three columns and backfills them from existing data so
   nothing breaks.

2. New Columns (on `products`)
   - `stock_status` (text, not null default 'instock') — mirrors the app's
     'instock' / 'outofstock' value.
   - `categories` (text, not null default '') — comma-separated category
     names (kept as text for simplicity; the app already treats category as a
     single string).
   - `images` (text, not null default '') — a single image URL or Base64 data
     URL. Kept as text (not jsonb) because the app stores one featured image.

3. Backfill
   - `stock_status` derived from existing `stock_quantity` (>0 → 'instock').
   - `categories` copied from existing `category` column.
   - `images` copied from existing `image_url` column.

4. Security
   - No policy changes; the existing anon CRUD policies on `products` cover
     the new columns automatically.

5. Notes
   - Idempotent: uses `ADD COLUMN IF NOT EXISTS` and `UPDATE ... WHERE col IS NULL`.
   - The `image_url` column is kept for backward compatibility; the app will
     prefer `images` going forward.
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS stock_status text NOT NULL DEFAULT 'instock',
  ADD COLUMN IF NOT EXISTS categories text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS images text NOT NULL DEFAULT '';

UPDATE products SET stock_status = CASE WHEN stock_quantity > 0 THEN 'instock' ELSE 'outofstock' END
  WHERE stock_status IS NULL OR stock_status = '';

UPDATE products SET categories = category
  WHERE categories IS NULL OR categories = '';

UPDATE products SET images = image_url
  WHERE images IS NULL OR images = '';
