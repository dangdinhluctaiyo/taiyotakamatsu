import { Router } from 'express';
import db from '../database.js';
import { Product } from '../types.js';

const router = Router();

// Get all products
router.get('/', (req, res) => {
  const products = db.prepare(`
    SELECT p.*,
      COALESCE(SUM(s.availableQty), 0) as availableQty,
      COALESCE(SUM(s.reservedQty), 0) as reservedQty,
      COALESCE(SUM(s.onRentQty), 0) as onRentQty,
      COALESCE(SUM(s.dirtyQty), 0) as dirtyQty,
      COALESCE(SUM(s.brokenQty), 0) as brokenQty
    FROM products p
    LEFT JOIN stocks s ON p.id = s.productId
    GROUP BY p.id
  `).all() as any[];

  // Parse images JSON
  const result = products.map(p => ({
    ...p,
    images: p.images ? JSON.parse(p.images) : []
  }));
  res.json(result);
});

// Get product by ID
router.get('/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as any;
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json({ ...product, images: product.images ? JSON.parse(product.images) : [] });
});

// Create product
router.post('/', (req, res) => {
  const { code, name, category, pricePerDay, totalOwned, imageUrl, images, location, specs } = req.body;
  const stmt = db.prepare(`
    INSERT INTO products (code, name, category, pricePerDay, totalOwned, currentPhysicalStock, imageUrl, images, location, specs)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const imagesJson = images ? JSON.stringify(images) : null;
  const result = stmt.run(code, name, category || 'Khác', pricePerDay || 0, totalOwned || 0, totalOwned || 0, imageUrl || '', imagesJson, location || null, specs || null);
  res.status(201).json({ id: result.lastInsertRowid, ...req.body, currentPhysicalStock: totalOwned || 0, images: images || [] });
});

// Update product
router.put('/:id', (req, res) => {
  const { code, name, category, pricePerDay, totalOwned, imageUrl, images, location, specs } = req.body;
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id) as Product;
  if (!existing) return res.status(404).json({ error: 'Product not found' });

  const stockDiff = (totalOwned || existing.totalOwned) - existing.totalOwned;
  const newStock = existing.currentPhysicalStock + stockDiff;
  const imagesJson = images ? JSON.stringify(images) : null;

  db.prepare(`
    UPDATE products SET code = ?, name = ?, category = ?, pricePerDay = ?, totalOwned = ?, currentPhysicalStock = ?, imageUrl = ?, images = ?, location = ?, specs = ?
    WHERE id = ?
  `).run(code, name, category, pricePerDay, totalOwned, newStock, imageUrl, imagesJson, location || null, specs || null, req.params.id);

  res.json({ id: Number(req.params.id), code, name, category, pricePerDay, totalOwned, currentPhysicalStock: newStock, imageUrl, images: images || [], location, specs });
});

// Delete product
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// --- Serialized Items Endpoints ---

// Get serials for a product
router.get('/:id/serials', (req, res) => {
  const serials = db.prepare('SELECT * FROM device_serials WHERE productId = ?').all(req.params.id);
  res.json(serials);
});

// Add a serial
router.post('/:id/serials', (req, res) => {
  const { serialNumber, warehouseId } = req.body;
  const productId = req.params.id;

  if (!serialNumber || !warehouseId) {
    return res.status(400).json({ error: 'Missing serialNumber or warehouseId' });
  }

  try {
    const result = db.transaction(() => {
      // 1. Insert serial
      const info = db.prepare(`
        INSERT INTO device_serials (productId, serialNumber, warehouseId, status)
        VALUES (?, ?, ?, 'AVAILABLE')
      `).run(productId, serialNumber, warehouseId);

      // 2. Update Stocks (Available + 1)
      const stock = db.prepare('SELECT * FROM stocks WHERE productId = ? AND warehouseId = ?').get(productId, warehouseId) as any;
      if (stock) {
        db.prepare('UPDATE stocks SET availableQty = availableQty + 1 WHERE id = ?').run(stock.id);
      } else {
        db.prepare(`
          INSERT INTO stocks (productId, warehouseId, availableQty, reservedQty, onRentQty, dirtyQty, brokenQty)
          VALUES (?, ?, 1, 0, 0, 0, 0)
        `).run(productId, warehouseId);
      }

      // 3. Update Product (Total + 1)
      db.prepare('UPDATE products SET totalOwned = totalOwned + 1, currentPhysicalStock = currentPhysicalStock + 1 WHERE id = ?').run(productId);

      return info;
    })();

    res.status(201).json({ id: result.lastInsertRowid, serialNumber, status: 'AVAILABLE' });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Delete a serial
router.delete('/:id/serials/:serialId', (req, res) => {
  const { id, serialId } = req.params;

  try {
    db.transaction(() => {
      const serial = db.prepare('SELECT * FROM device_serials WHERE id = ?').get(serialId) as any;
      if (!serial) throw new Error('Serial not found');

      // Only allow deleting if AVAILABLE
      if (serial.status !== 'AVAILABLE') {
        throw new Error('Cannot delete serial that is not AVAILABLE');
      }

      // 1. Delete serial
      db.prepare('DELETE FROM device_serials WHERE id = ?').run(serialId);

      // 2. Update Stocks (Available - 1)
      db.prepare('UPDATE stocks SET availableQty = availableQty - 1 WHERE productId = ? AND warehouseId = ?').run(id, serial.warehouseId);

      // 3. Update Product (Total - 1)
      db.prepare('UPDATE products SET totalOwned = totalOwned - 1, currentPhysicalStock = currentPhysicalStock - 1 WHERE id = ?').run(id);
    })();

    res.status(204).send();
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
