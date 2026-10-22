/*
# Create store_settings table for WooCommerce credentials

1. Purpose
   - Centralizes WooCommerce API credentials (store_url, consumer_key, consumer_secret)
   - Allows any device/browser to fetch credentials on app startup and auto-connect
   - Replaces the per-device localStorage-only approach with cloud-synced credentials

2. New Tables
   - `store_settings`
     - `id` (smallint, primary key, fixed to 1 — singleton row)
     - `store_url` (text) — WooCommerce store URL
     - `consumer_key` (text) — WooCommerce REST API consumer key
     - `consumer_secret` (text) — WooCommerce REST API consumer secret
     - `connected_at` (timestamptz) — when the connection was first established
     - `updated_at` (timestamptz) — last update timestamp

3. Security
   - RLS enabled on `store_settings`
   - Full CRUD access for `anon, authenticated` since this is shared store configuration
     used by the app's anon-key client to auto-connect on any browser/device.
*/

CREATE TABLE IF NOT EXISTS store_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_url text NOT NULL DEFAULT '',
  consumer_key text NOT NULL DEFAULT '',
  consumer_secret text NOT NULL DEFAULT '',
  connected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_store_settings" ON store_settings;
CREATE POLICY "anon_select_store_settings" ON store_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_store_settings" ON store_settings;
CREATE POLICY "anon_insert_store_settings" ON store_settings FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_store_settings" ON store_settings;
CREATE POLICY "anon_update_store_settings" ON store_settings FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_store_settings" ON store_settings;
CREATE POLICY "anon_delete_store_settings" ON store_settings FOR DELETE
  TO anon, authenticated USING (true);
