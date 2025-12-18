import { Router } from 'express';
import db from '../database.js';
import { InventoryLog, DeviceStatus } from '../types.js';

const router = Router();

// Get warehouse tasks (items to prepare, items to clean)
router.get('/tasks', (req, res) => {
    try {
        // Items to prepare (from BOOKED orders starting soon)
        // Logic: Orders with status 'BOOKED' where rentalStartDate is close (e.g., today or next 7 days)
        // For simplicity, we'll just get all BOOKED orders for now
        const ordersToPrepare = db.prepare(`
      SELECT o.id, o.rentalStartDate, c.name as customerName, 
             oi.productId, p.name as productName, oi.quantity
      FROM orders o
      JOIN customers c ON o.customerId = c.id
      JOIN order_items oi ON o.id = oi.orderId
      JOIN products p ON oi.productId = p.id
      WHERE o.status = 'BOOKED'
      ORDER BY o.rentalStartDate ASC
    `).all();

        // Items to clean (dirty stock)
        const itemsToClean = db.prepare(`
      SELECT s.productId, p.name as productName, s.dirtyQty, s.warehouseId, w.name as warehouseName
      FROM stocks s
      JOIN products p ON s.productId = p.id
      JOIN warehouses w ON s.warehouseId = w.id
      WHERE s.dirtyQty > 0
    `).all();

        res.json({
            toPrepare: ordersToPrepare,
            toClean: itemsToClean
        });
    } catch (error) {
        console.error('Error fetching warehouse tasks:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Prepare items for an order (Available -> Reserved)
// Note: This is the main Prepare endpoint that handles both serialized and non-serialized items.

// Prepare Order (Assign Serials or Reserve Stock)
router.post('/prepare', (req, res) => {
    const { orderId, productId, serialIds, quantity } = req.body; // serialIds is array of numbers, quantity is number

    if (!orderId || !productId) {
        return res.status(400).json({ error: 'Invalid input' });
    }

    try {
        const prepareOrder = db.transaction(() => {
            const warehouseId = 1; // Default

            if (serialIds && Array.isArray(serialIds) && serialIds.length > 0) {
                // Serialized Items
                for (const serialId of serialIds) {
                    // 1. Check if serial is AVAILABLE
                    const serial = db.prepare('SELECT * FROM device_serials WHERE id = ? AND status = "AVAILABLE"').get(serialId) as any;
                    if (!serial) throw new Error(`Serial ID ${serialId} is not available`);

                    // 2. Update Serial: Status -> RESERVED, set orderId
                    db.prepare('UPDATE device_serials SET status = "RESERVED", orderId = ? WHERE id = ?').run(orderId, serialId);

                    // 3. Update Stocks: Available -> Reserved
                    db.prepare(`
                        UPDATE stocks 
                        SET availableQty = availableQty - 1, reservedQty = reservedQty + 1
                        WHERE productId = ? AND warehouseId = ?
                    `).run(productId, warehouseId);
                }
            } else if (quantity && quantity > 0) {
                // Non-Serialized Items: Just move stock
                // Check availability first
                const stock = db.prepare('SELECT availableQty FROM stocks WHERE productId = ? AND warehouseId = ?').get(productId, warehouseId) as any;
                if (!stock || stock.availableQty < quantity) {
                    throw new Error(`Not enough available stock to prepare. Available: ${stock?.availableQty || 0}`);
                }

                db.prepare(`
                    UPDATE stocks 
                    SET availableQty = availableQty - ?, reservedQty = reservedQty + ?
                    WHERE productId = ? AND warehouseId = ?
                `).run(quantity, quantity, productId, warehouseId);
            }
        });

        prepareOrder();
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Clean items (Dirty -> Available)
router.post('/clean', (req, res) => {
    const { productId, warehouseId, quantity } = req.body;

    if (!productId || !warehouseId || !quantity) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        const updateStock = db.transaction(() => {
            const stock = db.prepare('SELECT dirtyQty FROM stocks WHERE productId = ? AND warehouseId = ?').get(productId, warehouseId) as { dirtyQty: number };

            if (!stock || stock.dirtyQty < quantity) {
                throw new Error('Not enough dirty stock');
            }

            // Update Stocks (Dirty -> Available)
            db.prepare(`
                UPDATE stocks 
                SET dirtyQty = dirtyQty - ?, availableQty = availableQty + ?
                WHERE productId = ? AND warehouseId = ?
            `).run(quantity, quantity, productId, warehouseId);

            // Update Serials (Dirty -> Available)
            const dirtySerials = db.prepare('SELECT id FROM device_serials WHERE productId = ? AND warehouseId = ? AND status = "DIRTY" LIMIT ?').all(productId, warehouseId, quantity) as { id: number }[];

            for (const serial of dirtySerials) {
                db.prepare('UPDATE device_serials SET status = "AVAILABLE", orderId = NULL WHERE id = ?').run(serial.id);
            }

            // Log it
            db.prepare(`
                INSERT INTO inventory_logs (productId, actionType, quantity, timestamp, note)
                VALUES (?, 'CLEAN', ?, datetime('now'), 'Cleaned items')
            `).run(productId, quantity);
        });

        updateStock();
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Ship Order (Reserved -> On Rent)
router.post('/ship', (req, res) => {
    const { orderId, items } = req.body; // items: [{ itemId, quantity, productId }]

    if (!orderId) {
        return res.status(400).json({ error: 'Missing orderId' });
    }

    try {
        const shipOrder = db.transaction(() => {
            // If items array provided, ship specific items. Otherwise, ship all.
            let orderItems: { itemId: string, productId: number, quantity: number }[];

            if (items && Array.isArray(items) && items.length > 0) {
                orderItems = items;
            } else {
                orderItems = db.prepare('SELECT itemId, productId, quantity FROM order_items WHERE orderId = ?').all(orderId) as any[];
            }

            const warehouseId = 1;

            for (const item of orderItems) {
                const stock = db.prepare('SELECT reservedQty, availableQty FROM stocks WHERE productId = ? AND warehouseId = ?').get(item.productId, warehouseId) as any;
                const reserved = stock?.reservedQty || 0;
                const available = stock?.availableQty || 0;

                let takeFromReserved = 0;
                let takeFromAvailable = 0;

                if (reserved >= item.quantity) {
                    takeFromReserved = item.quantity;
                } else {
                    takeFromReserved = reserved;
                    takeFromAvailable = item.quantity - reserved;
                }

                if (takeFromAvailable > available) {
                    throw new Error(`Not enough stock to ship Product ${item.productId}. Needed: ${item.quantity}, Reserved: ${reserved}, Available: ${available}`);
                }

                if (takeFromReserved > 0) {
                    db.prepare(`
                        UPDATE stocks 
                        SET reservedQty = reservedQty - ?, onRentQty = onRentQty + ?
                        WHERE productId = ? AND warehouseId = ?
                    `).run(takeFromReserved, takeFromReserved, item.productId, warehouseId);
                }
                if (takeFromAvailable > 0) {
                    db.prepare(`
                        UPDATE stocks 
                        SET availableQty = availableQty - ?, onRentQty = onRentQty + ?
                        WHERE productId = ? AND warehouseId = ?
                    `).run(takeFromAvailable, takeFromAvailable, item.productId, warehouseId);
                }

                db.prepare('UPDATE order_items SET exportedQuantity = exportedQuantity + ? WHERE itemId = ?').run(item.quantity, item.itemId);

                db.prepare(`
                    UPDATE device_serials 
                    SET status = 'ON_RENT' 
                    WHERE orderId = ? AND productId = ? AND status = 'RESERVED'
                `).run(orderId, item.productId);
            }

            db.prepare("UPDATE orders SET status = 'ACTIVE' WHERE id = ?").run(orderId);
        });

        shipOrder();
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Return Order (On Rent -> Dirty)
router.post('/return', (req, res) => {
    const { orderId, items } = req.body; // items: [{ itemId, quantity, productId }]

    if (!orderId) {
        return res.status(400).json({ error: 'Missing orderId' });
    }

    try {
        const returnOrder = db.transaction(() => {
            let orderItems: { itemId: string, productId: number, quantity: number }[];

            if (items && Array.isArray(items) && items.length > 0) {
                orderItems = items;
            } else {
                orderItems = db.prepare('SELECT itemId, productId, quantity FROM order_items WHERE orderId = ?').all(orderId) as any[];
            }

            const warehouseId = 1;

            for (const item of orderItems) {
                db.prepare(`
                    UPDATE stocks 
                    SET onRentQty = onRentQty - ?, dirtyQty = dirtyQty + ?
                    WHERE productId = ? AND warehouseId = ?
                `).run(item.quantity, item.quantity, item.productId, warehouseId);

                db.prepare('UPDATE order_items SET returnedQuantity = returnedQuantity + ? WHERE itemId = ?').run(item.quantity, item.itemId);

                db.prepare(`
                    UPDATE device_serials 
                    SET status = 'DIRTY' 
                    WHERE orderId = ? AND productId = ? AND status = 'ON_RENT'
                `).run(orderId, item.productId);
            }

            // Check if all items are fully returned
            const allReturned = db.prepare(`
                SELECT COUNT(*) as count FROM order_items 
                WHERE orderId = ? AND returnedQuantity < quantity
            `).get(orderId) as { count: number };

            if (allReturned.count === 0) {
                db.prepare("UPDATE orders SET status = 'COMPLETED', actualReturnDate = datetime('now') WHERE id = ?").run(orderId);
            }
        });

        returnOrder();
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

export default router;
