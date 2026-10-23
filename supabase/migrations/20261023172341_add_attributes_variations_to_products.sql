/*
# Add attributes and variations columns to products table

1. Changes
- Adds `attributes` jsonb column to `products` table for storing product attributes (e.g. color: red, green).
- Adds `variations` jsonb column to `products` table for storing variation data (sku, price, salePrice, attributes per variation).
- Both columns default to '[]'::jsonb and are nullable.
- Existing products get empty arrays.

2. Security
- No RLS policy changes. Existing policies already allow anon + authenticated CRUD.
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS attributes jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS variations jsonb DEFAULT '[]'::jsonb;

UPDATE products SET attributes = '[]'::jsonb WHERE attributes IS NULL;
UPDATE products SET variations = '[]'::jsonb WHERE variations IS NULL;
