/*
# Create customers, coupons, delivery_staff, courier_partners tables + app_mode column

1. Purpose
   The Zubkas StorePulse portal needs cloud-backed storage for customers, coupons,
   delivery staff, and courier partners so data persists across devices and the
   POS terminal can record sales, decrement stock, and track customer history
   directly in Supabase. This migration adds four new tables and one column to
   the existing store_profile table. The app uses its own localStorage-based auth
   (not Supabase Auth), so this is a single-tenant setup: the anon-key frontend
   client needs full CRUD on all tables.

2. New Tables
   - `customers`
     - `id` (uuid, primary key)
     - `name` (text, not null)
     - `email` (text, nullable)
     - `phone` (text, nullable)
     - `location` (text, not null default '—')
     - `orders_count` (integer, not null default 0)
     - `total_spent` (numeric, not null default 0)
     - `created_at` (timestamptz, default now())
     - `updated_at` (timestamptz, auto-updated)
   - `coupons`
     - `id` (uuid, primary key)
     - `code` (text, unique, not null)
     - `discount_type` (text, not null default 'percent') — percent / fixed_cart / fixed_product
     - `amount` (numeric, not null default 0)
     - `minimum_amount` (numeric, not null default 0)
     - `usage_limit` (integer, not null default 0) — 0 = unlimited
     - `usage_count` (integer, not null default 0)
     - `date_expires` (date, nullable)
     - `free_shipping` (boolean, not null default false)
     - `created_at` (timestamptz, default now())
     - `updated_at` (timestamptz, auto-updated)
   - `delivery_staff`
     - `id` (uuid, primary key)
     - `name` (text, not null)
     - `phone` (text, not null default '')
     - `vehicle` (text, not null default '')
     - `status` (text, not null default 'Active') — Active / On Leave
     - `created_at` (timestamptz, default now())
   - `courier_partners`
     - `id` (uuid, primary key)
     - `name` (text, not null)
     - `tracking_url_template` (text, not null default '')
     - `created_at` (timestamptz, default now())

3. Modified Tables
   - `store_profile`: add `app_mode` (text, not null default 'standalone') column
     to persist the operational mode (standalone / woo) in the cloud.

4. Indexes
   - `customers_email_idx` on customers(email)
   - `customers_phone_idx` on customers(phone)
   - `coupons_code_idx` on coupons(code)

5. Security
   - RLS enabled on all four new tables.
   - All tables are intentionally shared/single-tenant (no Supabase auth sign-in),
     so all four CRUD policies use `TO anon, authenticated` with `USING (true)` /
     `WITH CHECK (true)`. This is documented as intentional: the anon-key client
     is the only caller and needs full access.

6. Notes
   - `updated_at` auto-updates via the existing `update_updated_at_column()` trigger
     function on `customers` and `coupons`.
   - `coupons.usage_limit` of 0 means unlimited (enforced in app layer).
   - `delivery_staff` and `courier_partners` do not have updated_at triggers since
     they are simple lookup tables.
*/

-- ===== customers =====
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  location text NOT NULL DEFAULT '—',
  orders_count integer NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE
  TO anon, authenticated USING (true);

DROP TRIGGER IF EXISTS customers_updated_at ON customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS customers_email_idx ON customers(email);
CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers(phone);

-- ===== coupons =====
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_type text NOT NULL DEFAULT 'percent',
  amount numeric NOT NULL DEFAULT 0,
  minimum_amount numeric NOT NULL DEFAULT 0,
  usage_limit integer NOT NULL DEFAULT 0,
  usage_count integer NOT NULL DEFAULT 0,
  date_expires date,
  free_shipping boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_coupons" ON coupons;
CREATE POLICY "anon_select_coupons" ON coupons FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_coupons" ON coupons;
CREATE POLICY "anon_insert_coupons" ON coupons FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_coupons" ON coupons;
CREATE POLICY "anon_update_coupons" ON coupons FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_coupons" ON coupons;
CREATE POLICY "anon_delete_coupons" ON coupons FOR DELETE
  TO anon, authenticated USING (true);

DROP TRIGGER IF EXISTS coupons_updated_at ON coupons;
CREATE TRIGGER coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS coupons_code_idx ON coupons(code);

-- ===== delivery_staff =====
CREATE TABLE IF NOT EXISTS delivery_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  vehicle text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_delivery_staff" ON delivery_staff;
CREATE POLICY "anon_select_delivery_staff" ON delivery_staff FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_delivery_staff" ON delivery_staff;
CREATE POLICY "anon_insert_delivery_staff" ON delivery_staff FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_delivery_staff" ON delivery_staff;
CREATE POLICY "anon_update_delivery_staff" ON delivery_staff FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_delivery_staff" ON delivery_staff;
CREATE POLICY "anon_delete_delivery_staff" ON delivery_staff FOR DELETE
  TO anon, authenticated USING (true);

-- ===== courier_partners =====
CREATE TABLE IF NOT EXISTS courier_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tracking_url_template text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE courier_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_courier_partners" ON courier_partners;
CREATE POLICY "anon_select_courier_partners" ON courier_partners FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_courier_partners" ON courier_partners;
CREATE POLICY "anon_insert_courier_partners" ON courier_partners FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_courier_partners" ON courier_partners;
CREATE POLICY "anon_update_courier_partners" ON courier_partners FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_courier_partners" ON courier_partners;
CREATE POLICY "anon_delete_courier_partners" ON courier_partners FOR DELETE
  TO anon, authenticated USING (true);

-- ===== store_profile: add app_mode column =====
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'store_profile' AND column_name = 'app_mode'
  ) THEN
    ALTER TABLE store_profile ADD COLUMN app_mode text NOT NULL DEFAULT 'standalone';
  END IF;
END $$;
