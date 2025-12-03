import { Product, Customer, Supplier, Order, InventoryLog, OrderStatus } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

async function request<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }
  if (res.status === 204) return {} as T;
  return res.json();
}

export const api = {
  // Products
  getProducts: () => request<Product[]>('/products'),
  getProduct: (id: number) => request<Product>(`/products/${id}`),
  createProduct: (data: Partial<Product>) => request<Product>('/products', { method: 'POST', body: JSON.stringify(data) }),
  updateProduct: (id: number, data: Partial<Product>) => request<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteProduct: (id: number) => request<void>(`/products/${id}`, { method: 'DELETE' }),

  // Customers
  getCustomers: () => request<Customer[]>('/customers'),
  createCustomer: (data: Partial<Customer>) => request<Customer>('/customers', { method: 'POST', body: JSON.stringify(data) }),
  updateCustomer: (id: number, data: Partial<Customer>) => request<Customer>(`/customers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCustomer: (id: number) => request<void>(`/customers/${id}`, { method: 'DELETE' }),

  // Suppliers
  getSuppliers: () => request<Supplier[]>('/suppliers'),

  // Orders
  getOrders: () => request<Order[]>('/orders'),
  getOrder: (id: number) => request<Order>(`/orders/${id}`),
  createOrder: (data: Partial<Order>) => request<Order>('/orders', { method: 'POST', body: JSON.stringify(data) }),
  completeOrder: (id: number) => request<{ success: boolean }>(`/orders/${id}/complete`, { method: 'POST' }),

  // Inventory
  getLogs: (productId?: number) => request<InventoryLog[]>(`/inventory/logs${productId ? `?productId=${productId}` : ''}`),
  checkAvailability: (productId: number, start: string, end: string) => 
    request<{ available: number }>(`/inventory/availability?productId=${productId}&start=${start}&end=${end}`),
  exportStock: (orderId: number, productId: number, quantity: number, note?: string) =>
    request<{ success: boolean }>('/inventory/export', { method: 'POST', body: JSON.stringify({ orderId, productId, quantity, note }) }),
  importStock: (orderId: number, productId: number, quantity: number, note?: string) =>
    request<{ success: boolean; isExternal: boolean; supplierId?: number }>('/inventory/import', { method: 'POST', body: JSON.stringify({ orderId, productId, quantity, note }) }),
};
