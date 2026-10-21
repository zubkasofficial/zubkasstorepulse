/*
# Create woo_credentials table for cross-device WooCommerce credential sync

1. New Tables
- `woo_credentials` — stores the single shared WooCommerce connection (store_url, consumer_key, consumer_secret, connected_at).
  - `id` (smallint, primary key, fixed to 1) — singleton row pattern matching store_profile.
  - `store_url` (text) — the WooCommerce store base URL.
  - `consumer_key` (text) — WooCommerce REST API consumer key (ck_...).
  - `consumer_secret` (text) — WooCommerce REST API consumer secret (cs_...).
  - `connected_at` (timestamptz) — when the connection was last established/updated.
  - `updated_at` (timestamptz) — auto-updated timestamp.

2. Security
- Enable RLS on `woo_credentials`.
- Allow anon + authenticated CRUD (single-tenant shared-data app, matching all other tables).
- Policies: select / insert / update / delete, all `USING (true)` / `WITH CHECK (true)`.

3. Notes
- This table holds exactly one row (id = 1). The app upserts into this row on connect
  and clears it on disconnect, so all devices see the same WooCommerce credentials.
*/

CREATE TABLE IF NOT EXISTS woo_credentials (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  store_url text NOT NULL DEFAULT '',
  consumer_key text NOT NULL DEFAULT '',
  consumer_secret text NOT NULL DEFAULT '',
  connected_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE woo_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_woo_credentials" ON woo_credentials;
CREATE POLICY "anon_select_woo_credentials"
ON woo_credentials FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_woo_credentials" ON woo_credentials;
CREATE POLICY "anon_insert_woo_credentials"
ON woo_credentials FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_woo_credentials" ON woo_credentials;
CREATE POLICY "anon_update_woo_credentials"
ON woo_credentials FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_woo_credentials" ON woo_credentials;
CREATE POLICY "anon_delete_woo_credentials"
ON woo_credentials FOR DELETE
TO anon, authenticated USING (true);
