export enum OrderStatus {
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
  images?: string[];
  location?: string;
  specs?: string;
  isSerialized?: boolean;
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
  exportedQuantity: number;
  returnedQuantity: number;
  returnedAt?: string;
  returnedBy?: string;
  note?: string;
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
  note?: string;
}

export interface InventoryLog {
  id: number;
  productId: number;
  orderId: number;
  actionType: 'EXPORT' | 'IMPORT' | 'ADJUST' | 'CLEAN';
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
  passcode?: string;  // Quick numeric passcode for QR scan login
  name: string;
  role: 'admin' | 'staff';
  active: boolean;
}

// Equipment Set - Danh sách thiết bị với QR code
export interface EquipmentSet {
  id: number;
  name: string;           // Tên danh sách, VD: "Set sự kiện A"
  code: string;           // Mã unique để tạo QR, VD: "SET-001"
  productIds: number[];   // Danh sách ID sản phẩm
  note?: string;
  createdAt: string;
}
