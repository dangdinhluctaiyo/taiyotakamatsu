import Database from 'better-sqlite3';
import { Product, Customer, Supplier, Order, OrderItem, InventoryLog, OrderStatus } from './types.js';

const db = new Database('lucrental.db');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    pricePerDay REAL DEFAULT 0,
    pricePerWeek REAL DEFAULT 0,
    pricePerMonth REAL DEFAULT 0,
    unit TEXT,
    isSerialized INTEGER DEFAULT 0,
    totalOwned INTEGER DEFAULT 0,
    currentPhysicalStock INTEGER DEFAULT 0,
    imageUrl TEXT,
    images TEXT,
    location TEXT,
    specs TEXT
  );

  CREATE TABLE IF NOT EXISTS warehouses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT
  );

  CREATE TABLE IF NOT EXISTS stocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    warehouseId INTEGER NOT NULL,
    availableQty INTEGER DEFAULT 0,
    reservedQty INTEGER DEFAULT 0,
    onRentQty INTEGER DEFAULT 0,
    dirtyQty INTEGER DEFAULT 0,
    brokenQty INTEGER DEFAULT 0,
    FOREIGN KEY (productId) REFERENCES products(id),
    FOREIGN KEY (warehouseId) REFERENCES warehouses(id)
  );

  CREATE TABLE IF NOT EXISTS device_serials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    serialNumber TEXT NOT NULL,
    warehouseId INTEGER NOT NULL,
    status TEXT DEFAULT 'AVAILABLE',
    orderId INTEGER,
    FOREIGN KEY (productId) REFERENCES products(id),
    FOREIGN KEY (warehouseId) REFERENCES warehouses(id)
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT
  );

  CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    contact TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customerId INTEGER NOT NULL,
    rentalStartDate TEXT NOT NULL,
    expectedReturnDate TEXT NOT NULL,
    actualReturnDate TEXT,
    status TEXT DEFAULT 'BOOKED',
    totalAmount REAL DEFAULT 0,
    FOREIGN KEY (customerId) REFERENCES customers(id)
  );

  CREATE TABLE IF NOT EXISTS order_items (
    itemId TEXT PRIMARY KEY,
    orderId INTEGER NOT NULL,
    productId INTEGER NOT NULL,
    quantity INTEGER DEFAULT 0,
    isExternal INTEGER DEFAULT 0,
    supplierId INTEGER,
    costPrice REAL,
    exportedQuantity INTEGER DEFAULT 0,
    returnedQuantity INTEGER DEFAULT 0,
    FOREIGN KEY (orderId) REFERENCES orders(id),
    FOREIGN KEY (productId) REFERENCES products(id)
  );

  CREATE TABLE IF NOT EXISTS inventory_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    productId INTEGER NOT NULL,
    orderId INTEGER,
    actionType TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    timestamp TEXT NOT NULL,
    note TEXT,
    FOREIGN KEY (productId) REFERENCES products(id)
  );
`);

// Seed initial data if empty
const productCount = db.prepare('SELECT COUNT(*) as count FROM products').get() as { count: number };
if (productCount.count === 0) {
  const insertProduct = db.prepare(`
    INSERT INTO products (code, name, category, pricePerDay, totalOwned, currentPhysicalStock, imageUrl, isSerialized)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertProduct.run('GHE-HP01', 'Ghế Chiavari Gold', 'Bàn ghế', 50000, 100, 100, 'https://picsum.photos/200/200?random=1', 0);
  insertProduct.run('LED-P3', 'Màn hình LED P3', 'Âm thanh AS', 800000, 20, 20, 'https://picsum.photos/200/200?random=2', 0);
  insertProduct.run('LOA-JBL', 'Loa JBL Full Range', 'Âm thanh AS', 500000, 10, 10, 'https://picsum.photos/200/200?random=3', 0);

  const insertCustomer = db.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)');
  insertCustomer.run('Anh Lực', '0909123456');
  insertCustomer.run('Công ty Sự Kiện Việt', '0912345678');

  const insertSupplier = db.prepare('INSERT INTO suppliers (name, contact) VALUES (?, ?)');
  insertSupplier.run('Kho Âm Thanh Giá Rẻ', 'Mr. Tuấn');
  insertSupplier.run('Bàn Ghế Sài Gòn', 'Ms. Lan');
}

// Ensure default warehouse exists
const warehouseCount = db.prepare('SELECT COUNT(*) as count FROM warehouses').get() as { count: number };
if (warehouseCount.count === 0) {
  db.prepare('INSERT INTO warehouses (name, address) VALUES (?, ?)').run('Kho Chính', '123 Đường ABC');
}

// Migrate existing products to stocks if not already present
const defaultWarehouse = db.prepare('SELECT id FROM warehouses LIMIT 1').get() as { id: number };
const products = db.prepare('SELECT id, totalOwned FROM products').all() as { id: number, totalOwned: number }[];

const insertStock = db.prepare(`
  INSERT INTO stocks (productId, warehouseId, availableQty, reservedQty, onRentQty, dirtyQty, brokenQty)
  VALUES (?, ?, ?, 0, 0, 0, 0)
`);

const checkStock = db.prepare('SELECT id FROM stocks WHERE productId = ? AND warehouseId = ?');

for (const product of products) {
  const existingStock = checkStock.get(product.id, defaultWarehouse.id);
  if (!existingStock) {
    insertStock.run(product.id, defaultWarehouse.id, product.totalOwned);
  }
}

// Migration: Add orderId to device_serials if not exists
try {
  db.prepare('ALTER TABLE device_serials ADD COLUMN orderId INTEGER').run();
} catch (e: any) {
  // Ignore if column already exists
  if (!e.message.includes('duplicate column name')) {
    console.error('Migration error:', e);
  }
}

export default db;
