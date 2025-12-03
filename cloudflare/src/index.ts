import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
  DB: D1Database;
  IMAGES: R2Bucket;
  CORS_ORIGIN: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// CORS
app.use('*', cors({ origin: '*' }));

// Health check
app.get('/', (c) => c.json({ status: 'ok', service: 'LucRental API' }));

// ============ AUTH ============
app.post('/api/auth/login', async (c) => {
  const { username, password } = await c.req.json();
  const user = await c.env.DB.prepare(
    'SELECT id, username, name, role FROM staff WHERE username = ? AND password = ? AND active = 1'
  ).bind(username, password).first();
  
  if (!user) return c.json({ error: 'Invalid credentials' }, 401);
  return c.json({ user });
});

// ============ STAFF ============
app.get('/api/staff', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT id, username, name, role, active FROM staff').all();
  return c.json(results);
});

app.post('/api/staff', async (c) => {
  const data = await c.req.json();
  const result = await c.env.DB.prepare(
    'INSERT INTO staff (username, password, name, role, active) VALUES (?, ?, ?, ?, ?)'
  ).bind(data.username, data.password, data.name, data.role || 'staff', data.active ? 1 : 0).run();
  return c.json({ id: result.meta.last_row_id });
});

app.put('/api/staff/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  
  if (data.password) {
    await c.env.DB.prepare('UPDATE staff SET username=?, password=?, name=?, role=?, active=? WHERE id=?')
      .bind(data.username, data.password, data.name, data.role, data.active ? 1 : 0, id).run();
  } else {
    await c.env.DB.prepare('UPDATE staff SET username=?, name=?, role=?, active=? WHERE id=?')
      .bind(data.username, data.name, data.role, data.active ? 1 : 0, id).run();
  }
  return c.json({ success: true });
});

app.delete('/api/staff/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM staff WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ============ PRODUCTS ============
app.get('/api/products', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM products').all();
  return c.json(results.map((p: any) => ({
    ...p,
    images: p.images ? JSON.parse(p.images) : [],
    pricePerDay: p.price_per_day,
    totalOwned: p.total_owned,
    currentPhysicalStock: p.current_physical_stock,
    imageUrl: p.image_url
  })));
});

