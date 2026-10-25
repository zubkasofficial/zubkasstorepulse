/*
# Add gallery images column to products

1. Changes
- Adds a `gallery_images` jsonb column to `products` (nullable, defaults to '[]').
- Stores an array of image objects `{ src: string }` representing the product
  gallery images, mirroring WooCommerce's product gallery feature.
2. Notes
- The column is nullable with a default of '[]' so existing rows are not
  affected and existing INSERT statements that omit it still succeed.
- No RLS changes — the products table already has RLS enabled and the
  existing policies cover the new column.
*/

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS gallery_images jsonb DEFAULT '[]';
