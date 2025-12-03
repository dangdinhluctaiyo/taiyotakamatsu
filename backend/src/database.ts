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
    totalOwned INTEGER DEFAULT 0,
    currentPhysicalStock INTEGER DEFAULT 0,
    imageUrl TEXT,
    images TEXT,
    location TEXT,
    specs TEXT
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
    INSERT INTO products (code, name, category, pricePerDay, totalOwned, currentPhysicalStock, imageUrl)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertProduct.run('GHE-HP01', 'Ghế Chiavari Gold', 'Bàn ghế', 50000, 100, 100, 'https://picsum.photos/200/200?random=1');
  insertProduct.run('LED-P3', 'Màn hình LED P3', 'Âm thanh AS', 800000, 20, 20, 'https://picsum.photos/200/200?random=2');
  insertProduct.run('LOA-JBL', 'Loa JBL Full Range', 'Âm thanh AS', 500000, 10, 10, 'https://picsum.photos/200/200?random=3');

  const insertCustomer = db.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)');
  insertCustomer.run('Anh Lực', '0909123456');
  insertCustomer.run('Công ty Sự Kiện Việt', '0912345678');

  const insertSupplier = db.prepare('INSERT INTO suppliers (name, contact) VALUES (?, ?)');
  insertSupplier.run('Kho Âm Thanh Giá Rẻ', 'Mr. Tuấn');
  insertSupplier.run('Bàn Ghế Sài Gòn', 'Ms. Lan');
}

export default db;