app.post('/api/products', async (c) => {
  const data = await c.req.json();
  const result = await c.env.DB.prepare(
    `INSERT INTO products (code, name, category, price_per_day, total_owned, current_physical_stock, image_url, images, location, specs) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    data.code, data.name, data.category || 'Khác', data.pricePerDay || 0,
    data.totalOwned || 0, data.totalOwned || 0, data.imageUrl || '',
    JSON.stringify(data.images || []), data.location || '', data.specs || ''
  ).run();
  return c.json({ id: result.meta.last_row_id });
});

app.put('/api/products/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  await c.env.DB.prepare(
    `UPDATE products SET code=?, name=?, category=?, price_per_day=?, total_owned=?, 
     current_physical_stock=?, image_url=?, images=?, location=?, specs=? WHERE id=?`
  ).bind(
    data.code || '', 
    data.name || '', 
    data.category || 'Khác', 
    data.pricePerDay || 0, 
    data.totalOwned || 0,
    data.currentPhysicalStock || 0, 
    data.imageUrl || '', 
    JSON.stringify(data.images || []),
    data.location || '', 
    data.specs || '', 
    id
  ).run();
  return c.json({ success: true });
});

app.delete('/api/products/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ============ CUSTOMERS ============
app.get('/api/customers', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM customers').all();
  return c.json(results);
});

app.post('/api/customers', async (c) => {
  const data = await c.req.json();
  const result = await c.env.DB.prepare('INSERT INTO customers (name, phone) VALUES (?, ?)')
    .bind(data.name, data.phone || '').run();
  return c.json({ id: result.meta.last_row_id });
});

app.put('/api/customers/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  await c.env.DB.prepare('UPDATE customers SET name=?, phone=? WHERE id=?')
    .bind(data.name, data.phone || '', id).run();
  return c.json({ success: true });
});

app.delete('/api/customers/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM customers WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ============ ORDERS ============
app.get('/api/orders', async (c) => {
  const { results: orders } = await c.env.DB.prepare('SELECT * FROM orders ORDER BY id DESC').all();
  
  // Get items for each order
  for (const order of orders as any[]) {
    const { results: items } = await c.env.DB.prepare(
      'SELECT * FROM order_items WHERE order_id = ?'
    ).bind(order.id).all();
    order.items = items.map((i: any) => ({
      itemId: i.id.toString(),
      productId: i.product_id,
      quantity: i.quantity,
      isExternal: !!i.is_external,
      supplierId: i.supplier_id,
      exportedQuantity: i.exported_quantity,
      returnedQuantity: i.returned_quantity,
      returnedAt: i.returned_at,
      returnedBy: i.returned_by,
      note: i.note
    }));
    order.customerId = order.customer_id;
    order.rentalStartDate = order.rental_start_date;
    order.expectedReturnDate = order.expected_return_date;
    order.actualReturnDate = order.actual_return_date;
    order.totalAmount = order.total_amount;
    order.finalAmount = order.final_amount;
    order.completedBy = order.completed_by;
  }
  return c.json(orders);
});

app.post('/api/orders', async (c) => {
  const data = await c.req.json();
  const result = await c.env.DB.prepare(
    `INSERT INTO orders (customer_id, rental_start_date, expected_return_date, status, total_amount, note) 
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(
    data.customerId, data.rentalStartDate, data.expectedReturnDate,
    'BOOKED', data.totalAmount || 0, data.note || ''
  ).run();
  
  const orderId = result.meta.last_row_id;
  
  // Insert items
  for (const item of data.items || []) {
    await c.env.DB.prepare(
      `INSERT INTO order_items (order_id, product_id, quantity, is_external, supplier_id, note) 
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(orderId, item.productId, item.quantity, item.isExternal ? 1 : 0, item.supplierId || null, item.note || '').run();
  }
  
  return c.json({ id: orderId });
});

app.put('/api/orders/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  await c.env.DB.prepare(
    `UPDATE orders SET status=?, expected_return_date=?, actual_return_date=?, 
     total_amount=?, final_amount=?, completed_by=?, note=? WHERE id=?`
  ).bind(
    data.status, data.expectedReturnDate, data.actualReturnDate || null,
    data.totalAmount, data.finalAmount || null, data.completedBy || null, data.note || '', id
  ).run();
  return c.json({ success: true });
});

// ============ INVENTORY LOGS ============
app.get('/api/logs', async (c) => {
  const { results } = await c.env.DB.prepare(
    'SELECT * FROM inventory_logs ORDER BY timestamp DESC'
  ).all();
  return c.json(results.map((l: any) => ({
    id: l.id,
    productId: l.product_id,
    orderId: l.order_id,
    actionType: l.action_type,
    quantity: l.quantity,
    staffId: l.staff_id,
    staffName: l.staff_name,
    note: l.note,
    timestamp: l.timestamp
  })));
});

app.post('/api/logs', async (c) => {
  const data = await c.req.json();
  
  // Update product stock
  if (data.actionType === 'EXPORT') {
    await c.env.DB.prepare('UPDATE products SET current_physical_stock = current_physical_stock - ? WHERE id = ?')
      .bind(data.quantity, data.productId).run();
  } else if (data.actionType === 'IMPORT') {
    await c.env.DB.prepare('UPDATE products SET current_physical_stock = current_physical_stock + ? WHERE id = ?')
      .bind(data.quantity, data.productId).run();
  }
  
  const result = await c.env.DB.prepare(
    `INSERT INTO inventory_logs (product_id, order_id, action_type, quantity, staff_id, staff_name, note) 
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    data.productId, data.orderId || null, data.actionType, data.quantity,
    data.staffId || null, data.staffName || '', data.note || ''
  ).run();
  
  return c.json({ id: result.meta.last_row_id });
});

app.put('/api/logs/:id', async (c) => {
  const id = c.req.param('id');
  const data = await c.req.json();
  await c.env.DB.prepare('UPDATE inventory_logs SET quantity=?, staff_name=?, note=? WHERE id=?')
    .bind(data.quantity, data.staffName, data.note, id).run();
  return c.json({ success: true });
});

app.delete('/api/logs/:id', async (c) => {
  const id = c.req.param('id');
  await c.env.DB.prepare('DELETE FROM inventory_logs WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// ============ IMAGE UPLOAD (R2) ============
app.post('/api/upload', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('file') as File;
  
  if (!file) return c.json({ error: 'No file provided' }, 400);
  
  const filename = `${Date.now()}-${file.name}`;
  const arrayBuffer = await file.arrayBuffer();
  
  await c.env.IMAGES.put(filename, arrayBuffer, {
    httpMetadata: { contentType: file.type }
  });
  
  // Return public URL (you'll need to set up R2 public access or use Workers to serve)
  const url = `https://lucrental-images.YOUR_ACCOUNT.r2.dev/${filename}`;
  return c.json({ url, filename });
});

app.get('/api/images/:filename', async (c) => {
  const filename = c.req.param('filename');
  const object = await c.env.IMAGES.get(filename);
  
  if (!object) return c.notFound();
  
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  
  return new Response(object.body, { headers });
});

export default app;
