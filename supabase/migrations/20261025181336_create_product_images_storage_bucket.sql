/*
# Create product-images storage bucket

1. Purpose
- A public storage bucket for product images uploaded from the POS UI.
- Local file uploads (drag-and-drop / file picker) are stored here, and the
  resulting public https URL is handed to the WooCommerce product API (which
  cannot accept Base64 data URLs — it returns "No URL Provided").
- In standalone mode the same public URL is stored in products.image_url /
  gallery_images so product rows stay small.

2. Storage changes
- Create bucket `product-images` if it does not exist, marked public.
- Storage RLS policies (storage.objects):
  - SELECT (anon, authenticated): anyone can read product images.
  - INSERT (anon, authenticated): app can upload new images.
  - UPDATE (anon, authenticated): app can overwrite images.
  - DELETE (anon, authenticated): app can remove images.

3. Important notes
- This is a single-tenant, no-auth app: the anon key is used by the browser,
  so policies MUST include `anon`. `USING (true)` / `WITH CHECK (true)` is
  acceptable here because product images are intentionally public/shared.
- Bucket is public so the returned public URL renders in <img> tags without
  a signed-URL step.
*/

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- SELECT: read any object in the bucket
DROP POLICY IF EXISTS "anon_select_product_images" ON storage.objects;
CREATE POLICY "anon_select_product_images"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'product-images');

-- INSERT: upload new objects
DROP POLICY IF EXISTS "anon_insert_product_images" ON storage.objects;
CREATE POLICY "anon_insert_product_images"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'product-images');

-- UPDATE: overwrite existing objects
DROP POLICY IF EXISTS "anon_update_product_images" ON storage.objects;
CREATE POLICY "anon_update_product_images"
ON storage.objects FOR UPDATE
TO anon, authenticated
USING (bucket_id = 'product-images')
WITH CHECK (bucket_id = 'product-images');

-- DELETE: remove objects
DROP POLICY IF EXISTS "anon_delete_product_images" ON storage.objects;
CREATE POLICY "anon_delete_product_images"
ON storage.objects FOR DELETE
TO anon, authenticated
USING (bucket_id = 'product-images');