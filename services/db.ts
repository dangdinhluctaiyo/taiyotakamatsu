
import { Product, Order, OrderStatus, Customer, Supplier, OrderItem, InventoryLog, Staff } from '../types';

// Initial Mock Data (Fallback if storage empty)
const INITIAL_PRODUCTS: Product[] = [
  { id: 1, code: 'GHE-HP01', name: 'Ghế Chiavari Gold', category: 'Bàn ghế', pricePerDay: 50000, totalOwned: 100, currentPhysicalStock: 100, imageUrl: 'https://picsum.photos/200/200?random=1', images: ['https://picsum.photos/400/300?random=11', 'https://picsum.photos/400/300?random=12'], location: 'Kệ A1 - Kho 1', specs: 'Chất liệu: Nhựa PP cao cấp\nMàu sắc: Vàng Gold\nKích thước: 40x40x90cm\nTải trọng: 150kg' },
  { id: 2, code: 'LED-P3', name: 'Màn hình LED P3', category: 'Âm thanh AS', pricePerDay: 800000, totalOwned: 20, currentPhysicalStock: 20, imageUrl: 'https://picsum.photos/200/200?random=2', images: ['https://picsum.photos/400/300?random=21', 'https://picsum.photos/400/300?random=22'], location: 'Kệ B2 - Kho 2', specs: 'Độ phân giải: P3 (3mm pixel pitch)\nKích thước module: 192x192mm\nĐộ sáng: 1500 nits\nTần số quét: 3840Hz' },
  { id: 3, code: 'LOA-JBL', name: 'Loa JBL Full Range', category: 'Âm thanh AS', pricePerDay: 500000, totalOwned: 10, currentPhysicalStock: 10, imageUrl: 'https://picsum.photos/200/200?random=3', images: ['https://picsum.photos/400/300?random=31'], location: 'Kệ C1 - Kho 2', specs: 'Công suất: 500W RMS\nTần số: 45Hz - 20kHz\nTrở kháng: 8 Ohm\nSPL: 128dB' },
];

const INITIAL_CUSTOMERS: Customer[] = [
  { id: 1, name: 'Anh Lực', phone: '0909123456' },
  { id: 2, name: 'Công ty Sự Kiện Việt', phone: '0912345678' },
];

const INITIAL_SUPPLIERS: Supplier[] = [
  { id: 1, name: 'Kho Âm Thanh Giá Rẻ', contact: 'Mr. Tuấn' },
  { id: 2, name: 'Bàn Ghế Sài Gòn', contact: 'Ms. Lan' },
];

const INITIAL_STAFF: Staff[] = [
  { id: 1, username: 'admin', password: 'admin123', name: 'Quản trị viên', role: 'admin', active: true },
  { id: 2, username: 'nhanvien1', password: '123456', name: 'Nguyễn Văn A', role: 'staff', active: true },
];

const generateId = () => Math.floor(Math.random() * 100000);
const STORAGE_KEY = 'lucrental_pro_db_v4'; // Bump version for staff

export class MockDB {
  products: Product[] = [];
  orders: Order[] = [];
  customers: Customer[] = [];
  suppliers: Supplier[] = [];
  logs: InventoryLog[] = [];
  staff: Staff[] = [];
  currentUser: Staff | null = null;

  constructor() {
    this.load();
    this.loadSession();
  }

