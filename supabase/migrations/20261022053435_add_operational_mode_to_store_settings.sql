ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS operational_mode text NOT NULL DEFAULT 'standalone';
