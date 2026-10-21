/*
# Create store_profile and store_users tables for cloud sync

1. Purpose
   The Zubkas StorePulse portal runs a localStorage-first model for store settings
   and staff accounts. This migration adds two cloud tables so the portal can
   optionally sync that data to Supabase when an admin connects their project
   from the Settings page. The app uses its own localStorage-based auth (not
   Supabase Auth), so this is a single-tenant setup: the anon-key frontend client
   needs full CRUD on both tables.

2. New Tables
   - `store_profile`
     - `id` (int2, primary key, fixed = 1) — singleton row pattern
     - `business_name` (text)
     - `support_phone` (text)
     - `support_email` (text)
     - `store_address` (text)
     - `gstin` (text)
     - `logo_url` (text)
     - `updated_at` (timestamptz, auto-updated)
   - `store_users`
     - `id` (text, primary key) — matches the app's local user id (e.g. "admin-master")
     - `name` (text)
     - `email` (text, unique)
     - `password` (text) — app-managed, not Supabase auth
     - `role` (text) — admin / manager / cashier / delivery
     - `phone` (text)
     - `status` (text) — active / inactive
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz, auto-updated)

3. Security
   - RLS enabled on both tables.
   - Both tables are intentionally shared/single-tenant (no Supabase auth sign-in),
     so all four CRUD policies use `TO anon, authenticated` with `USING (true)` /
     `WITH CHECK (true)`. This is documented as intentional: the anon-key client
     is the only caller and needs full access.

4. Notes
   - `store_profile` uses a CHECK constraint to keep exactly one row (id = 1).
   - `updated_at` auto-updates via trigger on both tables.
*/

CREATE TABLE IF NOT EXISTS store_profile (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  business_name text NOT NULL DEFAULT 'Zubkas',
  support_phone text NOT NULL DEFAULT '+91 9876543210',
  support_email text NOT NULL DEFAULT 'support@zubkas.com',
  store_address text NOT NULL DEFAULT '78, Main Bazaar, Salem, Tamil Nadu - 636006',
  gstin text NOT NULL DEFAULT '',
  logo_url text NOT NULL DEFAULT '/zubkas-logo.png',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE store_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_store_profile" ON store_profile;
CREATE POLICY "anon_select_store_profile" ON store_profile FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_store_profile" ON store_profile;
CREATE POLICY "anon_insert_store_profile" ON store_profile FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_store_profile" ON store_profile;
CREATE POLICY "anon_update_store_profile" ON store_profile FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_store_profile" ON store_profile;
CREATE POLICY "anon_delete_store_profile" ON store_profile FOR DELETE
  TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS store_profile_updated_at ON store_profile;
CREATE TRIGGER store_profile_updated_at
  BEFORE UPDATE ON store_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS store_users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  role text NOT NULL DEFAULT 'cashier',
  phone text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE store_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_store_users" ON store_users;
CREATE POLICY "anon_select_store_users" ON store_users FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_store_users" ON store_users;
CREATE POLICY "anon_insert_store_users" ON store_users FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_store_users" ON store_users;
CREATE POLICY "anon_update_store_users" ON store_users FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_store_users" ON store_users;
CREATE POLICY "anon_delete_store_users" ON store_users FOR DELETE
  TO anon, authenticated USING (true);

DROP TRIGGER IF EXISTS store_users_updated_at ON store_users;
CREATE TRIGGER store_users_updated_at
  BEFORE UPDATE ON store_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
