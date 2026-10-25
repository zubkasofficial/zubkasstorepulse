/*
# Add WooCommerce-style product columns

Adds the remaining WooCommerce product fields the Add Product form now
collects so they persist in Supabase: physical (weight, dimensions, shipping
class), inventory extras (GTIN, sold individually, unit of measure), linked
products (upsells, cross-sells), advanced (purchase note, menu order,
reviews, POS availability), and the virtual/downloadable/sale-schedule flags
that were previously derived or dropped.

All columns are nullable / defaulted so existing rows keep working. RLS is
already enabled and the existing anon+authenticated CRUD policies cover the
new columns automatically.
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'simple',
  ADD COLUMN IF NOT EXISTS virtual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS downloadable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS manage_stock boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS backorders text NOT NULL DEFAULT 'no',
  ADD COLUMN IF NOT EXISTS tax_status text NOT NULL DEFAULT 'taxable',
  ADD COLUMN IF NOT EXISTS tax_class text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sale_start_date date,
  ADD COLUMN IF NOT EXISTS sale_end_date date,
  ADD COLUMN IF NOT EXISTS downloads jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS download_limit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS download_expiry integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tags text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS full_description text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS weight text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS length text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS width text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS height text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_class text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS gtin text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sold_individually boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unit_of_measure text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS upsell_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cross_sell_ids jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS purchase_note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS menu_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reviews_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pos_available boolean NOT NULL DEFAULT true;

-- Backfill type from existing variation presence
UPDATE products
  SET type = 'variable'
  WHERE variations IS NOT NULL
    AND jsonb_array_length(variations) > 0
    AND (type IS NULL OR type = '');

UPDATE products SET downloads = '[]'::jsonb WHERE downloads IS NULL;
UPDATE products SET upsell_ids = '[]'::jsonb WHERE upsell_ids IS NULL;
UPDATE products SET cross_sell_ids = '[]'::jsonb WHERE cross_sell_ids IS NULL;
