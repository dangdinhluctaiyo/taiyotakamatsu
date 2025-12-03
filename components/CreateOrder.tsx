import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { Customer, Product, OrderItem, OrderStatus } from '../types';
import { Plus, Trash2, AlertCircle, UserPlus, Package, X } from 'lucide-react';
import { useToast } from './Toast';

export const CreateOrder: React.FC<{ onClose: () => void; refreshApp: () => void }> = ({ onClose, refreshApp }) => {
  const { error } = useToast();
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [dates, setDates] = useState({ start: '', end: '' });
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [estimatedTotal, setEstimatedTotal] = useState(0);

  // Temp state for adding item
  const [tempProduct, setTempProduct] = useState<Product | null>(null);
  const [tempQty, setTempQty] = useState(1);
  const [tempNote, setTempNote] = useState('');
  const [availableQty, setAvailableQty] = useState<number | null>(null);
  const [subRentMode, setSubRentMode] = useState(false);
  const [subRentSupplier, setSubRentSupplier] = useState<number | null>(null);

  // Order note
  const [orderNote, setOrderNote] = useState('');

  // New customer modal
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '' });

  // New product (external/custom) modal
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', pricePerDay: 0, quantity: 1, supplierId: null as number | null, note: '' });

  // Custom items (not in inventory)
  const [customItems, setCustomItems] = useState<{ name: string; pricePerDay: number; quantity: number; supplierId?: number; note?: string }[]>([]);

  // Calculate Duration and Total Amount
  useEffect(() => {
    if (dates.start && dates.end) {
      const start = new Date(dates.start);
      const end = new Date(dates.end);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      const inventoryTotal = selectedItems.reduce((sum, item) => {
        const product = db.products.find(p => p.id === item.productId);
        if (!product) return sum;
        return sum + (product.pricePerDay * item.quantity * diffDays);
      }, 0);

      const customTotal = customItems.reduce((sum, item) => {
        return sum + (item.pricePerDay * item.quantity * diffDays);
      }, 0);

      setEstimatedTotal(inventoryTotal + customTotal);
    } else {
      setEstimatedTotal(0);
    }
  }, [dates, selectedItems, customItems]);

  useEffect(() => {
    if (tempProduct && dates.start && dates.end) {
      const avail = db.checkAvailability(tempProduct.id, dates.start, dates.end);
      setAvailableQty(avail);
    }
  }, [tempProduct, dates, tempQty]);

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
    const needed = tempQty;
    const stock = availableQty || 0;

    if (subRentMode) {
      setSelectedItems([
        ...selectedItems,
        {
          itemId: Math.random().toString(),
          productId: tempProduct.id,
          quantity: tempQty,
          isExternal: true,
          supplierId: subRentSupplier || undefined,
          returnedQuantity: 0,
          exportedQuantity: 0,
          note: tempNote || undefined
        }
      ]);
    } else {
      if (needed > stock) {
        if (needed > stock) {
          error(t('stock_remaining').replace('{0}', stock.toString()));
          return;
        }
      }
      setSelectedItems([
        ...selectedItems,
        {
          itemId: Math.random().toString(),
          productId: tempProduct.id,
          quantity: tempQty,
          isExternal: false,
          returnedQuantity: 0,
          exportedQuantity: 0,
          note: tempNote || undefined
        }
      ]);
    }

    setTempProduct(null);
    setTempQty(1);
    setTempNote('');
    setSubRentMode(false);
    setSubRentSupplier(null);
  };

  const handleAddCustomProduct = () => {
    if (!newProduct.name.trim() || newProduct.quantity < 1) return;
    setCustomItems([...customItems, { ...newProduct, supplierId: newProduct.supplierId || undefined, note: newProduct.note || undefined }]);
    setShowNewProduct(false);
    setNewProduct({ name: '', pricePerDay: 0, quantity: 1, supplierId: null, note: '' });
  };

  const handleSubmit = () => {
    if (!customerId || !dates.start || !dates.end || (selectedItems.length === 0 && customItems.length === 0)) return;

    // Create temporary products for custom items and add to order
    const allItems = [...selectedItems];

    customItems.forEach(ci => {
      // Create a temporary product entry
      const tempId = -Math.floor(Math.random() * 100000); // Negative ID for custom
      db.products.push({
        id: tempId,
        code: `CUSTOM-${Date.now()}`,
        name: ci.name,
        category: t('external_rent_category'),
        pricePerDay: ci.pricePerDay,
        totalOwned: 0,
        currentPhysicalStock: 0,
        imageUrl: 'https://via.placeholder.com/150?text=External'
      });

      allItems.push({
        itemId: Math.random().toString(),
        productId: tempId,
        quantity: ci.quantity,
        isExternal: true,
        supplierId: ci.supplierId,
        returnedQuantity: 0,
        exportedQuantity: 0,
        note: ci.note
      });
    });

    db.createOrder({
      id: 0,
      customerId,
      rentalStartDate: dates.start,
      expectedReturnDate: dates.end,
      status: OrderStatus.BOOKED,
      items: allItems,
      totalAmount: estimatedTotal,
      note: orderNote || undefined
    });

    refreshApp();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
          <h2 className="text-xl font-bold text-gray-800">{t('create_order_title')}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Customer Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium mb-1">{t('customer')}</label>
              <div className="flex gap-2">
                <select
                  className="flex-1 border p-2 rounded focus:ring-2 focus:ring-primary"
                  value={customerId || ''}
                  onChange={(e) => setCustomerId(Number(e.target.value))}
                >
                  <option value="">{t('select_customer')}</option>
                  {db.customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button
                  onClick={() => setShowNewCustomer(true)}
                  className="px-3 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  title={t('add_new_customer')}
                >
                  <UserPlus className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm font-medium mb-1">{t('from_date')}</label>
                <input type="date" className="w-full border p-2 rounded" onChange={e => setDates({ ...dates, start: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('to_date')}</label>
                <input type="date" className="w-full border p-2 rounded" onChange={e => setDates({ ...dates, end: e.target.value })} />
              </div>
            </div>
          </div>

          <hr className="my-4 border-gray-200" />

          {/* Add Items from Inventory */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">{t('add_from_inventory')}</h3>
              <button
                onClick={() => setShowNewProduct(true)}
                className="text-sm px-3 py-1.5 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center gap-1"
              >
                <Package className="w-3 h-3" /> {t('add_external_product')}
              </button>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <div className="flex flex-col gap-3">
                <select
                  className="w-full border p-2 rounded"
                  onChange={(e) => {
                    const p = db.products.find(x => x.id === Number(e.target.value));
                    setTempProduct(p || null);
                  }}
                  value={tempProduct?.id || ''}
                >
                  <option value="">{t('select_product_placeholder')}</option>
                  {db.products.filter(p => p.id > 0).map(p => <option key={p.id} value={p.id}>{p.code} - {p.name} ({p.pricePerDay.toLocaleString()}{t('vnd')}{t('per_day')})</option>)}
                </select>

                {tempProduct && dates.start && dates.end && (
                  <div className="animate-fade-in">
                    <div className="flex items-center gap-4 mb-2">
                      <div className="w-1/3">
                        <label className="block text-xs text-gray-500">{t('quantity_needed')}</label>
                        <input
                          type="number"
                          className="w-full border p-2 rounded font-bold"
                          value={tempQty}
                          onChange={(e) => setTempQty(Number(e.target.value))}
                          min={1}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm">
                          {t('available_stock')}: <span className={`font-bold ${availableQty! < tempQty ? 'text-red-600' : 'text-green-600'}`}>{availableQty}</span>
                        </p>
                        {availableQty! < tempQty && (
                          <p className="text-xs text-red-500 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {t('missing_items')} {tempQty - availableQty!}!
                          </p>
                        )}
                      </div>
                    </div>

                    {availableQty! < tempQty && (
                      <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={subRentMode}
                            onChange={(e) => setSubRentMode(e.target.checked)}
                            className="w-4 h-4 text-primary"
                          />
                          <span className="font-bold text-gray-800">{t('sub_rent_mode')}</span>
                        </label>

                        {subRentMode && (
                          <div className="mt-2 pl-6 animate-fade-in">
                            <label className="block text-xs font-medium mb-1">{t('select_supplier')}</label>
                            <select
                              className="w-full border p-2 rounded text-sm bg-white"
                              onChange={(e) => setSubRentSupplier(Number(e.target.value))}
                            >
                              <option value="">{t('select_supplier_placeholder')}</option>
                              {db.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="mb-3">
                      <label className="block text-xs text-gray-500 mb-1">{t('product_note')}</label>
                      <input type="text" className="w-full border p-2 rounded text-sm" value={tempNote} onChange={e => setTempNote(e.target.value)} placeholder={t('placeholder_color_size')} />
                    </div>

                    <button
                      onClick={handleAddItem}
                      className="w-full bg-secondary text-white py-2 rounded hover:bg-gray-700 flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" /> {t('add_to_order')}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* List Selected Items */}
          <div className="space-y-2">
            {selectedItems.map((item, idx) => {
              const p = db.products.find(x => x.id === item.productId);
              return (
                <div key={idx} className="p-3 bg-white border rounded shadow-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-bold text-gray-800">{p?.name}</div>
                      <div className="text-sm text-gray-500">
                        {t('qty')}: {item.quantity}
                        {item.isExternal && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                            {t('external_rent')}: {db.suppliers.find(s => s.id === item.supplierId)?.name || 'N/A'}
                          </span>
                        )}
                      </div>
                      {item.note && <div className="text-xs text-blue-600 mt-1 italic">📝 {item.note}</div>}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-gray-600">
                        {((p?.pricePerDay || 0) * item.quantity).toLocaleString()}{t('vnd')}{t('per_day')}
                      </span>
                      <button onClick={() => setSelectedItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 p-2">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Custom Items (not in inventory) */}
            {customItems.map((item, idx) => (
              <div key={`custom-${idx}`} className="p-3 bg-purple-50 border border-purple-200 rounded shadow-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-gray-800">{item.name}</div>
                    <div className="text-sm text-gray-500">
                      {t('qty')}: {item.quantity}
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        {t('external_product')} {item.supplierId ? `- ${db.suppliers.find(s => s.id === item.supplierId)?.name}` : ''}
                      </span>
                    </div>
                    {item.note && <div className="text-xs text-purple-600 mt-1 italic">📝 {item.note}</div>}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium text-gray-600">
                      {(item.pricePerDay * item.quantity).toLocaleString()}{t('vnd')}{t('per_day')}
                    </span>
                    <button onClick={() => setCustomItems(prev => prev.filter((_, i) => i !== idx))} className="text-red-500 p-2">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Note */}
          <div className="mt-4">
            <label className="block text-sm font-medium mb-1">{t('order_general_note')}</label>
            <textarea className="w-full border p-2 rounded text-sm" rows={2} value={orderNote} onChange={e => setOrderNote(e.target.value)} placeholder={t('placeholder_delivery')} />
          </div>
        </div>

        {/* Footer with Total */}
        <div className="p-6 border-t bg-gray-50 rounded-b-xl flex justify-between items-center">
          <div className="text-lg">
            {t('estimated_total')}: <span className="font-bold text-primary text-xl">{estimatedTotal.toLocaleString()} {t('vnd')}</span>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 text-gray-600 font-medium">{t('cancel')}</button>
            <button
              onClick={handleSubmit}
              disabled={selectedItems.length === 0 && customItems.length === 0}
              className="px-6 py-2 bg-primary text-white rounded font-bold shadow hover:bg-blue-700 disabled:opacity-50"
            >
              {t('save_order')}
            </button>
          </div>
        </div>
      </div>

      {/* New Customer Modal */}
      {showNewCustomer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">{t('add_new_customer')}</h3>
              <button onClick={() => setShowNewCustomer(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('customer_name')} *</label>
                <input
                  type="text"
                  className="w-full border p-2 rounded"
                  value={newCustomer.name}
                  onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                  placeholder={t('placeholder_name')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('customer_phone')}</label>
                <input
                  type="text"
                  className="w-full border p-2 rounded"
                  value={newCustomer.phone}
                  onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                  placeholder={t('placeholder_phone')}
                />
              </div>
              <button
                onClick={handleAddCustomer}
                className="w-full bg-green-500 text-white py-2 rounded font-bold hover:bg-green-600"
              >
                {t('add')} {t('customer')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Product (External) Modal */}
      {showNewProduct && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">{t('add_external_product_title')}</h3>
              <button onClick={() => setShowNewProduct(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">{t('external_product_desc')}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('product_name')} *</label>
                <input
                  type="text"
                  className="w-full border p-2 rounded"
                  value={newProduct.name}
                  onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                  placeholder={t('placeholder_product_name')}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t('price_per_day')}</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={newProduct.pricePerDay}
                    onChange={e => setNewProduct({ ...newProduct, pricePerDay: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t('quantity')}</label>
                  <input
                    type="number"
                    className="w-full border p-2 rounded"
                    value={newProduct.quantity}
                    onChange={e => setNewProduct({ ...newProduct, quantity: Number(e.target.value) })}
                    min={1}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('supplier_optional')}</label>
                <select
                  className="w-full border p-2 rounded"
                  value={newProduct.supplierId || ''}
                  onChange={e => setNewProduct({ ...newProduct, supplierId: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">{t('no_select')}</option>
                  {db.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('note')}</label>
                <input type="text" className="w-full border p-2 rounded" value={newProduct.note} onChange={e => setNewProduct({ ...newProduct, note: e.target.value })} placeholder={t('placeholder_product_note')} />
              </div>
              <button
                onClick={handleAddCustomProduct}
                className="w-full bg-purple-500 text-white py-2 rounded font-bold hover:bg-purple-600"
              >
                {t('add_to_order')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
