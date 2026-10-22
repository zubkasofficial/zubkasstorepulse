/*
# Add is_connected column to store_settings

1. Purpose
   - Track connection state explicitly so disconnect can set it to false
   - Other devices can check this flag to know if credentials are intentionally cleared

2. Changes
   - Add `is_connected` boolean column (default true) to `store_settings`
*/

ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS is_connected boolean NOT NULL DEFAULT false;
