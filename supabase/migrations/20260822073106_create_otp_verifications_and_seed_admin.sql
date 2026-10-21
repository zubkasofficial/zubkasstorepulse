-- 1. Create otp_verifications table for OTP login flow
CREATE TABLE IF NOT EXISTS otp_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  otp_code text NOT NULL,
  expires_at timestamptz NOT NULL,
  is_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE otp_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_otp" ON otp_verifications;
CREATE POLICY "anon_select_otp" ON otp_verifications FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_otp" ON otp_verifications;
CREATE POLICY "anon_insert_otp" ON otp_verifications FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_otp" ON otp_verifications;
CREATE POLICY "anon_update_otp" ON otp_verifications FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_otp" ON otp_verifications;
CREATE POLICY "anon_delete_otp" ON otp_verifications FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_otp_email ON otp_verifications(email);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON otp_verifications(expires_at);

-- 2. Seed an admin user if none exists
INSERT INTO store_users (id, name, email, password, role, phone, status)
SELECT 'admin-master', 'Zubkas Admin', 'admin@zubkas.com', 'admin123', 'admin', '+91 9876543210', 'active'
WHERE NOT EXISTS (SELECT 1 FROM store_users LIMIT 1);
