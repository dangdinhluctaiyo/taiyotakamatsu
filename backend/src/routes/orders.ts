import { Router } from 'express';
import db from '../database.js';
import { Order, OrderItem, OrderStatus, Product, Stock } from '../types.js';
import { randomUUID } from 'crypto';

const router = Router();

// Helper: Check availability
const checkAvailability = (productId: number, startDate: string, endDate: string, excludeOrderId?: number): number => {
  // 1. Get Total Usable Stock (Available + Reserved + OnRent + Dirty)
  // We exclude Broken.
  const stock = db.prepare(`
    SELECT SUM(availableQty + reservedQty + onRentQty + dirtyQty) as total
    FROM stocks
    WHERE productId = ?
  `).get(productId) as { total: number };

  const totalUsable = stock?.total || 0;

  // 2. Get all active orders (BOOKED, ACTIVE) that overlap with the requested period
  // Overlap: OrderStart <= RequestEnd AND OrderEnd >= RequestStart
  let query = `
    SELECT o.rentalStartDate, o.expectedReturnDate, oi.quantity
    FROM orders o
    JOIN order_items oi ON o.id = oi.orderId
    WHERE oi.productId = ?
    AND o.status IN ('BOOKED', 'ACTIVE')
    AND o.rentalStartDate <= ?
    AND o.expectedReturnDate >= ?
  `;

  const params: any[] = [productId, endDate, startDate];

  if (excludeOrderId) {
    query += ` AND o.id != ?`;
    params.push(excludeOrderId);
  }

  const overlappingOrders = db.prepare(query).all(...params) as { rentalStartDate: string, expectedReturnDate: string, quantity: number }[];

  // 3. Calculate Peak Demand
  // Create checkpoints for all start and end dates within the range
  const points: { date: string, change: number }[] = [];

  overlappingOrders.forEach(o => {
    points.push({ date: o.rentalStartDate, change: o.quantity });
    // End date is inclusive, so demand drops AFTER the end date
    // We can approximate by adding 1 day, or just handling the logic carefully.
    // Let's use string comparison.
    // To simplify, let's just use the start/end dates as points.
    // But we need to handle the "End Date" correctly.
    // If Order A ends on Jan 5, and Order B starts on Jan 6, they don't overlap.
    // If Order A ends on Jan 5, and Order B starts on Jan 5, they overlap.
    // So we add a "drop" event at "End Date + 1 second" or similar?
    // Let's just use the dates.
    points.push({ date: o.expectedReturnDate, change: -o.quantity });
    // Wait, if I sort by date, and I have (Jan 5, +5) and (Jan 5, -5).
    // If I process +5 first, peak goes up.
    // If I process -5 first (from previous order ending), peak might not go up.
    // Conservative: Process Starts before Ends for the same day?
    // Yes, if Order A ends Jan 5, and Order B starts Jan 5.
    // On Jan 5, BOTH are active?
    // Usually rental is "Day based". If I rent for Jan 5, I have it on Jan 5.
    // So yes, on Jan 5, both are active.
    // So we should drop the quantity AFTER Jan 5.
    // So the "drop" point should be "End Date + 1 Day".
  });

  // Sort points
  // We need to handle "End Date + 1 Day". 
  // Since we are using strings YYYY-MM-DD, adding a day is annoying in SQL/JS without Date object.
  // Let's convert to timestamps for calculation.

  const events: { time: number, change: number }[] = [];
  overlappingOrders.forEach(o => {
    events.push({ time: new Date(o.rentalStartDate).getTime(), change: o.quantity });
    const endDate = new Date(o.expectedReturnDate);
    endDate.setDate(endDate.getDate() + 1); // Drop demand the next day
    events.push({ time: endDate.getTime(), change: -o.quantity });
  });

  events.sort((a, b) => a.time - b.time);

  let maxDemand = 0;
  let currentDemand = 0;

  // We only care about the peak within the requested range [Start, End]
  // But we need to replay from the beginning of time? 
  // No, we only fetched overlapping orders.
  // But an order might have started BEFORE the requested range.
  // Its "Start" event is outside our range, but it contributes to demand.
  // So we should include ALL overlapping orders (which we did).
  // And replay the events.

  for (const event of events) {
    currentDemand += event.change;

    // Check if this event time is within our window (or affects our window)
    // Actually, since we filtered by overlap, the peak demand of these orders IS the peak demand we care about?
    // Wait, if Order A is Jan 1-2, and Order B is Jan 8-9.
    // Request is Jan 1-9.
    // Overlap: A and B.
    // Events: Jan 1 (+5), Jan 3 (-5), Jan 8 (+5), Jan 10 (-5).
    // Demand: 0 -> 5 -> 0 -> 5 -> 0.
    // Peak is 5.
    // Correct.
    if (currentDemand > maxDemand) {
      maxDemand = currentDemand;
    }
  }

  return totalUsable - maxDemand;
};

// Check availability endpoint
router.post('/check-availability', (req, res) => {
  const { items, rentalStartDate, expectedReturnDate } = req.body; // items: { productId, quantity }[]

  const results = items.map((item: any) => {
    const available = checkAvailability(item.productId, rentalStartDate, expectedReturnDate);
    return {
      productId: item.productId,
      requested: item.quantity,
      available: available,
      isEnough: available >= item.quantity
    };
  });

  res.json(results);
});

// Get all orders with items
router.get('/', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY id DESC').all() as Order[];
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

  // Validate availability first
  for (const item of items) {
    if (!item.isExternal) { // Only check stock for internal items
      const available = checkAvailability(item.productId, rentalStartDate, expectedReturnDate);
      if (available < item.quantity) {
        return res.status(400).json({
          error: `Not enough stock for product ID ${item.productId}. Requested: ${item.quantity}, Available: ${available}`
        });
      }
    }
  }

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

  const updateStock = db.transaction(() => {
    for (const item of items) {
      const warehouseId = 1; // Default warehouse

      // 1. If item was shipped (exported > 0) and not fully returned
      const remainingOnRent = item.exportedQuantity - item.returnedQuantity;
      if (remainingOnRent > 0) {
        // Move from OnRent to Dirty
        db.prepare(`
           UPDATE stocks SET onRentQty = onRentQty - ?, dirtyQty = dirtyQty + ?
           WHERE productId = ? AND warehouseId = ?
         `).run(remainingOnRent, remainingOnRent, item.productId, warehouseId);

        // Update returnedQuantity
        db.prepare('UPDATE order_items SET returnedQuantity = returnedQuantity + ? WHERE itemId = ?')
          .run(remainingOnRent, item.itemId);
      }

      // 2. If item was NOT shipped (exported == 0), it means it was just Reserved.
      // We should release the reservation: Reserved -> Available.
      if (item.exportedQuantity === 0) {
        db.prepare(`
           UPDATE stocks SET reservedQty = reservedQty - ?, availableQty = availableQty + ?
           WHERE productId = ? AND warehouseId = ?
         `).run(item.quantity, item.quantity, item.productId, warehouseId);
      }
    }

    db.prepare('UPDATE orders SET status = ?, actualReturnDate = ? WHERE id = ?')
      .run(OrderStatus.COMPLETED, now, req.params.id);
  });

  updateStock();
  res.json({ success: true });
});

export default router;
