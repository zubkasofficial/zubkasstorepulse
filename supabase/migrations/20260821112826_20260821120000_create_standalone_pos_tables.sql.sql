/*
# Create standalone Cloud POS tables (products, pos_sales, pos_sale_items)

1. Purpose
   The portal runs in two operational modes:
     - "standalone" — Cloud POS backed by Supabase (no WooCommerce).
     - "woo" — live sync with a WooCommerce store via REST API.
   This migration adds the tables that power the "standalone" mode so the app
   can manage a product catalog and record POS sales/orders directly in the
   Supabase database. The app uses its own localStorage-based auth (not Supabase
   Auth), so this is a single-tenant setup: the anon-key frontend client needs
   full CRUD on all three tables.

2. New Tables
   - `products`
     - `id` (uuid, primary key)
     - `name` (text, not null)
     - `sku` (text, not null)
     - `category` (text, not null default 'Uncategorized')
     - `regular_price` (numeric, not null default 0)
     - `sale_price` (numeric, nullable)
     - `stock_quantity` (integer, not null default 0)
     - `image_url` (text, not null default '')
     - `description` (text, not null default '')
     - `created_at` (timestamptz, default now())
     - `updated_at` (timestamptz, auto-updated)
   - `pos_sales`
     - `id` (uuid, primary key)
     - `order_number` (text, unique) — human-friendly bill no (e.g. "POS-123456")
     - `customer_name` (text, not null default 'Walk-in Customer')
     - `customer_phone` (text, not null default '')
     - `subtotal` (numeric, not null default 0)
     - `discount` (numeric, not null default 0)
     - `tax` (numeric, not null default 0)
     - `total` (numeric, not null default 0)
     - `payment_method` (text, not null default 'cash')
     - `payment_method_title` (text, not null default 'Cash')
     - `cashier_name` (text, not null default 'Cashier')
     - `status` (text, not null default 'Completed')
     - `created_at` (timestamptz, default now())
   - `pos_sale_items`
     - `id` (uuid, primary key)
     - `sale_id` (uuid, references pos_sales(id) on delete cascade)
     - `product_id` (uuid, references products(id) on delete set null)
     - `product_name` (text, not null)
     - `quantity` (integer, not null)
     - `unit_price` (numeric, not null)

3. Indexes
   - `products_sku_idx` on products(sku)
   - `products_category_idx` on products(category)
   - `pos_sales_created_at_idx` on pos_sales(created_at desc)
   - `pos_sale_items_sale_id_idx` on pos_sale_items(sale_id)

4. Security
   - RLS enabled on all three tables.
   - All tables are intentionally shared/single-tenant (no Supabase auth
     sign-in), so all four CRUD policies use `TO anon, authenticated` with
     `USING (true)` / `WITH CHECK (true)`. The anon-key client is the only
     caller and needs full access.

5. Notes
   - `updated_at` auto-updates via the existing `update_updated_at_column()`
     trigger function (created in the store_profile migration) on `products`.
   - `pos_sales.order_number` is unique to keep bill numbers distinct.
   - Stock deductions are performed by the app layer (read product, compute
     new stock, update) since the anon client cannot use SECURITY DEFINER
     functions without a policy path; the app treats stock as the source of
     truth in `products.stock_quantity`.
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text NOT NULL,
  category text NOT NULL DEFAULT 'Uncategorized',
  regular_price numeric NOT NULL DEFAULT 0,
  sale_price numeric,
  stock_quantity integer NOT NULL DEFAULT 0,
  image_url text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE
  TO anon, authenticated USING (true);

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS products_sku_idx ON products(sku);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);

CREATE TABLE IF NOT EXISTS pos_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_name text NOT NULL DEFAULT 'Walk-in Customer',
  customer_phone text NOT NULL DEFAULT '',
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  payment_method_title text NOT NULL DEFAULT 'Cash',
  cashier_name text NOT NULL DEFAULT 'Cashier',
  status text NOT NULL DEFAULT 'Completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pos_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pos_sales" ON pos_sales;
CREATE POLICY "anon_select_pos_sales" ON pos_sales FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_pos_sales" ON pos_sales;
CREATE POLICY "anon_insert_pos_sales" ON pos_sales FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_pos_sales" ON pos_sales;
CREATE POLICY "anon_update_pos_sales" ON pos_sales FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_pos_sales" ON pos_sales;
CREATE POLICY "anon_delete_pos_sales" ON pos_sales FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS pos_sales_created_at_idx ON pos_sales(created_at DESC);

CREATE TABLE IF NOT EXISTS pos_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pos_sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pos_sale_items" ON pos_sale_items;
CREATE POLICY "anon_select_pos_sale_items" ON pos_sale_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_pos_sale_items" ON pos_sale_items;
CREATE POLICY "anon_insert_pos_sale_items" ON pos_sale_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_pos_sale_items" ON pos_sale_items;
CREATE POLICY "anon_update_pos_sale_items" ON pos_sale_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_pos_sale_items" ON pos_sale_items;
CREATE POLICY "anon_delete_pos_sale_items" ON pos_sale_items FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS pos_sale_items_sale_id_idx ON pos_sale_items(sale_id);
