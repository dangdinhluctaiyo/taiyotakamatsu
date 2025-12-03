import { Router } from 'express';
import db from '../database.js';
import { Product } from '../types.js';

const router = Router();

// Get all products
router.get('/', (req, res) => {
  const products = db.prepare('SELECT * FROM products').all() as any[];
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

export default router;
