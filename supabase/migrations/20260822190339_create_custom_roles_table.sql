/*
# Create custom_roles table

1. New Tables
- `custom_roles`
  - `id` (uuid, primary key, auto-generated)
  - `name` (text, not null, unique) — role display name (e.g. "Inventory Manager")
  - `description` (text, not null default '') — short description of the role
  - `permissions` (jsonb, not null default '[]') — array of NavKey strings the role grants access to
  - `is_builtin` (boolean, not null default false) — whether this is a system-defined role
  - `created_at` (timestamptz, default now())

2. Purpose
Stores custom role definitions and their permission lists so that the Roles & Staff
page can manage roles in Supabase instead of localStorage. Built-in roles (Admin,
Store Manager, Cashier, Delivery Driver) are seeded here with is_builtin = true so
the UI can display them alongside user-created custom roles.

3. Security
- Enable RLS on `custom_roles`.
- This is a single-tenant admin portal app (no Supabase Auth sign-in screen; the app
  uses its own staff_users table for login). Policies use `TO anon, authenticated`
  with `USING (true)` / `WITH CHECK (true)` because the data is intentionally shared
  across all staff using the anon-key client — consistent with the existing tables
  (staff_users, products, orders, etc.).

4. Seed Data
Inserts the four built-in roles with their permission arrays so the Roles tab shows
them immediately. Uses ON CONFLICT (name) DO NOTHING so re-running is safe.
*/

CREATE TABLE IF NOT EXISTS custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  permissions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_builtin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE custom_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_custom_roles" ON custom_roles;
CREATE POLICY "anon_select_custom_roles" ON custom_roles FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_custom_roles" ON custom_roles;
CREATE POLICY "anon_insert_custom_roles" ON custom_roles FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_custom_roles" ON custom_roles;
CREATE POLICY "anon_update_custom_roles" ON custom_roles FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_custom_roles" ON custom_roles;
CREATE POLICY "anon_delete_custom_roles" ON custom_roles FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS custom_roles_name_idx ON custom_roles(name);

-- Seed built-in roles (idempotent via ON CONFLICT)
INSERT INTO custom_roles (name, description, permissions, is_builtin)
VALUES
  ('Admin', 'Full access to all features and settings',
    '["dashboard","pos","orders","products","customers","coupons","delivery","reports","staff-roles","settings"]'::jsonb, true),
  ('Store Manager', 'Dashboard, POS, orders, products, customers, coupons, and reports',
    '["dashboard","pos","orders","products","customers","coupons","delivery","reports","settings"]'::jsonb, true),
  ('Cashier', 'POS Terminal and Orders only',
    '["pos","orders"]'::jsonb, true),
  ('Delivery Driver', 'Delivery Hub only',
    '["delivery"]'::jsonb, true)
ON CONFLICT (name) DO NOTHING;