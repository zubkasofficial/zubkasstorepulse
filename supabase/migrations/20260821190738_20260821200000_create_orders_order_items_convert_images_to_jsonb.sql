/*
# Create orders & order_items tables, convert products.images to jsonb

1. Purpose
   The app is moving fully to Supabase ("Pure Cloud Mode"), removing all
   WooCommerce dependencies. This migration adds the missing `orders` and
   `order_items` tables and converts the `products.images` column from text
   to jsonb so product images can be stored as an array of Base64 data URLs
   or external links.

2. New Tables
   - `orders` — order_number, customer info, totals, payment, status, source
   - `order_items` — order_id, product_id, product_name, quantity, unit_price

3. Modified Tables
   - `products`: convert `images` from text to jsonb (nullable, default '[]').

4. Security: RLS + anon CRUD on orders and order_items.

5. Notes: Idempotent. Non-destructive image conversion.
*/

-- ===== Convert products.images to jsonb =====
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT data_type INTO col_type
  FROM information_schema.columns
  WHERE table_name = 'products' AND column_name = 'images';

  IF col_type = 'text' THEN
    UPDATE products SET images = '[]' WHERE images = '' OR images IS NULL;
    UPDATE products SET images = jsonb_build_array(images::text) WHERE images <> '' AND images IS NOT NULL;
    ALTER TABLE products ALTER COLUMN images DROP DEFAULT;
    ALTER TABLE products ALTER COLUMN images TYPE jsonb USING images::jsonb;
    ALTER TABLE products ALTER COLUMN images SET DEFAULT '[]'::jsonb;
    ALTER TABLE products ALTER COLUMN images DROP NOT NULL;
  END IF;
END $$;

-- ===== orders =====
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_name text NOT NULL DEFAULT 'Walk-in Customer',
  customer_email text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  billing_address text NOT NULL DEFAULT 'POS Counter',
  shipping_address text NOT NULL DEFAULT 'POS Counter',
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  payment_method_title text NOT NULL DEFAULT 'Cash',
  payment_status text NOT NULL DEFAULT 'Paid',
  transaction_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Completed',
  source text NOT NULL DEFAULT 'pos',
  cashier_name text NOT NULL DEFAULT 'Cashier',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE
  TO anon, authenticated USING (true);

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_order_number_idx ON orders(order_number);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);

-- ===== order_items =====
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_order_items" ON order_items;
CREATE POLICY "anon_select_order_items" ON order_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_order_items" ON order_items;
CREATE POLICY "anon_insert_order_items" ON order_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_order_items" ON order_items;
CREATE POLICY "anon_update_order_items" ON order_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_order_items" ON order_items;
CREATE POLICY "anon_delete_order_items" ON order_items FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);
