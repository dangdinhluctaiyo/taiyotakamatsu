import { createClient } from '@supabase/supabase-js';
import { Product, Order, OrderStatus, Customer, Supplier, InventoryLog, Staff, EquipmentSet } from '../types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseKey);

const generateId = () => Math.floor(Math.random() * 100000);

// Cache key and version for localStorage
const CACHE_KEY = 'taiyo_db_cache_v2';

export class SupabaseDB {
  products: Product[] = [];
  orders: Order[] = [];
  customers: Customer[] = [];
  suppliers: Supplier[] = [];
  logs: InventoryLog[] = [];
  staff: Staff[] = [];
  equipmentSets: EquipmentSet[] = [];
  currentUser: Staff | null = null;
  private initialized = false;
  private refreshPromise: Promise<void> | null = null;

  constructor() {
    this.loadSession();
    // Load from cache immediately (sync)
    this.loadFromLocalCache();
  }

  private loadSession() {
    if (typeof window !== 'undefined') {
      const session = localStorage.getItem('lucrental_session');
      if (session) {
        try { this.currentUser = JSON.parse(session); } catch { this.currentUser = null; }
      }
    }
  }

  // PERF: Load cached data instantly for fast startup
  private loadFromLocalCache() {
    if (typeof window === 'undefined') return;
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached);
        this.products = data.products || [];
        this.orders = data.orders || [];
        this.customers = data.customers || [];
        this.staff = data.staff || [];
        this.logs = data.logs || [];
        this.equipmentSets = data.equipmentSets || [];
        this.initialized = true; // Allow app to render with cached data
        console.log('PWA: Loaded from cache instantly');
      }
    } catch (e) {
      console.warn('PWA: Failed to load cache', e);
    }
  }

  // PERF: Save data to localStorage for next startup
  // Excludes large fields (images) to stay under 5MB quota
  private saveToLocalCache() {
    if (typeof window === 'undefined') return;
    try {
      // Strip images and large fields from products to reduce size
      // CRITICAL: Exclude base64 imageUrl (some are 4MB+!)
      const lightProducts = this.products.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category,
        pricePerDay: p.pricePerDay,
        totalOwned: p.totalOwned,
        currentPhysicalStock: p.currentPhysicalStock,
        // Only cache real URLs, skip base64 strings (start with 'data:')
        imageUrl: p.imageUrl && !p.imageUrl.startsWith('data:') ? p.imageUrl : null,
        location: p.location,
        isSerialized: p.isSerialized
      }));

      // Only cache essential order fields
      const lightOrders = this.orders.slice(0, 50).map(o => ({
        id: o.id,
        customerId: o.customerId,
        status: o.status,
        rentalStartDate: o.rentalStartDate,
        expectedReturnDate: o.expectedReturnDate,
        items: o.items
      }));

      const data = {
        products: lightProducts,
        orders: lightOrders,
        customers: this.customers,
        staff: this.staff,
        logs: this.logs.slice(0, 50), // Only 50 recent logs
        equipmentSets: this.equipmentSets.slice(0, 20),
        timestamp: Date.now()
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      console.log('PWA: Saved to cache');
    } catch (e) {
      console.warn('PWA: Failed to save cache', e);
    }
  }

  async init() {
    // If already initialized from cache, just refresh in background
    if (this.initialized) {
      this.refreshInBackground();
      return;
    }

    // First time load (no cache) - must wait
    try {
      const [products, orders, customers, staff, logs, equipmentSets] = await Promise.all([
        this.fetchProducts(),
        this.fetchOrders(),
        this.fetchCustomers(),
        this.fetchStaff(),
        this.fetchLogs(),
        this.fetchEquipmentSetsFromSupabase(),
      ]);
      this.products = products;
      this.orders = orders;
      this.customers = customers;
      this.staff = staff;
      this.logs = logs;
      this.equipmentSets = equipmentSets;
      this.initialized = true;
      this.saveToLocalCache();
    } catch (e) { console.error('Failed to init Supabase DB:', e); }
  }

  // PERF: Refresh data in background without blocking UI
  private async refreshInBackground() {
    if (this.refreshPromise) return; // Already refreshing

    this.refreshPromise = (async () => {
      try {
        const [products, orders, customers, staff, logs, equipmentSets] = await Promise.all([
          this.fetchProducts(),
          this.fetchOrders(),
          this.fetchCustomers(),
          this.fetchStaff(),
          this.fetchLogs(),
          this.fetchEquipmentSetsFromSupabase(),
        ]);
        this.products = products;
        this.orders = orders;
        this.customers = customers;
        this.staff = staff;
        this.logs = logs;
        this.equipmentSets = equipmentSets;
        this.saveToLocalCache();
        console.log('PWA: Background refresh complete');
      } catch (e) {
        console.error('PWA: Background refresh failed:', e);
      } finally {
        this.refreshPromise = null;
      }
    })();
  }

  async refresh() {
    // No delay needed - Supabase updates are immediately consistent
    this.initialized = false;
    await this.init();
    this.saveToLocalCache();
  }

  // Partial refresh methods for better performance
  async refreshProducts() {
    this.products = await this.fetchProducts();
  }

  async refreshOrders() {
    this.orders = await this.fetchOrders();
  }

  async refreshLogs() {
    this.logs = await this.fetchLogs();
  }

  async refreshCustomers() {
    this.customers = await this.fetchCustomers();
  }

  // ============ FETCH DATA ============
  private async fetchProducts(): Promise<Product[]> {
    // OPTIMIZED: Only fetch essential columns, exclude large 'images' array (base64)
    // This reduces response size significantly for faster loading
    const { data, error } = await supabase
      .from('products')
      .select('id, code, name, category, price_per_day, total_owned, current_physical_stock, image_url, location, specs, is_serialized');
    if (error) throw error;
    return (data || []).map((p: any) => ({
      id: p.id, code: p.code, name: p.name, category: p.category,
      pricePerDay: p.price_per_day, totalOwned: p.total_owned,
      currentPhysicalStock: p.current_physical_stock,
      imageUrl: p.image_url, images: [], // Images loaded on-demand
      location: p.location, specs: p.specs, isSerialized: p.is_serialized
    }));
  }

  private async fetchOrders(): Promise<Order[]> {
    // Use JOIN to fetch orders with items in a single query (optimized from N+1)
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (*)
      `)
      .order('id', { ascending: false });

    if (error) throw error;

    return (orders || []).map((o: any) => ({
      id: o.id,
      customerId: o.customer_id,
      rentalStartDate: o.rental_start_date,
      expectedReturnDate: o.expected_return_date,
      actualReturnDate: o.actual_return_date,
      status: o.status as OrderStatus,
      totalAmount: o.total_amount,
      finalAmount: o.final_amount,
      note: o.note,
      completedBy: o.completed_by,
      items: (o.order_items || []).map((i: any) => ({
        itemId: i.id.toString(),
        productId: i.product_id,
        quantity: i.quantity,
        isExternal: i.is_external,
        supplierId: i.supplier_id,
        exportedQuantity: i.exported_quantity,
        returnedQuantity: i.returned_quantity,
        note: i.note
      }))
    }));
  }

  private async fetchCustomers(): Promise<Customer[]> {
    const { data, error } = await supabase.from('customers').select('*');
    if (error) throw error;
    return data || [];
  }

  private async fetchStaff(): Promise<Staff[]> {
    const { data, error } = await supabase.from('staff').select('*');
    if (error) throw error;
    return (data || []).map((s: any) => ({ ...s, active: !!s.active }));
  }

  private async fetchLogs(): Promise<InventoryLog[]> {
    // Limit to 500 most recent logs for faster loading
    const { data, error } = await supabase
      .from('inventory_logs')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data || []).map((l: any) => ({
      id: l.id, productId: l.product_id, orderId: l.order_id, actionType: l.action_type,
      quantity: l.quantity, staffId: l.staff_id, staffName: l.staff_name, note: l.note, timestamp: l.timestamp
    }));
  }

  // Equipment Sets - stored in localStorage for now (can migrate to Supabase later)
  private async fetchEquipmentSets(): Promise<EquipmentSet[]> {
    if (typeof window === 'undefined') return [];
    const stored = localStorage.getItem('lucrental_equipment_sets');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Migrate old format (items) to new format (productIds)
        const migrated = parsed.map((set: EquipmentSet & { items?: { productId: number }[] }) => {
          if (set.items && !set.productIds) {
            return {
              ...set,
              productIds: set.items.map(i => i.productId),
              items: undefined
            };
          }
          return { ...set, productIds: set.productIds || [] };
        });
        // Save migrated data back
        localStorage.setItem('lucrental_equipment_sets', JSON.stringify(migrated));
        return migrated;
      } catch { return []; }
    }
    return [];
  }

  // Fetch from Supabase (new)
  private async fetchEquipmentSetsFromSupabase(): Promise<EquipmentSet[]> {
    const { data, error } = await supabase
      .from('equipment_sets')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching equipment_sets from Supabase:', error);
      // Fallback to localStorage if table doesn't exist yet
      return this.fetchEquipmentSets();
    }

    if (data && data.length > 0) {
      // Map Supabase columns to TypeScript interface
      return data.map(row => ({
        id: row.id,
        name: row.name,
        code: row.code,
        productIds: row.product_ids || [],
        note: row.note,
        createdAt: row.created_at
      }));
    }

    // If Supabase is empty but localStorage has data, migrate it
    const localData = await this.fetchEquipmentSets();
    if (localData.length > 0) {
      console.log('Migrating equipment_sets from localStorage to Supabase...');
      for (const set of localData) {
        await supabase.from('equipment_sets').insert({
          name: set.name,
          code: set.code,
          product_ids: set.productIds,
          note: set.note
        });
      }
      // Clear localStorage after migration
      localStorage.removeItem('lucrental_equipment_sets');
      // Re-fetch from Supabase
      return this.fetchEquipmentSetsFromSupabase();
    }

    return [];
  }

  // ============ EQUIPMENT SETS (Admin only) ============
  getEquipmentSetByCode(code: string): EquipmentSet | undefined {
    return this.equipmentSets.find(s => s.code.toLowerCase() === code.toLowerCase());
  }

  async addEquipmentSet(set: Omit<EquipmentSet, 'id' | 'createdAt'>): Promise<EquipmentSet> {
    const { data, error } = await supabase
      .from('equipment_sets')
      .insert({
        name: set.name,
        code: set.code,
        product_ids: set.productIds,
        note: set.note
      })
      .select()
      .single();

    if (error) {
      console.error('Error adding equipment set:', error);
      throw error;
    }

    const newSet: EquipmentSet = {
      id: data.id,
      name: data.name,
      code: data.code,
      productIds: data.product_ids || [],
      note: data.note,
      createdAt: data.created_at
    };
    this.equipmentSets.push(newSet);
    return newSet;
  }

  async updateEquipmentSet(id: number, updates: Partial<EquipmentSet>) {
    const { error } = await supabase
      .from('equipment_sets')
      .update({
        name: updates.name,
        product_ids: updates.productIds,
        note: updates.note
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating equipment set:', error);
      return;
    }

    const index = this.equipmentSets.findIndex(s => s.id === id);
    if (index !== -1) {
      this.equipmentSets[index] = { ...this.equipmentSets[index], ...updates };
    }
  }

  async deleteEquipmentSet(id: number) {
    const { error } = await supabase
      .from('equipment_sets')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting equipment set:', error);
      return;
    }

    this.equipmentSets = this.equipmentSets.filter(s => s.id !== id);
  }

  generateSetCode(): string {
    const count = this.equipmentSets.length + 1;
    return `SET-${String(count).padStart(3, '0')}`;
  }

  // ============ AUTH ============
  login(username: string, password: string): Staff | null {
    const user = this.staff.find(s => s.username === username && s.password === password && s.active);
    if (user) { this.currentUser = user; localStorage.setItem('lucrental_session', JSON.stringify(user)); }
    return user || null;
  }

  // Quick login by passcode (for QR deep link)
  loginByPasscode(passcode: string): Staff | null {
    const user = this.staff.find(s => s.passcode === passcode && s.active);
    if (user) {
      this.currentUser = user;
      localStorage.setItem('lucrental_session', JSON.stringify(user));
    }
    return user || null;
  }

  async loginAsync(username: string, password: string): Promise<Staff | null> {
    const { data } = await supabase.from('staff').select('*').eq('username', username).eq('password', password).eq('active', true).single();
    if (data) { this.currentUser = data; localStorage.setItem('lucrental_session', JSON.stringify(data)); await this.init(); }
    return data || this.login(username, password);
  }

  logout() { this.currentUser = null; localStorage.removeItem('lucrental_session'); }
  reset() { localStorage.removeItem('lucrental_session'); window.location.reload(); }

  // ============ PRODUCTS ============
  async saveProduct(product: Product) {
    if (product.id === 0) {
      const { data, error } = await supabase.from('products').insert({
        code: product.code, name: product.name, category: product.category || 'Khác',
        price_per_day: product.pricePerDay, total_owned: product.totalOwned,
        current_physical_stock: product.totalOwned, image_url: product.imageUrl,
        images: product.images || [], location: product.location, specs: product.specs,
        is_serialized: product.isSerialized || false
      }).select().single();
      if (!error && data) this.products.push({ ...product, id: data.id, currentPhysicalStock: product.totalOwned });
    } else {
      const oldProduct = this.products.find(p => p.id === product.id);
      const stockDiff = oldProduct ? product.totalOwned - oldProduct.totalOwned : 0;
      const newStock = oldProduct ? oldProduct.currentPhysicalStock + stockDiff : product.totalOwned;

      await supabase.from('products').update({
        code: product.code, name: product.name, category: product.category,
        price_per_day: product.pricePerDay, total_owned: product.totalOwned,
        current_physical_stock: newStock, image_url: product.imageUrl,
        images: product.images || [], location: product.location, specs: product.specs,
        is_serialized: product.isSerialized || false
      }).eq('id', product.id);

      const index = this.products.findIndex(p => p.id === product.id);
      if (index !== -1) this.products[index] = { ...product, currentPhysicalStock: newStock };
    }
  }

  async deleteProduct(id: number) {
    await supabase.from('products').delete().eq('id', id);
    this.products = this.products.filter(p => p.id !== id);
  }

  // Fetch product images on-demand (not loaded initially for performance)
  async fetchProductImages(productId: number): Promise<string[]> {
    const { data, error } = await supabase
      .from('products')
      .select('images')
      .eq('id', productId)
      .single();
    if (error || !data) return [];
    return data.images || [];
  }

  // ============ CUSTOMERS ============
  async addCustomer(customer: Omit<Customer, 'id'>): Promise<Customer> {
    const { data, error } = await supabase.from('customers').insert(customer).select().single();
    const newCustomer = data || { ...customer, id: generateId() };
    this.customers.push(newCustomer);
    return newCustomer;
  }

  async updateCustomer(id: number, updates: Partial<Customer>) {
    await supabase.from('customers').update(updates).eq('id', id);
    const index = this.customers.findIndex(c => c.id === id);
    if (index !== -1) this.customers[index] = { ...this.customers[index], ...updates };
  }

  async deleteCustomer(id: number) {
    await supabase.from('customers').delete().eq('id', id);
    this.customers = this.customers.filter(c => c.id !== id);
  }

  // ============ STAFF ============
  async addStaff(staffData: Omit<Staff, 'id'>): Promise<Staff> {
    const { data } = await supabase.from('staff').insert(staffData).select().single();
    const newStaff = data || { ...staffData, id: generateId() };
    this.staff.push(newStaff);
    return newStaff;
  }

  async updateStaff(staffId: number, updates: Partial<Staff>) {
    await supabase.from('staff').update(updates).eq('id', staffId);
    const index = this.staff.findIndex(s => s.id === staffId);
    if (index !== -1) this.staff[index] = { ...this.staff[index], ...updates };
  }

  async deleteStaff(staffId: number) {
    await supabase.from('staff').delete().eq('id', staffId);
    this.staff = this.staff.filter(s => s.id !== staffId);
  }

  addSupplier(supplier: Omit<Supplier, 'id'>): Supplier {
    const newSupplier = { ...supplier, id: generateId() };
    this.suppliers.push(newSupplier);
    return newSupplier;
  }

  // ============ ORDERS ============
  async createOrder(order: Order): Promise<Order> {
    const items = order.items.map(i => ({ ...i, exportedQuantity: 0, returnedQuantity: 0 }));
    const newOrder = { ...order, items, id: 0, status: OrderStatus.BOOKED };

    // Save to Supabase
    const { data, error } = await supabase.from('orders').insert({
      customer_id: order.customerId, rental_start_date: order.rentalStartDate,
      expected_return_date: order.expectedReturnDate, status: 'BOOKED',
      total_amount: order.totalAmount, note: order.note
    }).select().single();

    if (error) {
      console.error('Error creating order:', error);
      throw error;
    }

    if (data) {
      newOrder.id = data.id;
      for (const item of items) {
        const { data: itemData } = await supabase.from('order_items').insert({
          order_id: data.id, product_id: item.productId, quantity: item.quantity,
          is_external: item.isExternal, supplier_id: item.supplierId,
          exported_quantity: 0, returned_quantity: 0, note: item.note
        }).select().single();
        if (itemData) {
          item.itemId = itemData.id.toString();
        }
      }
    }

    this.orders.unshift(newOrder);
    return newOrder;
  }

  async updateOrder(orderId: number, updates: Partial<Order>) {
    const dbUpdates: any = {};
    if (updates.status) dbUpdates.status = updates.status;
    if (updates.expectedReturnDate) dbUpdates.expected_return_date = updates.expectedReturnDate;
    if (updates.actualReturnDate) dbUpdates.actual_return_date = updates.actualReturnDate;
    if (updates.totalAmount) dbUpdates.total_amount = updates.totalAmount;
    if (updates.finalAmount) dbUpdates.final_amount = updates.finalAmount;
    if (updates.completedBy) dbUpdates.completed_by = updates.completedBy;
    if (updates.note !== undefined) dbUpdates.note = updates.note;

    await supabase.from('orders').update(dbUpdates).eq('id', orderId);
    const index = this.orders.findIndex(o => o.id === orderId);
    if (index !== -1) this.orders[index] = { ...this.orders[index], ...updates };
  }

  // ============ AVAILABILITY CHECK ============
  checkAvailability(productId: number, start: string, end: string): number {
    const product = this.products.find(p => p.id === productId);
    if (!product) return 0;
    const sDate = new Date(start), eDate = new Date(end);
    const busyQuantity = this.orders
      .filter(o => (o.status === OrderStatus.BOOKED || o.status === OrderStatus.ACTIVE) &&
        new Date(o.rentalStartDate) <= eDate && new Date(o.expectedReturnDate) >= sDate)
      .reduce((total, order) => {
        const item = order.items.find(i => i.productId === productId && !i.isExternal);
        return total + (item ? item.quantity : 0);
      }, 0);
    return Math.max(0, product.totalOwned - busyQuantity);
  }

  async checkAvailabilityAsync(items: { productId: number; quantity: number }[], start: string, end: string) {
    return items.map(i => {
      const available = this.checkAvailability(i.productId, start, end);
      return { productId: i.productId, available, isEnough: available >= i.quantity };
    });
  }

  // Update product stock directly (for standalone exports without order)
  async updateProductStock(productId: number, newStock: number, actionType: 'EXPORT' | 'IMPORT' = 'EXPORT', quantity: number = 0, note: string = '') {
    const product = this.products.find(p => p.id === productId);
    if (!product) throw new Error('Product not found');

    // Update Supabase
    const { error } = await supabase
      .from('products')
      .update({ current_physical_stock: newStock })
      .eq('id', productId);

    if (error) {
      console.error('updateProductStock error:', error);
      throw new Error('Failed to update stock');
    }

    // Update local state
    product.currentPhysicalStock = newStock;

    // Create log
    const log: InventoryLog = {
      id: generateId(),
      productId,
      orderId: 0,
      actionType,
      quantity,
      timestamp: new Date().toISOString(),
      note,
      staffId: this.currentUser?.id,
      staffName: this.currentUser?.name
    };
    this.logs.push(log);

    await supabase.from('inventory_logs').insert({
      product_id: productId,
      order_id: null,
      action_type: actionType,
      quantity,
      staff_id: this.currentUser?.id,
      staff_name: this.currentUser?.name,
      note
    });
  }

  // ============ INVENTORY OPERATIONS ============
  async exportStock(orderId: number, productId: number, qty: number, note: string) {
    const product = this.products.find(p => p.id === productId);
    const order = this.orders.find(o => o.id === orderId);
    if (!product || !order) {
      console.error('exportStock: product or order not found', { productId, orderId });
      throw new Error('Product or order not found');
    }

    const item = order.items.find(i => i.productId === productId);
    if (!item) {
      console.error('exportStock: item not found in order', { productId, orderId });
      throw new Error('Item not found in order');
    }

    // Calculate new values
    const newPhysicalStock = product.currentPhysicalStock - qty;
    const newExportedQty = (item.exportedQuantity || 0) + qty;
    const newStatus = order.status === OrderStatus.BOOKED ? OrderStatus.ACTIVE : order.status;

    // Update Supabase first - if any fails, throw error
    console.log('exportStock: updating product', productId, 'stock to', newPhysicalStock);
    const { error: productError, data: productData } = await supabase
      .from('products')
      .update({ current_physical_stock: newPhysicalStock })
      .eq('id', productId)
      .select()
      .single();
    if (productError) {
      console.error('exportStock: product update error', productError);
      throw new Error(`Failed to update product stock: ${productError.message}`);
    }
    console.log('exportStock: product updated', productData);

    const { error: orderError } = await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);
    if (orderError) {
      console.error('exportStock: order update error', orderError);
      throw new Error(`Failed to update order status: ${orderError.message}`);
    }

    // Use item.itemId if available, otherwise use order_id + product_id
    const itemId = parseInt(item.itemId);
    let itemUpdateError: any = null;
    console.log('exportStock: updating order_item', itemId, 'exported_quantity to', newExportedQty);
    if (!isNaN(itemId) && itemId > 0) {
      const result = await supabase.from('order_items')
        .update({ exported_quantity: newExportedQty })
        .eq('id', itemId)
        .select()
        .single();
      itemUpdateError = result.error;
      console.log('exportStock: order_item updated by id', result.data);
    } else {
      const result = await supabase.from('order_items')
        .update({ exported_quantity: newExportedQty })
        .eq('order_id', orderId)
        .eq('product_id', productId)
        .select();
      itemUpdateError = result.error;
      console.log('exportStock: order_item updated by order_id+product_id', result.data);
    }
    if (itemUpdateError) {
      console.error('exportStock: order_items update error', itemUpdateError);
      throw new Error(`Failed to update order item: ${itemUpdateError.message}`);
    }

    // Create log
    const { error: logError } = await supabase.from('inventory_logs').insert({
      product_id: productId, order_id: orderId, action_type: 'EXPORT', quantity: qty,
      staff_id: this.currentUser?.id, staff_name: this.currentUser?.name, note
    });
    if (logError) console.error('exportStock: log insert error', logError);

    // Update local state only after Supabase succeeds
    product.currentPhysicalStock = newPhysicalStock;
    item.exportedQuantity = newExportedQty;
    order.status = newStatus;

    const log: InventoryLog = {
      id: generateId(), productId, orderId, actionType: 'EXPORT', quantity: qty,
      timestamp: new Date().toISOString(), note, staffId: this.currentUser?.id, staffName: this.currentUser?.name
    };
    this.logs.unshift(log);
  }

  async importStock(orderId: number, productId: number, qty: number, note: string) {
    const product = this.products.find(p => p.id === productId);
    const order = this.orders.find(o => o.id === orderId);
    if (!product || !order) {
      console.error('importStock: product or order not found', { productId, orderId });
      return;
    }

    const item = order.items.find(i => i.productId === productId);
    if (!item) {
      console.error('importStock: item not found in order', { productId, orderId });
      return;
    }

    // Handle phantom export
    const currentExported = item.exportedQuantity || 0;
    const newReturnedTotal = item.returnedQuantity + qty;
    if (newReturnedTotal > currentExported) {
      const phantomQty = newReturnedTotal - currentExported;
      product.currentPhysicalStock -= phantomQty;
      item.exportedQuantity = (item.exportedQuantity || 0) + phantomQty;
    }

    // Update local state
    product.currentPhysicalStock += qty;
    item.returnedQuantity += qty;

    const allReturned = order.items.every(i => i.returnedQuantity >= i.quantity);
    if (allReturned) {
      order.status = OrderStatus.COMPLETED;
      order.actualReturnDate = new Date().toISOString();
    }

    // Update Supabase
    const { error: productError } = await supabase.from('products').update({ current_physical_stock: product.currentPhysicalStock }).eq('id', productId);
    if (productError) console.error('importStock: product update error', productError);

    // Update by order_id and product_id instead of item id
    const { error: itemError } = await supabase.from('order_items').update({
      exported_quantity: item.exportedQuantity, returned_quantity: item.returnedQuantity
    }).eq('order_id', orderId).eq('product_id', productId);
    if (itemError) console.error('importStock: order_items update error', itemError);

    if (allReturned) {
      const { error: orderError } = await supabase.from('orders').update({ status: 'COMPLETED', actual_return_date: order.actualReturnDate }).eq('id', orderId);
      if (orderError) console.error('importStock: order update error', orderError);
    }

    // Create log
    const log: InventoryLog = {
      id: generateId(), productId, orderId, actionType: 'IMPORT', quantity: qty,
      timestamp: new Date().toISOString(), note, staffId: this.currentUser?.id, staffName: this.currentUser?.name
    };
    this.logs.push(log);
    const { error: logError } = await supabase.from('inventory_logs').insert({
      product_id: productId, order_id: orderId, action_type: 'IMPORT', quantity: qty,
      staff_id: this.currentUser?.id, staff_name: this.currentUser?.name, note
    });
    if (logError) console.error('importStock: log insert error', logError);
  }

  async forceCompleteOrder(orderId: number, staffName?: string) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    order.status = OrderStatus.COMPLETED;
    order.actualReturnDate = new Date().toISOString();
    order.completedBy = staffName;

    await supabase.from('orders').update({
      status: 'COMPLETED', actual_return_date: order.actualReturnDate, completed_by: staffName
    }).eq('id', orderId);
  }

  // ============ LOGS ============
  async updateLog(logId: number, updates: Partial<InventoryLog>) {
    await supabase.from('inventory_logs').update({
      quantity: updates.quantity, staff_name: updates.staffName, note: updates.note
    }).eq('id', logId);
    const index = this.logs.findIndex(l => l.id === logId);
    if (index !== -1) this.logs[index] = { ...this.logs[index], ...updates };
  }

  async deleteLog(logId: number) {
    await supabase.from('inventory_logs').delete().eq('id', logId);
    this.logs = this.logs.filter(l => l.id !== logId);
  }

  // ============ FORECAST ============
  getForecastStockForDate(productId: number, date: string) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return { physicalStock: 0, expectedReturns: 0, expectedExports: 0, forecastStock: 0, orders: [] };

    const targetDate = new Date(date); targetDate.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const physicalStock = product.currentPhysicalStock;
    let expectedReturns = 0, expectedExports = 0;
    const orderDetails: any[] = [];

    this.orders.filter(o => o.status === OrderStatus.BOOKED || o.status === OrderStatus.ACTIVE).forEach(order => {
      const item = order.items.find(i => i.productId === productId && !i.isExternal);
      if (!item) return;

      const startDate = new Date(order.rentalStartDate); startDate.setHours(0, 0, 0, 0);
      const returnDate = new Date(order.expectedReturnDate); returnDate.setHours(0, 0, 0, 0);
      const customer = this.customers.find(c => c.id === order.customerId);
      const customerName = customer?.name || `Đơn #${order.id}`;
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

    return {
      physicalStock, expectedReturns, expectedExports,
      forecastStock: Math.max(0, physicalStock + expectedReturns - expectedExports),
      orders: orderDetails.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    };
  }

  getForecastStockRange(productId: number, startDate: string, days: number) {
    const result = [];
    const start = new Date(startDate);
    for (let i = 0; i < days; i++) {
      const date = new Date(start); date.setDate(start.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const forecast = this.getForecastStockForDate(productId, dateStr);
      result.push({
        date: dateStr, physicalStock: forecast.physicalStock, forecastStock: forecast.forecastStock,
        expectedReturns: forecast.expectedReturns, expectedExports: forecast.expectedExports
      });
    }
    return result;
  }

  getAllProductsForecast(date: string) {
    return this.products.map(p => {
      const forecast = this.getForecastStockForDate(p.id, date);
      return {
        productId: p.id, productName: p.name, productCode: p.code, currentStock: p.currentPhysicalStock,
        forecastStock: forecast.forecastStock, expectedReturns: forecast.expectedReturns, expectedExports: forecast.expectedExports
      };
    });
  }

  // ============ WAREHOUSE (stub) ============
  async getWarehouseTasks() { return { toPrepare: [], toClean: [] }; }
  async cleanItems() { }
  async prepareOrder() { }
  async shipOrder() { }
  async returnOrder() { }
  async getSerials() { return []; }
  async addSerial() { }
  async deleteSerial() { }
}

export const db = new SupabaseDB();
