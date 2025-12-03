import {
  Product,
  Order,
  OrderStatus,
  Customer,
  Supplier,
  InventoryLog,
  Staff,
} from '../types';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://lucrental-api.dangdinhluc.workers.dev';

async function fetchAPI<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json();
}

const generateId = () => Math.floor(Math.random() * 100000);

export class MockDB {
  products: Product[] = [];
  orders: Order[] = [];
  customers: Customer[] = [];
  suppliers: Supplier[] = [];
  logs: InventoryLog[] = [];
  staff: Staff[] = [];
  currentUser: Staff | null = null;
  private initialized = false;

  constructor() {
    this.loadSession();
    this.init();
  }

  private loadSession() {
    if (typeof window !== 'undefined') {
      const session = localStorage.getItem('lucrental_session');
      if (session) {
        try {
          const user = JSON.parse(session);
          this.currentUser = user;
        } catch {
          this.currentUser = null;
        }
      }
    }
  }

  async init() {
    if (this.initialized) return;
    try {
      const [products, orders, customers, staff, logs] = await Promise.all([
        fetchAPI<Product[]>('/api/products'),
        fetchAPI<Order[]>('/api/orders'),
        fetchAPI<Customer[]>('/api/customers'),
        fetchAPI<Staff[]>('/api/staff'),
        fetchAPI<InventoryLog[]>('/api/logs'),
      ]);
      this.products = products;
      this.orders = orders;
      this.customers = customers;
      this.staff = staff;
      this.logs = logs;
      this.initialized = true;
    } catch (e) {
      console.error('Failed to init cloud DB:', e);
    }
  }

  async refresh() {
    this.initialized = false;
    await this.init();
  }

  reset() {
    localStorage.removeItem('lucrental_session');
    window.location.reload();
  }

  login(username: string, password: string): Staff | null {
    const user = this.staff.find(
      (s) => s.username === username && s.password === password && s.active
    );
    if (user) {
      this.currentUser = user;
      localStorage.setItem('lucrental_session', JSON.stringify(user));
    }
    return user || null;
  }

  async loginAsync(username: string, password: string): Promise<Staff | null> {
    try {
      const { user } = await fetchAPI<{ user: Staff }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (user) {
        this.currentUser = user;
        localStorage.setItem('lucrental_session', JSON.stringify(user));
        await this.init();
      }
      return user;
    } catch (e) {
      console.error('Login failed:', e);
      return this.login(username, password);
    }
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('lucrental_session');
  }

  async saveProduct(product: Product) {
    if (product.id === 0) {
      const newProduct = {
        ...product,
        id: generateId(),
        currentPhysicalStock: product.totalOwned,
      };
      this.products.push(newProduct);
      this.products.push(newProduct);
      await fetchAPI('/api/products', {
        method: 'POST',
        body: JSON.stringify(newProduct),
      }).catch(console.error);
    } else {
      const index = this.products.findIndex((p) => p.id === product.id);
      if (index !== -1) {
        const oldProduct = this.products[index];
        const stockDiff = product.totalOwned - oldProduct.totalOwned;
        this.products[index] = {
          ...product,
          currentPhysicalStock: oldProduct.currentPhysicalStock + stockDiff,
        };
        await fetchAPI(`/api/products/${product.id}`, {
          method: 'PUT',
          body: JSON.stringify(this.products[index]),
        }).catch(console.error);
      }
    }
  }

  async deleteProduct(id: number) {
    this.products = this.products.filter((p) => p.id !== id);
    await fetchAPI(`/api/products/${id}`, { method: 'DELETE' }).catch(console.error);
  }

  async addCustomer(customer: Omit<Customer, 'id'>): Promise<Customer> {
    const newCustomer = { ...customer, id: generateId() };
    this.customers.push(newCustomer);
    await fetchAPI('/api/customers', {
      method: 'POST',
      body: JSON.stringify(newCustomer),
    }).catch(console.error);
    return newCustomer;
  }

  async updateCustomer(id: number, updates: Partial<Customer>) {
    const index = this.customers.findIndex((c) => c.id === id);
    if (index !== -1) {
      this.customers[index] = { ...this.customers[index], ...updates };
      await fetchAPI(`/api/customers/${id}`, {
        method: 'PUT',
        body: JSON.stringify(this.customers[index]),
      }).catch(console.error);
    }
  }

  async deleteCustomer(id: number) {
    this.customers = this.customers.filter((c) => c.id !== id);
    await fetchAPI(`/api/customers/${id}`, { method: 'DELETE' }).catch(console.error);
  }

  addSupplier(supplier: Omit<Supplier, 'id'>): Supplier {
    const newSupplier = { ...supplier, id: generateId() };
    this.suppliers.push(newSupplier);
    return newSupplier;
  }

