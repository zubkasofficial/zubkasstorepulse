/*
# Create deliveries table

1. Purpose
   - Tracks shipping/delivery info for orders (courier, AWB, tracking URL, estimated delivery, etc.)
   - Populated when an order is marked "Shipped" from the Orders page.
   - One delivery row per order, keyed by order_number (unique).

2. New Tables
   - `deliveries`
     - `id` (uuid, primary key)
     - `order_id` (uuid, nullable — FK to pos_sales.id OR orders.id, not enforced because either table may be the source)
     - `order_number` (text, not null, unique — e.g. "POS-713834")
     - `courier` (text, not null)
     - `awb` (text, not null — tracking number)
     - `tracking_url` (text, nullable)
     - `estimated_delivery` (text, nullable — date string)
     - `shipped_at` (timestamptz, not null)
     - `delivery_status` (text, not null default 'shipped' — shipped, out_for_delivery, delivered)
     - `staff_id` (uuid, nullable — assigned delivery driver)
     - `staff_name` (text, nullable)
     - `signature` (text, nullable — signature data URL on delivery completion)
     - `completed_at` (timestamptz, nullable)
     - `created_at` (timestamptz, default now())
     - `updated_at` (timestamptz, default now())

3. Security
   - Enable RLS on `deliveries`.
   - Grant CRUD to `anon, authenticated` so the anon-key frontend can read/write.
   - 4 CRUD policies (select/insert/update/delete) scoped to `anon, authenticated` with `USING (true)` because this is a single-tenant shared-data app (same pattern as all other tables in this project).

4. Notes
   - `order_id` is not a hard FK because standalone orders live in `pos_sales` while WooCommerce-synced orders may live in `orders`; we store whichever UUID we can resolve.
   - `order_number` is the reliable lookup key and is unique.
*/

CREATE TABLE IF NOT EXISTS deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid,
  order_number text NOT NULL UNIQUE,
  courier text NOT NULL DEFAULT '',
  awb text NOT NULL DEFAULT '',
  tracking_url text,
  estimated_delivery text,
  shipped_at timestamptz NOT NULL DEFAULT now(),
  delivery_status text NOT NULL DEFAULT 'shipped',
  staff_id uuid,
  staff_name text,
  signature text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON deliveries TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_deliveries" ON deliveries;
CREATE POLICY "anon_select_deliveries" ON deliveries FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_deliveries" ON deliveries;
CREATE POLICY "anon_insert_deliveries" ON deliveries FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_deliveries" ON deliveries;
CREATE POLICY "anon_update_deliveries" ON deliveries FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_deliveries" ON deliveries;
CREATE POLICY "anon_delete_deliveries" ON deliveries FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_deliveries_order_number ON deliveries (order_number);
