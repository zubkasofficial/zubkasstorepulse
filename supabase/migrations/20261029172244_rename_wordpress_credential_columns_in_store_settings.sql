/*
# Rename WordPress credential columns in store settings

Plain-English summary: the two columns that hold the WordPress username and application password are renamed to their full, clearer names. Any values already saved are kept.

1. Modified table
- `store_settings`
  - `wp_username` is renamed to `wordpress_username`.
  - `wp_app_password` is renamed to `wordpress_application_password`.

2. Security
- No policy or grant changes. The renamed columns keep the same access rules as before.

3. Notes
- The rename is conditional, so running this migration again does nothing.
- If a column is missing entirely, it is added with an empty default so saving never fails.
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'wp_username') THEN
    ALTER TABLE store_settings RENAME COLUMN wp_username TO wordpress_username;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'store_settings' AND column_name = 'wp_app_password') THEN
    ALTER TABLE store_settings RENAME COLUMN wp_app_password TO wordpress_application_password;
  END IF;
END $$;

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS wordpress_username text NOT NULL DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS wordpress_application_password text NOT NULL DEFAULT '';
