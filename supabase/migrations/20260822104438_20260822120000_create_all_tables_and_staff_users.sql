
-- ===== store_profile =====
CREATE TABLE IF NOT EXISTS store_profile (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  business_name text NOT NULL DEFAULT 'Zubkas',
  support_phone text NOT NULL DEFAULT '+91 9876543210',
  support_email text NOT NULL DEFAULT 'support@zubkas.com',
  store_address text NOT NULL DEFAULT '78, Main Bazaar, Salem, Tamil Nadu - 636006',
  gstin text NOT NULL DEFAULT '',
  logo_url text NOT NULL DEFAULT '/zubkas-logo.png',
  app_mode text NOT NULL DEFAULT 'standalone',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE store_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_store_profile" ON store_profile;
CREATE POLICY "anon_select_store_profile" ON store_profile FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_store_profile" ON store_profile;
CREATE POLICY "anon_insert_store_profile" ON store_profile FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_store_profile" ON store_profile;
CREATE POLICY "anon_update_store_profile" ON store_profile FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_store_profile" ON store_profile;
CREATE POLICY "anon_delete_store_profile" ON store_profile FOR DELETE
  TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS store_profile_updated_at ON store_profile;
CREATE TRIGGER store_profile_updated_at
  BEFORE UPDATE ON store_profile
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== staff_users (the table the app code references) =====
CREATE TABLE IF NOT EXISTS staff_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  password text NOT NULL,
  role text NOT NULL DEFAULT 'cashier',
  phone text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE staff_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_staff_users" ON staff_users;
CREATE POLICY "anon_select_staff_users" ON staff_users FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_staff_users" ON staff_users;
CREATE POLICY "anon_insert_staff_users" ON staff_users FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_staff_users" ON staff_users;
CREATE POLICY "anon_update_staff_users" ON staff_users FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_staff_users" ON staff_users;
CREATE POLICY "anon_delete_staff_users" ON staff_users FOR DELETE
  TO anon, authenticated USING (true);

DROP TRIGGER IF EXISTS staff_users_updated_at ON staff_users;
CREATE TRIGGER staff_users_updated_at
  BEFORE UPDATE ON staff_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== otp_verifications =====
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

-- ===== products =====
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text NOT NULL,
  category text NOT NULL DEFAULT 'Uncategorized',
  regular_price numeric NOT NULL DEFAULT 0,
  sale_price numeric,
  stock_quantity integer NOT NULL DEFAULT 0,
  stock_status text NOT NULL DEFAULT 'instock',
  categories text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  images jsonb DEFAULT '[]',
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE
  TO anon, authenticated USING (true);

DROP TRIGGER IF EXISTS products_updated_at ON products;
CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS products_sku_idx ON products(sku);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);

-- ===== pos_sales =====
CREATE TABLE IF NOT EXISTS pos_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_name text NOT NULL DEFAULT 'Walk-in Customer',
  customer_phone text NOT NULL DEFAULT '',
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  payment_method_title text NOT NULL DEFAULT 'Cash',
  cashier_name text NOT NULL DEFAULT 'Cashier',
  status text NOT NULL DEFAULT 'Completed',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pos_sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pos_sales" ON pos_sales;
CREATE POLICY "anon_select_pos_sales" ON pos_sales FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_pos_sales" ON pos_sales;
CREATE POLICY "anon_insert_pos_sales" ON pos_sales FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_pos_sales" ON pos_sales;
CREATE POLICY "anon_update_pos_sales" ON pos_sales FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_pos_sales" ON pos_sales;
CREATE POLICY "anon_delete_pos_sales" ON pos_sales FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS pos_sales_created_at_idx ON pos_sales(created_at DESC);

