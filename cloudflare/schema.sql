-- Staff table
CREATE TABLE IF NOT EXISTS staff (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'staff',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  category TEXT DEFAULT 'Khác',
  price_per_day INTEGER DEFAULT 0,
  total_owned INTEGER DEFAULT 0,
  current_physical_stock INTEGER DEFAULT 0,
  image_url TEXT,
  images TEXT, -- JSON array of image URLs
  location TEXT,
  specs TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Customers table
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  rental_start_date TEXT NOT NULL,
  expected_return_date TEXT NOT NULL,
  actual_return_date TEXT,
  status TEXT DEFAULT 'BOOKED',
  total_amount INTEGER DEFAULT 0,
  final_amount INTEGER,
  completed_by TEXT,
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Order items table
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER DEFAULT 1,
  is_external INTEGER DEFAULT 0,
  supplier_id INTEGER,
  exported_quantity INTEGER DEFAULT 0,
  returned_quantity INTEGER DEFAULT 0,
  returned_at TEXT,
  returned_by TEXT,
  note TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Inventory logs table
CREATE TABLE IF NOT EXISTS inventory_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  order_id INTEGER,
  action_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  staff_id INTEGER,
  staff_name TEXT,
  note TEXT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Insert default admin user
INSERT OR IGNORE INTO staff (username, password, name, role) VALUES ('admin', 'admin123', 'Quản trị viên', 'admin');
INSERT OR IGNORE INTO staff (username, password, name, role) VALUES ('nhanvien1', '123456', 'Nguyễn Văn A', 'staff');
