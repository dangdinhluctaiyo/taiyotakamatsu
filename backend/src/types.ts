export enum OrderStatus {
  DRAFT = 'DRAFT',
  BOOKED = 'BOOKED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export interface Product {
  id: number;
  code: string;
  name: string;
  category: string;
  pricePerDay: number;
  totalOwned: number;
  currentPhysicalStock: number;
  imageUrl: string;
  images?: string[]; // Multiple images (JSON array)
  location?: string; // Vị trí kho
  specs?: string; // Thông số kỹ thuật
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string;
}

export interface OrderItem {
  itemId: string;
  orderId: number;
  productId: number;
  quantity: number;
  isExternal: boolean;
  supplierId?: number;
  costPrice?: number;
  exportedQuantity: number;
  returnedQuantity: number;
}

export interface Order {
  id: number;
  customerId: number;
  rentalStartDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  status: OrderStatus;
  items: OrderItem[];
  totalAmount: number;
}

export interface InventoryLog {
  id: number;
  productId: number;
  orderId: number;
  actionType: 'EXPORT' | 'IMPORT' | 'ADJUST';
  quantity: number;
  timestamp: string;
  note?: string;
}
