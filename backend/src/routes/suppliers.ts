import { Router } from 'express';
import db from '../database.js';

const router = Router();

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM suppliers').all());
});

router.post('/', (req, res) => {
  const { name, contact } = req.body;
  const result = db.prepare('INSERT INTO suppliers (name, contact) VALUES (?, ?)').run(name, contact);
  res.status(201).json({ id: result.lastInsertRowid, name, contact });
});

router.put('/:id', (req, res) => {
  const { name, contact } = req.body;
  db.prepare('UPDATE suppliers SET name = ?, contact = ? WHERE id = ?').run(name, contact, req.params.id);
  res.json({ id: Number(req.params.id), name, contact });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM suppliers WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

export default router;
