
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
  totalOwned: number; // Asset count
  currentPhysicalStock: number; // In warehouse right now
  imageUrl: string;
  images?: string[]; // Multiple images
  location?: string; // Vị trí kho (VD: Kệ A1, Kho 2)
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
  productId: number;
  quantity: number;
  isExternal: boolean;
  supplierId?: number;
  costPrice?: number;
  exportedQuantity: number;
  returnedQuantity: number;
  returnedAt?: string;
  returnedBy?: string;
  note?: string; // Ghi chú cho từng sản phẩm
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
  finalAmount?: number;
  completedBy?: string;
  note?: string; // Ghi chú chung cho đơn hàng
}

export interface InventoryLog {
  id: number;
  productId: number;
  orderId: number;
  actionType: 'EXPORT' | 'IMPORT' | 'ADJUST';
  quantity: number;
  timestamp: string;
  note?: string;
  staffId?: number;
  staffName?: string;
}

export interface Staff {
  id: number;
  username: string;
  password: string;
  name: string;
  role: 'admin' | 'staff';
  active: boolean;
}