  checkAvailability(productId: number, start: string, end: string): number {
    const product = this.products.find((p) => p.id === productId);
    if (!product) return 0;

    const sDate = new Date(start);
    const eDate = new Date(end);

    const busyQuantity = this.orders
      .filter(
        (o) =>
          (o.status === OrderStatus.BOOKED || o.status === OrderStatus.ACTIVE) &&
          new Date(o.rentalStartDate) <= eDate &&
          new Date(o.expectedReturnDate) >= sDate
      )
      .reduce((total, order) => {
        const item = order.items.find((i) => i.productId === productId && !i.isExternal);
        return total + (item ? item.quantity : 0);
      }, 0);

    return Math.max(0, product.totalOwned - busyQuantity);
  }

  getForecastStockForDate(productId: number, date: string) {
    const product = this.products.find((p) => p.id === productId);
    if (!product) return { physicalStock: 0, expectedReturns: 0, expectedExports: 0, forecastStock: 0, orders: [] };

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const physicalStock = product.currentPhysicalStock;
    let expectedReturns = 0;
    let expectedExports = 0;
    const orderDetails: { orderId: number; customerName: string; quantity: number; type: 'export' | 'return'; date: string }[] = [];

    this.orders
      .filter((o) => o.status === OrderStatus.BOOKED || o.status === OrderStatus.ACTIVE)
      .forEach((order) => {
        const item = order.items.find((i) => i.productId === productId && !i.isExternal);
        if (!item) return;

        const startDate = new Date(order.rentalStartDate);
        startDate.setHours(0, 0, 0, 0);
        const returnDate = new Date(order.expectedReturnDate);
        returnDate.setHours(0, 0, 0, 0);

        const customer = this.customers.find((c) => c.id === order.customerId);
        const customerName = customer?.name || `Đơn #\${order.id}`;

        const pendingExport = item.quantity - (item.exportedQuantity || 0);
        const pendingReturn = (item.exportedQuantity || 0) - item.returnedQuantity;

        if (startDate <= targetDate && pendingExport > 0 && startDate >= today) {
          expectedExports += pendingExport;
          orderDetails.push({ orderId: order.id, customerName, quantity: pendingExport, type: 'export', date: order.rentalStartDate });
        }

        if (returnDate <= targetDate && pendingReturn > 0) {
          expectedReturns += pendingReturn;
          orderDetails.push({ orderId: order.id, customerName, quantity: pendingReturn, type: 'return', date: order.expectedReturnDate });
        }
      });

    const forecastStock = physicalStock + expectedReturns - expectedExports;

    return {
      physicalStock,
      expectedReturns,
      expectedExports,
      forecastStock: Math.max(0, forecastStock),
      orders: orderDetails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    };
  }

