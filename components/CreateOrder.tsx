import React, { useState, useEffect, useRef, useMemo } from 'react';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { Product, OrderItem, OrderStatus } from '../types';
import { Plus, Trash2, AlertCircle, UserPlus, Package, X, Search, Calendar, User, ShoppingCart, FileText, ChevronDown } from 'lucide-react';
import { useToast } from './Toast';

export const CreateOrder: React.FC<{ onClose: () => void; refreshApp: () => void }> = ({ onClose, refreshApp }) => {
  const { error } = useToast();
  const [customerId, setCustomerId] = useState<number | null>(null);
  const today = new Date().toISOString().split('T')[0];
  const [dates, setDates] = useState({ start: today, end: today });
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [estimatedTotal, setEstimatedTotal] = useState(0);

  const [tempProduct, setTempProduct] = useState<Product | null>(null);
  const [tempQty, setTempQty] = useState(1);
  const [tempNote, setTempNote] = useState('');
  const [availableQty, setAvailableQty] = useState<number | null>(null);
  const [subRentMode, setSubRentMode] = useState(false);
  const [subRentSupplier, setSubRentSupplier] = useState<number | null>(null);
  const [orderNote, setOrderNote] = useState('');

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', pricePerDay: 0, quantity: 1, supplierId: null as number | null, note: '' });
  const [customItems, setCustomItems] = useState<{ name: string; pricePerDay: number; quantity: number; supplierId?: number; note?: string }[]>([]);

  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const productSearchRef = useRef<HTMLDivElement>(null);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return db.products.filter(p => p.id > 0);
    const search = productSearch.toLowerCase();
    return db.products.filter(p => p.id > 0 && (p.name.toLowerCase().includes(search) || p.code.toLowerCase().includes(search)));
  }, [productSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(e.target as Node)) setShowProductDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (dates.start && dates.end) {
      const start = new Date(dates.start), end = new Date(dates.end);
      const diffDays = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const inventoryTotal = selectedItems.reduce((sum, item) => {
        const product = db.products.find(p => p.id === item.productId);
        return sum + (product ? product.pricePerDay * item.quantity * diffDays : 0);
      }, 0);
      const customTotal = customItems.reduce((sum, item) => sum + item.pricePerDay * item.quantity * diffDays, 0);
      setEstimatedTotal(inventoryTotal + customTotal);
    } else setEstimatedTotal(0);
  }, [dates, selectedItems, customItems]);

  useEffect(() => {
    const checkStock = async () => {
      if (tempProduct && dates.start && dates.end) {
        // First set to current physical stock as default
        setAvailableQty(tempProduct.currentPhysicalStock);

        // Then try to get availability based on date range
        try {
          const res = await db.checkAvailabilityAsync([{ productId: tempProduct.id, quantity: 1 }], dates.start, dates.end);
          if (res && res.length > 0 && res[0].available !== undefined) {
            setAvailableQty(res[0].available);
          }
        } catch (e) {
          // Keep using currentPhysicalStock if API fails
          console.log('Using current physical stock');
        }
      }
    };
    checkStock();
  }, [tempProduct, dates]);

  const handleAddCustomer = async () => {
    if (!newCustomer.name.trim()) return;
    const created = await db.addCustomer({ name: newCustomer.name, phone: newCustomer.phone });
    setCustomerId(created.id);
    setShowNewCustomer(false);
    setNewCustomer({ name: '', phone: '' });
    refreshApp();
  };

  const handleAddItem = () => {
    if (!tempProduct) return;
    const stock = availableQty || 0;
    if (subRentMode) {
      setSelectedItems([...selectedItems, { itemId: Math.random().toString(), productId: tempProduct.id, quantity: tempQty, isExternal: true, supplierId: subRentSupplier || undefined, returnedQuantity: 0, exportedQuantity: 0, note: tempNote || undefined }]);
    } else {
      if (tempQty > stock) { error(t('stock_remaining').replace('{0}', stock.toString())); return; }
      setSelectedItems([...selectedItems, { itemId: Math.random().toString(), productId: tempProduct.id, quantity: tempQty, isExternal: false, returnedQuantity: 0, exportedQuantity: 0, note: tempNote || undefined }]);
    }
    setTempProduct(null); setTempQty(1); setTempNote(''); setSubRentMode(false); setSubRentSupplier(null); setProductSearch('');
  };

  const handleAddCustomProduct = () => {
    if (!newProduct.name.trim() || newProduct.quantity < 1) return;
    setCustomItems([...customItems, { ...newProduct, supplierId: newProduct.supplierId || undefined, note: newProduct.note || undefined }]);
    setShowNewProduct(false);
    setNewProduct({ name: '', pricePerDay: 0, quantity: 1, supplierId: null, note: '' });
  };

  const handleSubmit = async () => {
    if (!customerId || !dates.start || !dates.end || (selectedItems.length === 0 && customItems.length === 0)) return;
    const allItems = [...selectedItems];
    customItems.forEach(ci => {
      const tempId = -Math.floor(Math.random() * 100000);
      db.products.push({ id: tempId, code: `CUSTOM-${Date.now()}`, name: ci.name, category: t('external_rent_category'), pricePerDay: ci.pricePerDay, totalOwned: 0, currentPhysicalStock: 0, imageUrl: 'https://via.placeholder.com/150?text=External', isSerialized: false });
      allItems.push({ itemId: Math.random().toString(), productId: tempId, quantity: ci.quantity, isExternal: true, supplierId: ci.supplierId, returnedQuantity: 0, exportedQuantity: 0, note: ci.note });
    });
    await db.createOrder({ id: 0, customerId, rentalStartDate: dates.start, expectedReturnDate: dates.end, status: OrderStatus.BOOKED, items: allItems, totalAmount: estimatedTotal, note: orderNote || undefined });
    refreshApp(); onClose();
  };

  const selectedCustomer = db.customers.find(c => c.id === customerId);
  const diffDays = dates.start && dates.end ? Math.ceil(Math.abs(new Date(dates.end).getTime() - new Date(dates.start).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50">
      <div className="bg-white w-full h-[95vh] md:h-auto md:max-h-[90vh] md:max-w-2xl md:mx-4 md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-5 py-4 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-lg font-bold">{t('create_order_title')}</h2>
            <p className="text-indigo-200 text-xs mt-0.5">{diffDays > 0 ? `${diffDays} ${t('days')}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Customer & Date Section */}
          <div className="p-4 bg-slate-50 border-b space-y-3">
            {/* Customer */}
            <div>
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1.5">
                <User className="w-3 h-3" /> {t('customer')}
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <select
                    className="w-full bg-white border-2 border-slate-200 p-3 pr-10 rounded-xl text-sm font-medium focus:border-indigo-500 focus:ring-0 outline-none appearance-none cursor-pointer"
                    value={customerId || ''}
                    onChange={(e) => setCustomerId(Number(e.target.value))}
                  >
                    <option value="">{t('select_customer')}</option>
                    {db.customers.map(c => <option key={c.id} value={c.id}>{c.name} {c.phone ? `- ${c.phone}` : ''}</option>)}
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <button onClick={() => setShowNewCustomer(true)} className="px-4 bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors">
                  <UserPlus className="w-5 h-5" />
                </button>
              </div>
              {selectedCustomer && (
                <div className="mt-2 px-3 py-2 bg-indigo-50 rounded-lg text-sm">
                  <span className="font-semibold text-indigo-700">{selectedCustomer.name}</span>
                  {selectedCustomer.phone && <span className="text-indigo-500 ml-2">{selectedCustomer.phone}</span>}
                </div>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1.5">
                  <Calendar className="w-3 h-3" /> {t('from_date')}
                </label>
                <input type="date" value={dates.start} onChange={e => setDates({ ...dates, start: e.target.value })}
                  className="w-full bg-white border-2 border-slate-200 p-3 rounded-xl text-sm font-medium focus:border-indigo-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1.5">
                  <Calendar className="w-3 h-3" /> {t('to_date')}
                </label>
                <input type="date" value={dates.end} onChange={e => setDates({ ...dates, end: e.target.value })}
                  className="w-full bg-white border-2 border-slate-200 p-3 rounded-xl text-sm font-medium focus:border-indigo-500 outline-none" />
              </div>
            </div>
          </div>

          {/* Add Equipment Section */}
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> {t('add_from_inventory')}
              </h3>
              <button onClick={() => setShowNewProduct(true)} className="text-xs px-3 py-1.5 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 flex items-center gap-1">
                <Package className="w-3 h-3" /> {t('add_external_product')}
              </button>
            </div>

            {/* Product Search */}
            <div ref={productSearchRef} className="relative mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  className="w-full bg-white border-2 border-slate-200 p-3 pl-10 pr-10 rounded-xl text-sm focus:border-indigo-500 outline-none"
                  placeholder={t('search_product_placeholder') || 'Tìm thiết bị...'}
                  value={tempProduct ? `${tempProduct.code} - ${tempProduct.name}` : productSearch}
                  onChange={(e) => { setProductSearch(e.target.value); setTempProduct(null); setShowProductDropdown(true); }}
                  onFocus={() => setShowProductDropdown(true)}
                />
                {tempProduct && (
                  <button onClick={() => { setTempProduct(null); setProductSearch(''); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded-full">
                    <X className="w-4 h-4 text-slate-400" />
                  </button>
                )}
              </div>

              {showProductDropdown && !tempProduct && (
                <div className="absolute z-50 w-full mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <div className="p-4 text-slate-400 text-center text-sm">{t('no_product_found')}</div>
                  ) : filteredProducts.slice(0, 8).map(p => (
                    <div key={p.id} onClick={() => { setTempProduct(p); setProductSearch(''); setShowProductDropdown(false); }}
                      className="p-3 hover:bg-indigo-50 cursor-pointer border-b last:border-b-0 flex items-center gap-3 transition-colors">
                      <img src={p.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover bg-slate-100" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-800 truncate">{p.name}</p>
                        <p className="text-xs text-slate-400 font-mono">{p.code}</p>
                      </div>
                      <div className="text-right">
                        <span className={`text-lg font-bold ${p.currentPhysicalStock < 3 ? 'text-red-500' : 'text-emerald-600'}`}>{p.currentPhysicalStock}</span>
                        <p className="text-[10px] text-slate-400 uppercase">{t('in_stock')}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected Product Form */}
            {tempProduct && (
              <div className="bg-indigo-50 rounded-xl p-4 mb-4 border-2 border-indigo-100">
                <div className="flex items-center gap-3 mb-3 pb-3 border-b border-indigo-200">
                  <img src={tempProduct.imageUrl} alt="" className="w-14 h-14 rounded-lg object-cover" />
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{tempProduct.name}</p>
                    <p className="text-xs text-slate-500 font-mono">{tempProduct.code}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">{t('quantity_needed')}</label>
                    <input type="number" value={tempQty} onChange={(e) => setTempQty(Number(e.target.value))} min={1}
                      className="w-full border-2 border-indigo-200 p-2.5 rounded-lg font-bold text-center text-lg bg-white focus:border-indigo-500 outline-none" />
                  </div>
                  <div className="flex flex-col justify-center">
                    <p className="text-xs text-slate-500">{t('available_stock')}</p>
                    <p className={`text-2xl font-bold ${availableQty! < tempQty ? 'text-red-500' : 'text-emerald-600'}`}>{availableQty}</p>
                  </div>
                </div>

                {availableQty! < tempQty && (
                  <div className="mb-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700 flex items-center gap-1 mb-2">
                      <AlertCircle className="w-3 h-3" /> {t('missing_items')} {tempQty - availableQty!}
                    </p>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={subRentMode} onChange={(e) => setSubRentMode(e.target.checked)} className="w-4 h-4 rounded text-indigo-600" />
                      <span className="text-sm font-medium text-slate-700">{t('sub_rent_mode')}</span>
                    </label>
                    {subRentMode && (
                      <select onChange={(e) => setSubRentSupplier(Number(e.target.value))} className="w-full mt-2 border p-2 rounded-lg text-sm bg-white">
                        <option value="">{t('select_supplier_placeholder')}</option>
                        {db.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    )}
                  </div>
                )}

                <input type="text" value={tempNote} onChange={e => setTempNote(e.target.value)} placeholder={t('placeholder_color_size')}
                  className="w-full border-2 border-indigo-200 p-2.5 rounded-lg text-sm mb-3 bg-white focus:border-indigo-500 outline-none" />

                <button onClick={handleAddItem} className="w-full bg-indigo-600 text-white py-3 rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 transition-colors">
                  <Plus className="w-5 h-5" /> {t('add_to_order')}
                </button>
              </div>
            )}

            {/* Selected Items List */}
            {(selectedItems.length > 0 || customItems.length > 0) && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-500 uppercase">{t('items')} ({selectedItems.length + customItems.length})</h4>

                {selectedItems.map((item, idx) => {
                  const p = db.products.find(x => x.id === item.productId);
                  return (
                    <div key={idx} className="bg-white border-2 border-slate-100 rounded-xl p-3 flex items-center gap-3">
                      <img src={p?.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover bg-slate-100" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{p?.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs bg-slate-100 px-2 py-0.5 rounded font-medium">x{item.quantity}</span>
                          {item.isExternal && <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-medium">{t('external_rent')}</span>}
                        </div>
                        {item.note && <p className="text-xs text-indigo-500 mt-1 truncate">📝 {item.note}</p>}
                      </div>
                      <button onClick={() => setSelectedItems(prev => prev.filter((_, i) => i !== idx))} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}

                {customItems.map((item, idx) => (
                  <div key={`custom-${idx}`} className="bg-purple-50 border-2 border-purple-100 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-purple-200 flex items-center justify-center">
                      <Package className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 truncate">{item.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs bg-purple-100 px-2 py-0.5 rounded font-medium">x{item.quantity}</span>
                        <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded font-medium">{t('external_product')}</span>
                      </div>
                    </div>
                    <button onClick={() => setCustomItems(prev => prev.filter((_, i) => i !== idx))} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Order Note */}
            <div className="mt-4">
              <label className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1 mb-1.5">
                <FileText className="w-3 h-3" /> {t('order_general_note')}
              </label>
              <textarea value={orderNote} onChange={e => setOrderNote(e.target.value)} placeholder={t('placeholder_delivery')} rows={2}
                className="w-full border-2 border-slate-200 p-3 rounded-xl text-sm focus:border-indigo-500 outline-none resize-none" />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t bg-slate-50 shrink-0 safe-area-bottom">
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-3 border-2 border-slate-200 rounded-xl font-medium text-slate-600 hover:bg-slate-100 transition-colors">
              {t('cancel')}
            </button>
            <button onClick={handleSubmit} disabled={selectedItems.length === 0 && customItems.length === 0}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {t('save_order')}
            </button>
          </div>
        </div>
      </div>

      {/* New Customer Modal */}
      {showNewCustomer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-emerald-500 text-white px-5 py-4 flex justify-between items-center">
              <h3 className="font-bold">{t('add_new_customer')}</h3>
              <button onClick={() => setShowNewCustomer(false)} className="p-1 hover:bg-white/20 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">{t('customer_name')} *</label>
                <input type="text" value={newCustomer.name} onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })} placeholder={t('placeholder_name')}
                  className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-emerald-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">{t('customer_phone')}</label>
                <input type="text" value={newCustomer.phone} onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })} placeholder={t('placeholder_phone')}
                  className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-emerald-500 outline-none" />
              </div>
              <button onClick={handleAddCustomer} className="w-full bg-emerald-500 text-white py-3 rounded-xl font-bold hover:bg-emerald-600 transition-colors">
                {t('add')} {t('customer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New External Product Modal */}
      {showNewProduct && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-purple-500 text-white px-5 py-4 flex justify-between items-center">
              <h3 className="font-bold">{t('add_external_product_title')}</h3>
              <button onClick={() => setShowNewProduct(false)} className="p-1 hover:bg-white/20 rounded-full"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-500 -mt-2">{t('external_product_desc')}</p>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">{t('product_name')} *</label>
                <input type="text" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} placeholder={t('placeholder_product_name')}
                  className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-purple-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">{t('quantity')}</label>
                <input type="number" value={newProduct.quantity} onChange={e => setNewProduct({ ...newProduct, quantity: Number(e.target.value) })} min={1}
                  className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-purple-500 outline-none" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">{t('supplier_optional')}</label>
                <select value={newProduct.supplierId || ''} onChange={e => setNewProduct({ ...newProduct, supplierId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-purple-500 outline-none">
                  <option value="">{t('no_select')}</option>
                  {db.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 uppercase mb-1.5 block">{t('note')}</label>
                <input type="text" value={newProduct.note} onChange={e => setNewProduct({ ...newProduct, note: e.target.value })} placeholder={t('placeholder_product_note')}
                  className="w-full border-2 border-slate-200 p-3 rounded-xl focus:border-purple-500 outline-none" />
              </div>
              <button onClick={handleAddCustomProduct} className="w-full bg-purple-500 text-white py-3 rounded-xl font-bold hover:bg-purple-600 transition-colors">
                {t('add_to_order')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
