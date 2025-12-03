import { Router } from 'express';
import db from '../database.js';
import { OrderItem, OrderStatus, Product } from '../types.js';

const router = Router();

// Get inventory logs
router.get('/logs', (req, res) => {
  const { productId } = req.query;
  if (productId) {
    res.json(db.prepare('SELECT * FROM inventory_logs WHERE productId = ? ORDER BY timestamp DESC').all(productId));
  } else {
    res.json(db.prepare('SELECT * FROM inventory_logs ORDER BY timestamp DESC').all());
  }
});

// Check availability
router.get('/availability', (req, res) => {
  const { productId, start, end } = req.query;
  if (!productId || !start || !end) {
    return res.status(400).json({ error: 'Missing productId, start, or end' });
  }

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as Product;
  if (!product) return res.status(404).json({ error: 'Product not found' });

  // Get busy quantity from overlapping orders
  const busyItems = db.prepare(`
    SELECT oi.quantity FROM order_items oi
    JOIN orders o ON oi.orderId = o.id
    WHERE oi.productId = ? AND oi.isExternal = 0
    AND o.status IN ('BOOKED', 'ACTIVE')
    AND o.rentalStartDate <= ? AND o.expectedReturnDate >= ?
  `).all(productId, end, start) as { quantity: number }[];

  const busyQuantity = busyItems.reduce((sum, i) => sum + i.quantity, 0);
  const available = Math.max(0, product.totalOwned - busyQuantity);

  res.json({ productId: Number(productId), available, totalOwned: product.totalOwned, busyQuantity });
});

// Export stock
router.post('/export', (req, res) => {
  const { orderId, productId, quantity, note } = req.body;
  const now = new Date().toISOString();

  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId) as Product;
  if (!product) return res.status(404).json({ error: 'Product not found' });
  if (product.currentPhysicalStock < quantity) {
    return res.status(400).json({ error: 'Insufficient stock' });
  }

  // Update stock
  db.prepare('UPDATE products SET currentPhysicalStock = currentPhysicalStock - ? WHERE id = ?').run(quantity, productId);
  
  // Update order item
  db.prepare('UPDATE order_items SET exportedQuantity = exportedQuantity + ? WHERE orderId = ? AND productId = ?')
    .run(quantity, orderId, productId);

  // Update order status to ACTIVE if BOOKED
  db.prepare(`UPDATE orders SET status = ? WHERE id = ? AND status = ?`).run(OrderStatus.ACTIVE, orderId, OrderStatus.BOOKED);

  // Log
  db.prepare(`INSERT INTO inventory_logs (productId, orderId, actionType, quantity, timestamp, note) VALUES (?, ?, 'EXPORT', ?, ?, ?)`)
    .run(productId, orderId, quantity, now, note || 'Export');

  res.json({ success: true });
});

// Import stock (return)
router.post('/import', (req, res) => {
  const { orderId, productId, quantity, note } = req.body;
  const now = new Date().toISOString();

  const item = db.prepare('SELECT * FROM order_items WHERE orderId = ? AND productId = ?').get(orderId, productId) as OrderItem;
  if (!item) return res.status(404).json({ error: 'Order item not found' });

  const newReturnedTotal = item.returnedQuantity + quantity;
  const currentExported = item.exportedQuantity || 0;

  // Auto-adjust if returning more than exported (user forgot to scan export)
  if (newReturnedTotal > currentExported) {
    const phantomQty = newReturnedTotal - currentExported;
    db.prepare('UPDATE products SET currentPhysicalStock = currentPhysicalStock - ? WHERE id = ?').run(phantomQty, productId);
    db.prepare('UPDATE order_items SET exportedQuantity = exportedQuantity + ? WHERE orderId = ? AND productId = ?')
      .run(phantomQty, orderId, productId);
    db.prepare(`INSERT INTO inventory_logs (productId, orderId, actionType, quantity, timestamp, note) VALUES (?, ?, 'ADJUST', ?, ?, ?)`)
      .run(productId, orderId, phantomQty, now, 'Auto-adjust: Detected return of un-scanned items');
  }

  // Normal return
  db.prepare('UPDATE products SET currentPhysicalStock = currentPhysicalStock + ? WHERE id = ?').run(quantity, productId);
  db.prepare('UPDATE order_items SET returnedQuantity = returnedQuantity + ? WHERE orderId = ? AND productId = ?')
    .run(quantity, orderId, productId);
  db.prepare(`INSERT INTO inventory_logs (productId, orderId, actionType, quantity, timestamp, note) VALUES (?, ?, 'IMPORT', ?, ?, ?)`)
    .run(productId, orderId, quantity, now, note || 'Import');

  // Check if all items returned -> complete order
  const allItems = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(orderId) as OrderItem[];
  const updatedItem = db.prepare('SELECT * FROM order_items WHERE orderId = ? AND productId = ?').get(orderId, productId) as OrderItem;
  allItems[allItems.findIndex(i => i.productId === productId)] = updatedItem;
  
  const allReturned = allItems.every(i => i.returnedQuantity >= i.quantity);
  if (allReturned) {
    db.prepare('UPDATE orders SET status = ?, actualReturnDate = ? WHERE id = ?').run(OrderStatus.COMPLETED, now, orderId);
  }

  res.json({ success: true, isExternal: Boolean(item.isExternal), supplierId: item.supplierId });
});

export default router;
