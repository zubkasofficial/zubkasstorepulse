/*
# Create categories table for dynamic product categorization

## Purpose
Adds a `categories` table to Supabase so product categories are managed dynamically
(added, viewed, deleted) from the Products page instead of being hardcoded.
The Add Product modal dropdown now fetches categories from this table.

## New Tables
- `categories`
  - `id` (uuid, primary key, default gen_random_uuid()) — unique category identifier
  - `name` (text, not null) — human-readable category name (e.g. "Electronics")
  - `slug` (text, not null) — URL-safe slug auto-generated from the name (e.g. "electronics")
  - `created_at` (timestamptz, default now()) — when the category was created

## Security
- Row Level Security is ENABLED on `categories`.
- CRUD access granted to both `anon` and `authenticated` roles, because this app
  uses the anon-key client and the category data is intentionally shared across
  the store (single-tenant, no per-user isolation needed).
- Four separate policies (SELECT / INSERT / UPDATE / DELETE) use `USING (true)` /
  `WITH CHECK (true)` — appropriate here because all store operators share the
  same category list.

## Indexes
- Unique index on `slug` to prevent duplicate slugs.
- Unique index on `name` to prevent duplicate category names.

## Notes
1. This table is independent of the `products` table — products store the
   category name as a text field, so no foreign key constraint is added to avoid
   breaking existing product rows.
2. The migration is idempotent: `CREATE TABLE IF NOT EXISTS` and `DROP POLICY IF
   EXISTS` before each `CREATE POLICY` make it safe to re-run.
*/

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Prevent duplicate slugs and names
CREATE UNIQUE INDEX IF NOT EXISTS categories_slug_key ON categories (slug);
CREATE UNIQUE INDEX IF NOT EXISTS categories_name_key ON categories (name);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO anon, authenticated;

DROP POLICY IF EXISTS "anon_select_categories" ON categories;
CREATE POLICY "anon_select_categories" ON categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
CREATE POLICY "anon_insert_categories" ON categories FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_categories" ON categories;
CREATE POLICY "anon_update_categories" ON categories FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_categories" ON categories;
CREATE POLICY "anon_delete_categories" ON categories FOR DELETE
  TO anon, authenticated USING (true);
