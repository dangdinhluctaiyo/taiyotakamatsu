-- Supabase Schema for TaiyoTakamatsu Rental System (Optimized)

-- Staff table
CREATE TABLE IF NOT EXISTS staff (
  id SERIAL PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'staff',
  active BOOLEAN DEFAULT true
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50)
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  code VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100) DEFAULT 'Khác',
  price_per_day DECIMAL(12,2) DEFAULT 0,
  total_owned INTEGER DEFAULT 0,
  current_physical_stock INTEGER DEFAULT 0,
  image_url TEXT,
  images JSONB DEFAULT '[]',
  location VARCHAR(255),
  specs TEXT
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  rental_start_date DATE NOT NULL,
  expected_return_date DATE NOT NULL,
  actual_return_date DATE,
  status VARCHAR(50) DEFAULT 'BOOKED',
  total_amount DECIMAL(12,2) DEFAULT 0,
  final_amount DECIMAL(12,2),
  note TEXT,
  completed_by VARCHAR(255)
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id),
  quantity INTEGER NOT NULL,
  is_external BOOLEAN DEFAULT false,
  supplier_id INTEGER,
  exported_quantity INTEGER DEFAULT 0,
  returned_quantity INTEGER DEFAULT 0,
  note TEXT
);

-- Inventory logs table
CREATE TABLE IF NOT EXISTS inventory_logs (
  id SERIAL PRIMARY KEY,
  product_id INTEGER REFERENCES products(id),
  order_id INTEGER REFERENCES orders(id),
  action_type VARCHAR(50) NOT NULL,
  quantity INTEGER NOT NULL,
  staff_id INTEGER,
  staff_name VARCHAR(255),
  note TEXT,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_order ON inventory_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_products_code ON products(code);

-- Insert default admin user
INSERT INTO staff (username, password, name, role, active) 
VALUES ('admin', 'admin123', 'Administrator', 'admin', true)
ON CONFLICT (username) DO NOTHING;

-- Insert default staff user
INSERT INTO staff (username, password, name, role, active) 
VALUES ('nhanvien1', '123456', 'Nhân viên 1', 'staff', true)
ON CONFLICT (username) DO NOTHING;

-- Enable Row Level Security (optional - for production)
-- ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE products ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE inventory_logs ENABLE ROW LEVEL SECURITY;
