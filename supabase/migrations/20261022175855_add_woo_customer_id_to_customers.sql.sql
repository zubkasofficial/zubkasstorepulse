/*
# Add woo_customer_id column to customers table

## Purpose
Enables two-way sync between WooCommerce customers and Supabase customers.
When WooCommerce customers are upserted into the `customers` table, their
WooCommerce ID is stored in `woo_customer_id` so subsequent syncs can match
and update the same row instead of creating duplicates.

## Modified Tables
- `customers`: adds `woo_customer_id` (integer, nullable) column.
  - Null for standalone-mode customers (no WooCommerce link).
  - Set to the WooCommerce customer ID for customers synced from WooCommerce.

## Indexes
- `customers_woo_customer_id_idx` on `customers(woo_customer_id)` — partial
  unique index so only non-null WooCommerce IDs are unique. This prevents
  duplicate sync entries while allowing multiple null values for standalone
  customers.

## Security
- No policy changes needed — the existing CRUD policies on `customers` already
  allow `anon, authenticated` full access (single-tenant, no-auth app).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'woo_customer_id'
  ) THEN
    ALTER TABLE customers ADD COLUMN woo_customer_id integer;
  END IF;
END $$;

-- Partial unique index: only enforce uniqueness for non-null WooCommerce IDs
DROP INDEX IF EXISTS customers_woo_customer_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS customers_woo_customer_id_key
  ON customers (woo_customer_id) WHERE woo_customer_id IS NOT NULL;
