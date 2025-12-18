
export enum OrderStatus {
  DRAFT = 'DRAFT',
  BOOKED = 'BOOKED',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

export enum DeviceStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  ON_RENT = 'ON_RENT',
  DIRTY = 'DIRTY',
  BROKEN = 'BROKEN'
}

export interface Product {
  id: number;
  code: string;
  name: string;
  category: string;
  pricePerDay: number;
  pricePerWeek?: number;
  pricePerMonth?: number;
  unit?: string;
  isSerialized: boolean;
  totalOwned: number; // Asset count
  currentPhysicalStock: number; // In warehouse right now
  imageUrl: string;
  images?: string[]; // Multiple images
  location?: string; // Vị trí kho (VD: Kệ A1, Kho 2)
  specs?: string; // Thông số kỹ thuật
  availableQty?: number;
  reservedQty?: number;
  onRentQty?: number;
  dirtyQty?: number;
  brokenQty?: number;
}

export interface Warehouse {
  id: number;
  name: string;
  address?: string;
}

export interface Stock {
  id: number;
  productId: number;
  warehouseId: number;
  availableQty: number;
  reservedQty: number;
  onRentQty: number;
  dirtyQty: number;
  brokenQty: number;
}

export interface DeviceSerial {
  id: number;
  productId: number;
  serialNumber: string;
  warehouseId: number;
  status: DeviceStatus;
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
  actionType: 'EXPORT' | 'IMPORT' | 'ADJUST' | 'PREPARE' | 'CLEAN';
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
