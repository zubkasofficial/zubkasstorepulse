/*
# Add WordPress upload credentials to store settings

Plain-English summary: the WooCommerce connection can now also remember a WordPress username and application password. These let the app upload product photos straight into the WordPress media library.

1. Modified table
- `store_settings`
  - `wp_username` (text, default empty string): WordPress account used for media uploads.
  - `wp_app_password` (text, default empty string): WordPress application password for that account.

2. Security
- No new tables, policies, or grants. The new columns inherit the existing access rules of `store_settings`.

3. Notes
- Both columns are additive and default to empty, so existing connections keep working unchanged.
- Uploads are skipped with a clear message until both values are entered.
*/

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS wp_username text NOT NULL DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS wp_app_password text NOT NULL DEFAULT '';
