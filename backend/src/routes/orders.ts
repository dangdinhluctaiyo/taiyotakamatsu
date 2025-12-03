import { Router } from 'express';
import db from '../database.js';
import { Order, OrderItem, OrderStatus, Product } from '../types.js';
import { randomUUID } from 'crypto';

const router = Router();

// Get all orders with items
router.get('/', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders').all() as Order[];
  const items = db.prepare('SELECT * FROM order_items').all() as OrderItem[];
  
  const result = orders.map(order => ({
    ...order,
    items: items.filter(i => i.orderId === order.id).map(i => ({ ...i, isExternal: Boolean(i.isExternal) }))
  }));
  res.json(result);
});

// Get order by ID
router.get('/:id', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Order;
  if (!order) return res.status(404).json({ error: 'Order not found' });
  
  const items = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(req.params.id) as OrderItem[];
  res.json({ ...order, items: items.map(i => ({ ...i, isExternal: Boolean(i.isExternal) })) });
});

// Create order
router.post('/', (req, res) => {
  const { customerId, rentalStartDate, expectedReturnDate, items, totalAmount } = req.body;
  
  const orderResult = db.prepare(`
    INSERT INTO orders (customerId, rentalStartDate, expectedReturnDate, status, totalAmount)
    VALUES (?, ?, ?, ?, ?)
  `).run(customerId, rentalStartDate, expectedReturnDate, OrderStatus.BOOKED, totalAmount || 0);
  
  const orderId = orderResult.lastInsertRowid as number;
  const insertItem = db.prepare(`
    INSERT INTO order_items (itemId, orderId, productId, quantity, isExternal, supplierId, costPrice, exportedQuantity, returnedQuantity)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0)
  `);

  const savedItems: OrderItem[] = [];
  for (const item of items) {
    const itemId = item.itemId || randomUUID();
    insertItem.run(itemId, orderId, item.productId, item.quantity, item.isExternal ? 1 : 0, item.supplierId || null, item.costPrice || null);
    savedItems.push({ ...item, itemId, orderId, exportedQuantity: 0, returnedQuantity: 0 });
  }

  res.status(201).json({
    id: orderId, customerId, rentalStartDate, expectedReturnDate,
    status: OrderStatus.BOOKED, totalAmount: totalAmount || 0, items: savedItems
  });
});

// Update order status
router.patch('/:id/status', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ id: Number(req.params.id), status });
});

// Force complete order
router.post('/:id/complete', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id) as Order;
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const items = db.prepare('SELECT * FROM order_items WHERE orderId = ?').all(req.params.id) as OrderItem[];
  const now = new Date().toISOString();

  for (const item of items) {
    const outstanding = (item.exportedQuantity || 0) - item.returnedQuantity;
    if (outstanding > 0) {
      // Return outstanding items to stock
      db.prepare('UPDATE products SET currentPhysicalStock = currentPhysicalStock + ? WHERE id = ?')
        .run(outstanding, item.productId);
      db.prepare('UPDATE order_items SET returnedQuantity = returnedQuantity + ? WHERE itemId = ?')
        .run(outstanding, item.itemId);
      // Log
      db.prepare(`INSERT INTO inventory_logs (productId, orderId, actionType, quantity, timestamp, note) VALUES (?, ?, 'IMPORT', ?, ?, ?)`)
        .run(item.productId, order.id, outstanding, now, 'Manual Order Completion - Auto Restock');
    }
  }

  db.prepare('UPDATE orders SET status = ?, actualReturnDate = ? WHERE id = ?')
    .run(OrderStatus.COMPLETED, now, req.params.id);

  res.json({ success: true });
});

export default router;
