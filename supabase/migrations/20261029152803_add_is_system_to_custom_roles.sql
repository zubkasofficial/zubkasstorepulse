/*
# Add is_system flag to custom_roles

Plain English: Roles now carry an `is_system` flag that marks the four built-in roles (Admin, Store Manager, Cashier, Delivery Driver). The app reads this flag to decide which roles can be edited or deleted.

1. Modified table
- `custom_roles`: new column `is_system` (boolean, not null, default false).

2. Data
- Existing rows copy their current `is_builtin` value into `is_system`. No rows are removed or renamed.
- The older `is_builtin` column is left in place so no data is discarded.

3. Security
- No change to row level security or grants. Existing policies still apply.

4. Notes
- New custom roles insert with `is_system = false` by default.
*/

ALTER TABLE custom_roles ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

UPDATE custom_roles SET is_system = is_builtin WHERE is_system IS DISTINCT FROM is_builtin;
