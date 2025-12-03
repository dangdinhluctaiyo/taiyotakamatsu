// Cloud Database Service - Uses Cloudflare API
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
  import.meta.env.VITE_API_URL || 'https://lucrental-api.dangdinhluc.workers.dev';

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

class CloudDB {
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
  }

  private loadSession() {
    if (typeof window !== 'undefined') {
      const session = localStorage.getItem('lucrental_session');
      if (session) {
        try {
          const user = JSON.parse(session);
          this.currentUser = user;
        } catch (e) {
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

  // --- AUTH ---
  async login(username: string, password: string): Promise<Staff | null> {
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
      return null;
    }
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('lucrental_session');
  }

  reset() {
    localStorage.removeItem('lucrental_session');
    window.location.reload();
  }

  // --- PRODUCTS ---
  async saveProduct(product: Product) {
    if (product.id === 0) {
      const { id } = await fetchAPI<{ id: number }>('/api/products', {
        method: 'POST',
        body: JSON.stringify(product),
      });
      product.id = id;
      this.products.push(product);
    } else {
      await fetchAPI(`/api/products/${product.id}`, {
        method: 'PUT',
        body: JSON.stringify(product),
      });
      const idx = this.products.findIndex((p) => p.id === product.id);
      if (idx !== -1) this.products[idx] = product;
    }
  }

  async deleteProduct(id: number) {
    await fetchAPI(`/api/products/${id}`, { method: 'DELETE' });
    this.products = this.products.filter((p) => p.id !== id);
  }

  // --- CUSTOMERS ---
  async addCustomer(customer: Omit<Customer, 'id'>): Promise<Customer> {
    const { id } = await fetchAPI<{ id: number }>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(customer),
    });
    const newCustomer = { ...customer, id };
    this.customers.push(newCustomer);
    return newCustomer;
  }

  // --- ORDERS ---
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
        const item = order.items.find(
          (i) => i.productId === productId && !i.isExternal
        );
        return total + (item ? item.quantity : 0);
      }, 0);

    return Math.max(0, product.totalOwned - busyQuantity);
  }

  async createOrder(order: Order): Promise<Order> {
    const { id } = await fetchAPI<{ id: number }>('/api/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
    const newOrder = { ...order, id, status: OrderStatus.BOOKED };
    this.orders.push(newOrder);
    return newOrder;
  }

  async updateOrder(orderId: number, updates: Partial<Order>) {
    await fetchAPI(`/api/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    const idx = this.orders.findIndex((o) => o.id === orderId);
    if (idx !== -1) this.orders[idx] = { ...this.orders[idx], ...updates };
  }

  // --- INVENTORY ---
  async exportStock(
    orderId: number,
    productId: number,
    qty: number,
    note: string
  ) {
    await fetchAPI('/api/logs', {
      method: 'POST',
      body: JSON.stringify({
        productId,
        orderId,
        actionType: 'EXPORT',
        quantity: qty,
        staffId: this.currentUser?.id,
        staffName: this.currentUser?.name,
        note,
      }),
    });
    await this.refresh();
  }

  async importStock(
    orderId: number,
    productId: number,
    qty: number,
    note: string
  ) {
    await fetchAPI('/api/logs', {
      method: 'POST',
      body: JSON.stringify({
        productId,
        orderId,
        actionType: 'IMPORT',
        quantity: qty,
        staffId: this.currentUser?.id,
        staffName: this.currentUser?.name,
        note,
      }),
    });
    await this.refresh();
  }

  async forceCompleteOrder(orderId: number, staffName?: string) {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return;

    await fetchAPI(`/api/orders/${orderId}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...order,
        status: OrderStatus.COMPLETED,
        actualReturnDate: new Date().toISOString(),
        completedBy: staffName,
      }),
    });
    await this.refresh();
  }

  // --- LOGS ---
  async updateLog(logId: number, updates: Partial<InventoryLog>) {
    await fetchAPI(`/api/logs/${logId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    const idx = this.logs.findIndex((l) => l.id === logId);
    if (idx !== -1) this.logs[idx] = { ...this.logs[idx], ...updates };
  }

  async deleteLog(logId: number) {
    await fetchAPI(`/api/logs/${logId}`, { method: 'DELETE' });
    this.logs = this.logs.filter((l) => l.id !== logId);
  }

  // --- STAFF ---
  async addStaff(staffData: Omit<Staff, 'id'>): Promise<Staff> {
    const { id } = await fetchAPI<{ id: number }>('/api/staff', {
      method: 'POST',
      body: JSON.stringify(staffData),
    });
    const newStaff = { ...staffData, id };
    this.staff.push(newStaff);
    return newStaff;
  }

  async updateStaff(staffId: number, updates: Partial<Staff>) {
    await fetchAPI(`/api/staff/${staffId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    const idx = this.staff.findIndex((s) => s.id === staffId);
    if (idx !== -1) this.staff[idx] = { ...this.staff[idx], ...updates };
  }

  async deleteStaff(staffId: number) {
    await fetchAPI(`/api/staff/${staffId}`, { method: 'DELETE' });
    this.staff = this.staff.filter((s) => s.id !== staffId);
  }
}

export const cloudDb = new CloudDB();