-- ===== pos_sale_items =====
CREATE TABLE IF NOT EXISTS pos_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES pos_sales(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pos_sale_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_pos_sale_items" ON pos_sale_items;
CREATE POLICY "anon_select_pos_sale_items" ON pos_sale_items FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_pos_sale_items" ON pos_sale_items;
CREATE POLICY "anon_insert_pos_sale_items" ON pos_sale_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_pos_sale_items" ON pos_sale_items;
CREATE POLICY "anon_update_pos_sale_items" ON pos_sale_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_pos_sale_items" ON pos_sale_items;
CREATE POLICY "anon_delete_pos_sale_items" ON pos_sale_items FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS pos_sale_items_sale_id_idx ON pos_sale_items(sale_id);

-- ===== orders =====
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  customer_name text NOT NULL DEFAULT 'Walk-in Customer',
  customer_email text NOT NULL DEFAULT '',
  customer_phone text NOT NULL DEFAULT '',
  billing_address text NOT NULL DEFAULT 'POS Counter',
  shipping_address text NOT NULL DEFAULT 'POS Counter',
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  tax numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  payment_method text NOT NULL DEFAULT 'cash',
  payment_method_title text NOT NULL DEFAULT 'Cash',
  payment_status text NOT NULL DEFAULT 'Paid',
  transaction_id text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Completed',
  source text NOT NULL DEFAULT 'pos',
  cashier_name text NOT NULL DEFAULT 'Cashier',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE
  TO anon, authenticated USING (true);

DROP TRIGGER IF EXISTS orders_updated_at ON orders;
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS orders_order_number_idx ON orders(order_number);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders(status);

-- ===== order_items =====
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  quantity integer NOT NULL,
  unit_price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_order_items" ON order_items;
CREATE POLICY "anon_select_order_items" ON order_items FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_order_items" ON order_items;
CREATE POLICY "anon_insert_order_items" ON order_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_order_items" ON order_items;
CREATE POLICY "anon_update_order_items" ON order_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_order_items" ON order_items;
CREATE POLICY "anon_delete_order_items" ON order_items FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items(order_id);

-- ===== customers =====
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  location text NOT NULL DEFAULT '—',
  orders_count integer NOT NULL DEFAULT 0,
  total_spent numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE
  TO anon, authenticated USING (true);

DROP TRIGGER IF EXISTS customers_updated_at ON customers;
CREATE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS customers_email_idx ON customers(email);
CREATE INDEX IF NOT EXISTS customers_phone_idx ON customers(phone);

-- ===== coupons =====
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  discount_type text NOT NULL DEFAULT 'percent',
  amount numeric NOT NULL DEFAULT 0,
  minimum_amount numeric NOT NULL DEFAULT 0,
  usage_limit integer NOT NULL DEFAULT 0,
  usage_count integer NOT NULL DEFAULT 0,
  date_expires date,
  free_shipping boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_coupons" ON coupons;
CREATE POLICY "anon_select_coupons" ON coupons FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_coupons" ON coupons;
CREATE POLICY "anon_insert_coupons" ON coupons FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_coupons" ON coupons;
CREATE POLICY "anon_update_coupons" ON coupons FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_coupons" ON coupons;
CREATE POLICY "anon_delete_coupons" ON coupons FOR DELETE
  TO anon, authenticated USING (true);

DROP TRIGGER IF EXISTS coupons_updated_at ON coupons;
CREATE TRIGGER coupons_updated_at
  BEFORE UPDATE ON coupons
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX IF NOT EXISTS coupons_code_idx ON coupons(code);

-- ===== delivery_staff =====
CREATE TABLE IF NOT EXISTS delivery_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL DEFAULT '',
  vehicle text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'Active',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE delivery_staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_delivery_staff" ON delivery_staff;
CREATE POLICY "anon_select_delivery_staff" ON delivery_staff FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_delivery_staff" ON delivery_staff;
CREATE POLICY "anon_insert_delivery_staff" ON delivery_staff FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_delivery_staff" ON delivery_staff;
CREATE POLICY "anon_update_delivery_staff" ON delivery_staff FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_delivery_staff" ON delivery_staff;
CREATE POLICY "anon_delete_delivery_staff" ON delivery_staff FOR DELETE
  TO anon, authenticated USING (true);

-- ===== courier_partners =====
CREATE TABLE IF NOT EXISTS courier_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tracking_url_template text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE courier_partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_courier_partners" ON courier_partners;
CREATE POLICY "anon_select_courier_partners" ON courier_partners FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_courier_partners" ON courier_partners;
CREATE POLICY "anon_insert_courier_partners" ON courier_partners FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_courier_partners" ON courier_partners;
CREATE POLICY "anon_update_courier_partners" ON courier_partners FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_courier_partners" ON courier_partners;
CREATE POLICY "anon_delete_courier_partners" ON courier_partners FOR DELETE
  TO anon, authenticated USING (true);

-- ===== seed admin user =====
INSERT INTO staff_users (name, email, password, role, phone, is_active)
SELECT 'Zubkas Admin', 'admin@zubkas.com', 'admin123', 'admin', '+91 9876543210', true
WHERE NOT EXISTS (SELECT 1 FROM staff_users LIMIT 1);