  getForecastStockRange(productId: number, startDate: string, days: number) {
    const result = [];
    const start = new Date(startDate);

    for (let i = 0; i < days; i++) {
      const date = new Date(start);
      date.setDate(start.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const forecast = this.getForecastStockForDate(productId, dateStr);
      result.push({
        date: dateStr,
        physicalStock: forecast.physicalStock,
        forecastStock: forecast.forecastStock,
        expectedReturns: forecast.expectedReturns,
        expectedExports: forecast.expectedExports,
      });
    }

    return result;
  }

  getAllProductsForecast(date: string) {
    return this.products.map((p) => {
      const forecast = this.getForecastStockForDate(p.id, date);
      return {
        productId: p.id,
        productName: p.name,
        productCode: p.code,
        currentStock: p.currentPhysicalStock,
        forecastStock: forecast.forecastStock,
        expectedReturns: forecast.expectedReturns,
        expectedExports: forecast.expectedExports,
      };
    });
  }

  createOrder(order: Order): Order {
    const items = order.items.map((i) => ({
      ...i,
      exportedQuantity: 0,
      returnedQuantity: 0,
    }));

    const newOrder = {
      ...order,
      items,
      id: generateId(),
      status: OrderStatus.BOOKED,
    };
    this.orders.push(newOrder);

    fetchAPI('/api/orders', {
      method: 'POST',
      body: JSON.stringify(newOrder),
    }).catch(console.error);

    return newOrder;
  }

  updateOrder(orderId: number, updates: Partial<Order>) {
    const index = this.orders.findIndex((o) => o.id === orderId);
    if (index !== -1) {
      this.orders[index] = { ...this.orders[index], ...updates };
      fetchAPI(`/api/orders/\${orderId}`, {
        method: 'PUT',
        body: JSON.stringify(this.orders[index]),
      }).catch(console.error);
    }
  }

  exportStock(orderId: number, productId: number, qty: number, note: string) {
    const product = this.products.find((p) => p.id === productId);
    const order = this.orders.find((o) => o.id === orderId);

    if (product && order) {
      product.currentPhysicalStock -= qty;

      const item = order.items.find((i) => i.productId === productId);
      if (item) {
        item.exportedQuantity = (item.exportedQuantity || 0) + qty;
      }

      const log: InventoryLog = {
        id: generateId(),
        productId,
        orderId,
        actionType: 'EXPORT',
        quantity: qty,
        timestamp: new Date().toISOString(),
        note,
        staffId: this.currentUser?.id,
        staffName: this.currentUser?.name,
      };
      this.logs.push(log);

      if (order.status === OrderStatus.BOOKED) {
        order.status = OrderStatus.ACTIVE;
      }

      fetchAPI('/api/logs', {
        method: 'POST',
        body: JSON.stringify(log),
      }).catch(console.error);
    }
  }

  importStock(orderId: number, productId: number, qty: number, note: string) {
    const product = this.products.find((p) => p.id === productId);
    const order = this.orders.find((o) => o.id === orderId);

    if (product && order) {
      const item = order.items.find((i) => i.productId === productId);
      if (!item) return;

      const currentExported = item.exportedQuantity || 0;
      const newReturnedTotal = item.returnedQuantity + qty;

      if (newReturnedTotal > currentExported) {
        const phantomQty = newReturnedTotal - currentExported;
        product.currentPhysicalStock -= phantomQty;
        item.exportedQuantity = (item.exportedQuantity || 0) + phantomQty;

        this.logs.push({
          id: generateId(),
          productId,
          orderId,
          actionType: 'ADJUST',
          quantity: phantomQty,
          timestamp: new Date().toISOString(),
          note: 'Auto-adjust: Detected return of un-scanned items',
        });
      }

      product.currentPhysicalStock += qty;
      item.returnedQuantity += qty;

      const log: InventoryLog = {
        id: generateId(),
        productId,
        orderId,
        actionType: 'IMPORT',
        quantity: qty,
        timestamp: new Date().toISOString(),
        note,
        staffId: this.currentUser?.id,
        staffName: this.currentUser?.name,
      };
      this.logs.push(log);

      const allReturned = order.items.every((i) => i.returnedQuantity >= i.quantity);
      if (allReturned) {
        order.status = OrderStatus.COMPLETED;
        order.actualReturnDate = new Date().toISOString();
      }

      fetchAPI('/api/logs', {
        method: 'POST',
        body: JSON.stringify(log),
      }).catch(console.error);
    }
  }

  forceCompleteOrder(orderId: number, staffName?: string) {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return;

    const now = new Date().toISOString();

    order.items.forEach((item) => {
      const product = this.products.find((p) => p.id === item.productId);
      if (product && !item.isExternal) {
        const outstanding = (item.exportedQuantity || 0) - item.returnedQuantity;
        if (outstanding > 0) {
          product.currentPhysicalStock += outstanding;
          item.returnedQuantity += outstanding;
          item.returnedAt = now;
          item.returnedBy = staffName || 'System';

          const log: InventoryLog = {
            id: generateId(),
            productId: item.productId,
            orderId: order.id,
            actionType: 'IMPORT',
            quantity: outstanding,
            timestamp: now,
            note: `Auto Restock - NV: \${staffName || 'System'}`,
          };
          this.logs.push(log);

          fetchAPI('/api/logs', {
            method: 'POST',
            body: JSON.stringify(log),
          }).catch(console.error);
        }
      }
    });

    order.status = OrderStatus.COMPLETED;
    order.actualReturnDate = now;
    order.completedBy = staffName;

    const start = new Date(order.rentalStartDate);
    const end = new Date(now);
    const actualDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    order.finalAmount = order.items.reduce((sum, item) => {
      const product = this.products.find((p) => p.id === item.productId);
      return sum + (product?.pricePerDay || 0) * item.quantity * actualDays;
    }, 0);

    fetchAPI(`/api/orders/\${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(order),
    }).catch(console.error);
  }

  updateLog(logId: number, updates: Partial<InventoryLog>) {
    const index = this.logs.findIndex((l) => l.id === logId);
    if (index !== -1) {
      this.logs[index] = { ...this.logs[index], ...updates };
      fetchAPI(`/api/logs/\${logId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      }).catch(console.error);
    }
  }

  deleteLog(logId: number) {
    this.logs = this.logs.filter((l) => l.id !== logId);
    fetchAPI(`/api/logs/\${logId}`, { method: 'DELETE' }).catch(console.error);
  }

  addStaff(staffData: Omit<Staff, 'id'>): Staff {
    const newStaff = { ...staffData, id: generateId() };
    this.staff.push(newStaff);
    fetchAPI('/api/staff', {
      method: 'POST',
      body: JSON.stringify(newStaff),
    }).catch(console.error);
    return newStaff;
  }

  updateStaff(staffId: number, updates: Partial<Staff>) {
    const index = this.staff.findIndex((s) => s.id === staffId);
    if (index !== -1) {
      this.staff[index] = { ...this.staff[index], ...updates };
      fetchAPI(`/api/staff/\${staffId}`, {
        method: 'PUT',
        body: JSON.stringify(this.staff[index]),
      }).catch(console.error);
    }
  }

  deleteStaff(staffId: number) {
    this.staff = this.staff.filter((s) => s.id !== staffId);
    fetchAPI(`/api/staff/\${staffId}`, { method: 'DELETE' }).catch(console.error);
  }
}

export const db = new MockDB();