  private save() {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        products: this.products,
        orders: this.orders,
        customers: this.customers,
        suppliers: this.suppliers,
        logs: this.logs,
        staff: this.staff
      }));
    }
  }

  private loadSession() {
    if (typeof window !== 'undefined') {
      const session = localStorage.getItem('lucrental_session');
      if (session) {
        try {
          const userId = JSON.parse(session);
          this.currentUser = this.staff.find(s => s.id === userId) || null;
        } catch (e) {
          this.currentUser = null;
        }
      }
    }
  }

  private load() {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(STORAGE_KEY);
      if (data) {
        try {
          const parsed = JSON.parse(data);
          this.products = parsed.products || INITIAL_PRODUCTS;
          this.orders = parsed.orders || [];
          this.customers = parsed.customers || INITIAL_CUSTOMERS;
          this.suppliers = parsed.suppliers || INITIAL_SUPPLIERS;
          this.logs = parsed.logs || [];
          this.staff = parsed.staff || INITIAL_STAFF;
          return;
        } catch (e) {
          console.error("Failed to load DB", e);
        }
      }
    }
    // Fallback init
    this.products = JSON.parse(JSON.stringify(INITIAL_PRODUCTS));
    this.customers = JSON.parse(JSON.stringify(INITIAL_CUSTOMERS));
    this.suppliers = JSON.parse(JSON.stringify(INITIAL_SUPPLIERS));
    this.staff = JSON.parse(JSON.stringify(INITIAL_STAFF));
    this.orders = [];
    this.logs = [];
    this.save();
  }

  reset() {
    localStorage.removeItem(STORAGE_KEY);
    window.location.reload();
  }

  // --- PRODUCT MANAGEMENT ---
  
  saveProduct(product: Product) {
    if (product.id === 0) {
      // Create New
      const newProduct = { ...product, id: generateId(), currentPhysicalStock: product.totalOwned };
      this.products.push(newProduct);
    } else {
      // Update Existing
      const index = this.products.findIndex(p => p.id === product.id);
      if (index !== -1) {
        const oldProduct = this.products[index];
        const stockDiff = product.totalOwned - oldProduct.totalOwned;
        
        this.products[index] = {
          ...product,
          currentPhysicalStock: oldProduct.currentPhysicalStock + stockDiff
        };
      }
    }
    this.save();
  }

  deleteProduct(id: number) {
    this.products = this.products.filter(p => p.id !== id);
    this.save();
  }

  // --- CORE LOGIC ---

  checkAvailability(productId: number, start: string, end: string): number {
    const product = this.products.find(p => p.id === productId);
    if (!product) return 0;

    const sDate = new Date(start);
    const eDate = new Date(end);

    const busyQuantity = this.orders
      .filter(o => 
        (o.status === OrderStatus.BOOKED || o.status === OrderStatus.ACTIVE) &&
        new Date(o.rentalStartDate) <= eDate && 
        new Date(o.expectedReturnDate) >= sDate
      )
      .reduce((total, order) => {
        const item = order.items.find(i => i.productId === productId && !i.isExternal);
        return total + (item ? item.quantity : 0);
      }, 0);

    return Math.max(0, product.totalOwned - busyQuantity);
  }

  createOrder(order: Order): Order {
    // Ensure new items have 0 exported/returned
    const items = order.items.map(i => ({
      ...i,
      exportedQuantity: 0,
      returnedQuantity: 0
    }));
    
    const newOrder = { ...order, items, id: generateId(), status: OrderStatus.BOOKED };
    this.orders.push(newOrder);
    this.save();
    return newOrder;
  }

  exportStock(orderId: number, productId: number, qty: number, note: string) {
    const product = this.products.find(p => p.id === productId);
    const order = this.orders.find(o => o.id === orderId);
    
    if (product && order) {
      product.currentPhysicalStock -= qty;
      
      const item = order.items.find(i => i.productId === productId);
      if (item) {
        item.exportedQuantity = (item.exportedQuantity || 0) + qty;
      }

      this.logs.push({
        id: generateId(),
        productId,
        orderId,
        actionType: 'EXPORT',
        quantity: qty,
        timestamp: new Date().toISOString(),
        note
      });
      if (order.status === OrderStatus.BOOKED) {
        order.status = OrderStatus.ACTIVE;
      }
      this.save();
    }
  }

  importStock(orderId: number, productId: number, qty: number, note: string) {
    const product = this.products.find(p => p.id === productId);
    const order = this.orders.find(o => o.id === orderId);

    if (product && order) {
       const item = order.items.find(i => i.productId === productId);
       if (!item) return;

       // AUTO-CORRECTION: If user forgot to scan Export, we must assume they took it.
       // Otherwise, returning items that were never subtracted causes Phantom Stock (Stock > TotalOwned).
       const currentExported = item.exportedQuantity || 0;
       const newReturnedTotal = item.returnedQuantity + qty;
       
       if (newReturnedTotal > currentExported) {
         // Determine the phantom amount (items being returned that were never officially exported)
         const phantomQty = newReturnedTotal - currentExported;
         
         // Retroactively export them to balance the ledger
         product.currentPhysicalStock -= phantomQty; 
         item.exportedQuantity = (item.exportedQuantity || 0) + phantomQty;
         
         this.logs.push({
           id: generateId(),
           productId,
           orderId,
           actionType: 'ADJUST',
           quantity: phantomQty,
           timestamp: new Date().toISOString(),
           note: 'Auto-adjust: Detected return of un-scanned items'
         });
       }

       // Normal Return Logic
       product.currentPhysicalStock += qty;
       item.returnedQuantity += qty;
       
       this.logs.push({
        id: generateId(),
        productId,
        orderId,
        actionType: 'IMPORT',
        quantity: qty,
        timestamp: new Date().toISOString(),
        note
      });

      const allReturned = order.items.every(i => i.returnedQuantity >= i.quantity);
      if (allReturned) {
        order.status = OrderStatus.COMPLETED;
        order.actualReturnDate = new Date().toISOString();
      }
      this.save();
    }
  }

  // FORCE COMPLETE: Manually finish order and reconcile stock
  forceCompleteOrder(orderId: number, staffName?: string) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    const now = new Date().toISOString();

    order.items.forEach(item => {
      const product = this.products.find(p => p.id === item.productId);
      if (product && !item.isExternal) {
        // Return outstanding items to stock
        const outstanding = (item.exportedQuantity || 0) - item.returnedQuantity;
        if (outstanding > 0) {
          product.currentPhysicalStock += outstanding;
          item.returnedQuantity += outstanding;
          item.returnedAt = now;
          item.returnedBy = staffName || 'System';
          
          this.logs.push({
            id: generateId(),
            productId: item.productId,
            orderId: order.id,
            actionType: 'IMPORT',
            quantity: outstanding,
            timestamp: now,
            note: `Auto Restock - NV: ${staffName || 'System'}`
          });
        }
      }
    });

    order.status = OrderStatus.COMPLETED;
    order.actualReturnDate = now;
    order.completedBy = staffName;
    
    // Calculate final amount based on actual days
    const start = new Date(order.rentalStartDate);
    const end = new Date(now);
    const actualDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    order.finalAmount = order.items.reduce((sum, item) => {
      const product = this.products.find(p => p.id === item.productId);
      return sum + ((product?.pricePerDay || 0) * item.quantity * actualDays);
    }, 0);
    
    this.save();
  }

  // Update order
  updateOrder(orderId: number, updates: Partial<Order>) {
    const index = this.orders.findIndex(o => o.id === orderId);
    if (index !== -1) {
      this.orders[index] = { ...this.orders[index], ...updates };
      this.save();
    }
  }

  // Add customer
  addCustomer(customer: Omit<Customer, 'id'>): Customer {
    const newCustomer = { ...customer, id: generateId() };
    this.customers.push(newCustomer);
    this.save();
    return newCustomer;
  }

  // Add supplier
  addSupplier(supplier: Omit<Supplier, 'id'>): Supplier {
    const newSupplier = { ...supplier, id: generateId() };
    this.suppliers.push(newSupplier);
    this.save();
    return newSupplier;
  }

  // Update log
  updateLog(logId: number, updates: Partial<InventoryLog>) {
    const index = this.logs.findIndex(l => l.id === logId);
    if (index !== -1) {
      this.logs[index] = { ...this.logs[index], ...updates };
      this.save();
    }
  }

  // Delete log
  deleteLog(logId: number) {
    this.logs = this.logs.filter(l => l.id !== logId);
    this.save();
  }

  // --- STAFF MANAGEMENT ---
  
  login(username: string, password: string): Staff | null {
    const user = this.staff.find(s => s.username === username && s.password === password && s.active);
    if (user) {
      this.currentUser = user;
      localStorage.setItem('lucrental_session', JSON.stringify(user.id));
    }
    return user;
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem('lucrental_session');
  }

  addStaff(staffData: Omit<Staff, 'id'>): Staff {
    const newStaff = { ...staffData, id: generateId() };
    this.staff.push(newStaff);
    this.save();
    return newStaff;
  }

  updateStaff(staffId: number, updates: Partial<Staff>) {
    const index = this.staff.findIndex(s => s.id === staffId);
    if (index !== -1) {
      this.staff[index] = { ...this.staff[index], ...updates };
      this.save();
    }
  }

  deleteStaff(staffId: number) {
    this.staff = this.staff.filter(s => s.id !== staffId);
    this.save();
  }
}

export const db = new MockDB();
