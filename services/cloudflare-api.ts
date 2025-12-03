// Cloudflare API Service
// Thay đổi URL này sau khi deploy Cloudflare Worker
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8787';

// Helper function
async function fetchAPI<T>(endpoint: string, options?: RequestInit): Promise<T> {
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

// ============ AUTH ============
export const authAPI = {
  login: (username: string, password: string) =>
    fetchAPI<{ user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),
};

// ============ STAFF ============
export const staffAPI = {
  getAll: () => fetchAPI<any[]>('/api/staff'),
  create: (data: any) => fetchAPI<{ id: number }>('/api/staff', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => fetchAPI<{ success: boolean }>(`/api/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => fetchAPI<{ success: boolean }>(`/api/staff/${id}`, { method: 'DELETE' }),
};

// ============ PRODUCTS ============
export const productsAPI = {
  getAll: () => fetchAPI<any[]>('/api/products'),
  create: (data: any) => fetchAPI<{ id: number }>('/api/products', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => fetchAPI<{ success: boolean }>(`/api/products/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => fetchAPI<{ success: boolean }>(`/api/products/${id}`, { method: 'DELETE' }),
};

// ============ CUSTOMERS ============
export const customersAPI = {
  getAll: () => fetchAPI<any[]>('/api/customers'),
  create: (data: any) => fetchAPI<{ id: number }>('/api/customers', { method: 'POST', body: JSON.stringify(data) }),
};

// ============ ORDERS ============
export const ordersAPI = {
  getAll: () => fetchAPI<any[]>('/api/orders'),
  create: (data: any) => fetchAPI<{ id: number }>('/api/orders', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => fetchAPI<{ success: boolean }>(`/api/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
};

// ============ INVENTORY LOGS ============
export const logsAPI = {
  getAll: () => fetchAPI<any[]>('/api/logs'),
  create: (data: any) => fetchAPI<{ id: number }>('/api/logs', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: number, data: any) => fetchAPI<{ success: boolean }>(`/api/logs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id: number) => fetchAPI<{ success: boolean }>(`/api/logs/${id}`, { method: 'DELETE' }),
};

// ============ IMAGE UPLOAD ============
export const uploadAPI = {
  uploadImage: async (file: File): Promise<{ url: string; filename: string }> => {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },
  
  getImageUrl: (filename: string) => `${API_URL}/api/images/${filename}`,
};
