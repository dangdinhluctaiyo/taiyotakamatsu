import { Router } from 'express';
import db from '../database.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM customers').all());
});

router.post('/', (req, res) => {
  const { name, phone } = req.body;
  const result = db.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)').run(name, phone);
  res.status(201).json({ id: result.lastInsertRowid, name, phone });
});

router.put('/:id', (req, res) => {
  const { name, phone } = req.body;
  db.prepare('UPDATE customers SET name = ?, phone = ? WHERE id = ?').run(name, phone, req.params.id);
  res.json({ id: Number(req.params.id), name, phone });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
