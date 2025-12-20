import React, { useState } from 'react';
import { db } from '../services/db';
import { t, i18n } from '../services/i18n';
import { Order, OrderStatus, OrderItem } from '../types';
import { X, CheckCircle2, Plus, Calendar, ArrowDownCircle, ArrowUpCircle, Trash2, Clock, AlertCircle, AlertTriangle, User } from 'lucide-react';
import { useToast } from './Toast';

interface Props {
  order: Order;
  onClose: () => void;
  refreshApp: () => void;
}

export const OrderDetail: React.FC<Props> = ({ order, onClose, refreshApp }) => {
  const { success, error } = useToast();
  const [showAddItem, setShowAddItem] = useState(false);
  const [showExtendDate, setShowExtendDate] = useState(false);
  const [showPartialReturn, setShowPartialReturn] = useState<OrderItem | null>(null);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [showReturnAll, setShowReturnAll] = useState(false);
  const [showExportItem, setShowExportItem] = useState<OrderItem | null>(null);
  const [exportQty, setExportQty] = useState(1);
  const [exportStaffName, setExportStaffName] = useState('');

  const [newProductId, setNewProductId] = useState<number | null>(null);
  const [newQty, setNewQty] = useState(1);
  const [newItemNote, setNewItemNote] = useState('');
  const [isExternal, setIsExternal] = useState(false);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [newEndDate, setNewEndDate] = useState(order.expectedReturnDate.split('T')[0]);
  const [returnQty, setReturnQty] = useState(1);
  const [staffName, setStaffName] = useState('');
  const [returnStaffName, setReturnStaffName] = useState('');

  const customer = db.customers.find(c => c.id === order.customerId);
  const isEditable = order.status !== OrderStatus.COMPLETED && order.status !== OrderStatus.CANCELLED;

  // Check dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expectedDate = new Date(order.expectedReturnDate);
  expectedDate.setHours(0, 0, 0, 0);
  const daysUntilDue = Math.ceil((expectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const isOverdue = daysUntilDue < 0 && order.status === OrderStatus.ACTIVE;

  const calcDays = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  };

  const expectedDays = calcDays(order.rentalStartDate, order.expectedReturnDate);
  const actualDays = order.status === OrderStatus.COMPLETED
    ? calcDays(order.rentalStartDate, order.actualReturnDate!)
    : calcDays(order.rentalStartDate, new Date().toISOString());

  const calcAmount = (days: number) => order.items.reduce((sum, item) => {
    const product = db.products.find(p => p.id === item.productId);
    return sum + ((product?.pricePerDay || 0) * item.quantity * days);
  }, 0);

  const expectedAmount = calcAmount(expectedDays);
  const currentActualAmount = calcAmount(actualDays);

  const recalculateTotal = () => { order.totalAmount = expectedAmount; };

  const handleAddItem = () => {
    if (!newProductId || newQty < 1) return;
    const product = db.products.find(p => p.id === newProductId);
    if (!product) return;

    if (!isExternal) {
      const avail = db.checkAvailability(newProductId, order.rentalStartDate, order.expectedReturnDate);
      if (avail < newQty) {
        error(`${t('available_stock')}: ${avail}`);
        return;
      }
    }

    order.items.push({
      itemId: Math.random().toString(),
      productId: newProductId,
      quantity: newQty,
      isExternal,
      supplierId: isExternal ? supplierId || undefined : undefined,
      exportedQuantity: 0,
      returnedQuantity: 0,
      note: newItemNote || undefined
    });
    recalculateTotal();
    setShowAddItem(false);
    setNewProductId(null);
    setNewQty(1);
    setNewItemNote('');
    setIsExternal(false);
    refreshApp();
  };

  const handleReturnAll = async () => {
    if (!returnStaffName.trim()) { error(t('please_enter_info')); return; }
    for (const item of order.items) {
      const remaining = (item.exportedQuantity || item.quantity) - item.returnedQuantity;
      if (remaining > 0) {
        item.returnedAt = new Date().toISOString();
        item.returnedBy = returnStaffName;
        await db.importStock(order.id, item.productId, remaining, `${t('return_all_btn')} - ${t('staff_label')}: ${returnStaffName}`);
      }
    }
    setShowReturnAll(false);
    setReturnStaffName('');
    refreshApp();
  };

  const handleExtendDate = () => {
    if (!newEndDate) return;
    order.expectedReturnDate = newEndDate;
    recalculateTotal();
    setShowExtendDate(false);
    refreshApp();
  };

  const handlePartialReturn = async () => {
    if (!showPartialReturn || returnQty < 1 || !returnStaffName.trim()) {
      if (!returnStaffName.trim()) error(t('please_enter_info'));
      return;
    }
    const item = order.items.find(i => i.itemId === showPartialReturn.itemId);
    if (!item) return;
    const maxReturn = (item.exportedQuantity || item.quantity) - item.returnedQuantity;
    if (returnQty > maxReturn) { error(`${t('remaining_qty')}: ${maxReturn}`); return; }
    item.returnedAt = new Date().toISOString();
    item.returnedBy = returnStaffName;
    await db.importStock(order.id, item.productId, returnQty, `${t('return_partial')} - ${t('staff_label')}: ${returnStaffName}`);
    setShowPartialReturn(null);
    setReturnQty(1);
    setReturnStaffName('');
    refreshApp();
  };

  const handleExportItem = async () => {
    if (!showExportItem || exportQty < 1 || !exportStaffName.trim()) {
      if (!exportStaffName.trim()) error(t('please_enter_info'));
      return;
    }
    const item = order.items.find(i => i.itemId === showExportItem.itemId);
    if (!item) return;
    const maxExport = item.quantity - (item.exportedQuantity || 0);
    if (exportQty > maxExport) { error(`Tối đa: ${maxExport}`); return; }

    try {
      await db.exportStock(order.id, item.productId, exportQty, `${t('export_stock')} - ${t('staff_label')}: ${exportStaffName}`);
      setShowExportItem(null);
      setExportQty(1);
      setExportStaffName('');
      success(t('export_success') || 'Xuất kho thành công');
      refreshApp();
    } catch (err: any) {
      console.error('Export error:', err);
      error(err.message || 'Lỗi xuất kho. Vui lòng thử lại.');
    }
  };

  const handleRemoveItem = (itemId: string) => {
    const item = order.items.find(i => i.itemId === itemId);
    if (item?.exportedQuantity && item.exportedQuantity > 0) { error(t('cannot_delete_exported')); return; }
    if (confirm(t('delete_equipment_confirm'))) {
      order.items = order.items.filter(i => i.itemId !== itemId);
      recalculateTotal();
      refreshApp();
    }
  };

  const handleForceComplete = async () => {
    if (!staffName.trim()) { error(t('please_enter_info')); return; }
    await db.forceCompleteOrder(order.id, staffName);
    refreshApp();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className={`p-4 border-b flex justify-between items-center ${isOverdue ? 'bg-red-50' : 'bg-slate-50'}`}>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="font-bold text-xl">{t('order_number')} #{order.id}</h3>
              <span className={`px-2 py-1 rounded text-xs font-bold ${order.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                order.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' :
                  'bg-orange-100 text-orange-700'
                }`}>{order.status === 'ACTIVE' ? t('order_status_active') : order.status === 'COMPLETED' ? t('order_status_completed') : t('order_status_booked')}</span>
              {isOverdue && <span className="px-2 py-1 rounded text-xs font-bold bg-red-500 text-white animate-pulse">{t('overdue')}</span>}
            </div>
            <p className="text-slate-600 mt-1">{customer?.name} • {customer?.phone}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {/* Info Grid */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-slate-500 text-xs">{t('start_date')}</p>
              <p className="font-bold">{new Date(order.rentalStartDate).toLocaleDateString(i18n.getLanguage() === 'vi' ? 'vi-VN' : 'ja-JP')}</p>
            </div>
            <div className={`p-3 rounded-lg ${isOverdue ? 'bg-red-50' : 'bg-slate-50'}`}>
              <p className="text-slate-500 text-xs">{t('end_date')}</p>
              <p className={`font-bold ${isOverdue ? 'text-red-600' : ''}`}>{new Date(order.expectedReturnDate).toLocaleDateString(i18n.getLanguage() === 'vi' ? 'vi-VN' : 'ja-JP')}</p>
            </div>
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="text-slate-500 text-xs">{t('num_days')}</p>
              <p className="font-bold">{expectedDays} {t('days')}</p>
            </div>
          </div>

          {order.note && (
            <div className="bg-yellow-50 p-3 rounded-lg text-sm">
              <span className="font-medium">📝 {t('note')}:</span> {order.note}
            </div>
          )}

          {/* Action Buttons */}
          {isEditable && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setShowAddItem(true)} className="px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 flex items-center gap-1">
                <Plus className="w-4 h-4" /> {t('add_equipment')}
              </button>
              <button onClick={() => setShowExtendDate(true)} className="px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 flex items-center gap-1">
                <Calendar className="w-4 h-4" /> {t('extend')}
              </button>
              {order.items.some(i => ((i.exportedQuantity || i.quantity) - i.returnedQuantity) > 0) && (
                <button onClick={() => setShowReturnAll(true)} className="px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 flex items-center gap-1">
                  <ArrowDownCircle className="w-4 h-4" /> {t('return_all_btn')}
                </button>
              )}
            </div>
          )}

          {/* Items Table */}
          <div className="border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="text-left p-3 font-medium">{t('items')}</th>
                  <th className="text-center p-3 font-medium w-20">{t('qty')}</th>
                  <th className="text-center p-3 font-medium w-20">{t('exported_qty')}</th>
                  <th className="text-center p-3 font-medium w-20">{t('returned_qty')}</th>
                  <th className="text-center p-3 font-medium w-24">{t('status_label')}</th>
                  {isEditable && <th className="text-center p-3 font-medium w-24">{t('action_label')}</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {order.items.map((item) => {
                  const p = db.products.find(x => x.id === item.productId);
                  const exported = item.exportedQuantity || 0;
                  const remaining = exported - item.returnedQuantity;
                  const isFullyReturned = item.returnedQuantity >= item.quantity;

                  // Calculate Prepared (Reserved)
                  // We don't have direct access to reservedQty for this specific item in the order object
                  // But we can infer it if we assume reservedQty in stock corresponds to this order?
                  // No, reservedQty is global.
                  // Ideally, we should track 'preparedQuantity' in order_items.
                  // But for now, let's just show "Waiting" or "Exported".
                  // Actually, we can check if the item is serialized and has serials assigned?
                  // Or we can just rely on the fact that if it's not exported, it's "Booked" or "Prepared".
                  // Let's just show "Booked" if 0 exported.

                  return (
                    <tr key={item.itemId} className={isFullyReturned ? 'bg-green-50' : ''}>
                      <td className="p-3">
                        <div className="font-medium">{p?.name}</div>
                        <div className="text-xs text-slate-500">{p?.code}</div>
                        {item.isExternal && <span className="text-xs text-purple-600 bg-purple-50 px-1 rounded">{t('external_rent')}</span>}
                        {item.note && <div className="text-xs text-blue-500 mt-1">📝 {item.note}</div>}
                      </td>
                      <td className="p-3 text-center font-bold">{item.quantity}</td>
                      <td className="p-3 text-center">{exported}</td>
                      <td className="p-3 text-center font-bold text-green-600">{item.returnedQuantity}</td>
                      <td className="p-3 text-center">
                        {isFullyReturned ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-100 px-2 py-1 rounded-full">
                            <CheckCircle2 className="w-3 h-3" /> {t('full')}
                          </span>
                        ) : remaining > 0 ? (
                          <span className="text-xs text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                            {t('renting')} {remaining}
                          </span>
                        ) : exported === 0 ? (
                          <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-full">{t('booked')}</span>
                        ) : (
                          <span className="text-xs text-slate-400">{t('waiting')}</span>
                        )}
                      </td>
                      {isEditable && (
                        <td className="p-3 text-center">
                          <div className="flex gap-1 justify-center">
                            {/* Export button - show if not fully exported */}
                            {exported < item.quantity && (
                              <button
                                onClick={() => { setShowExportItem(item); setExportQty(item.quantity - exported); }}
                                className="p-1.5 text-orange-600 hover:bg-orange-50 rounded"
                                title={t('export_stock') || 'Xuất kho'}
                              >
                                <ArrowUpCircle className="w-4 h-4" />
                              </button>
                            )}
                            {/* Return button - show if has exported items */}
                            {remaining > 0 && (
                              <button
                                onClick={() => { setShowPartialReturn(item); setReturnQty(1); }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                title={t('return_partial')}
                              >
                                <ArrowDownCircle className="w-4 h-4" />
                              </button>
                            )}
                            {/* Delete button - only if not exported */}
                            {exported === 0 && (
                              <button
                                onClick={() => handleRemoveItem(item.itemId)}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                title={t('delete')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Completed info */}
          {order.status === OrderStatus.COMPLETED && order.completedBy && (
            <div className="bg-green-50 p-3 rounded-lg">
              <p className="text-sm text-green-600">{t('confirmed_by')}: {order.completedBy}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {isEditable && (
          <div className="p-4 border-t bg-slate-50">
            <button onClick={() => setShowCompleteConfirm(true)} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 flex items-center justify-center gap-2">
              <CheckCircle2 className="w-5 h-5" /> {t('complete_order')}
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showCompleteConfirm && (
        <Modal title={t('complete_order_title')} onClose={() => setShowCompleteConfirm(false)}>
          <div className="bg-blue-50 p-3 rounded-lg mb-4">
            <div className="flex justify-between text-sm"><span>{t('num_days')}:</span><span className="font-bold">{actualDays}</span></div>
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{t('staff_confirm')} *</label>
            <input type="text" className="w-full border p-2 rounded-lg" value={staffName} onChange={e => setStaffName(e.target.value)} placeholder={t('staff_name_placeholder')} />
          </div>
          <button onClick={handleForceComplete} disabled={!staffName.trim()} className="w-full bg-green-500 text-white py-2.5 rounded-lg font-bold disabled:opacity-50">
            {t('confirm')}
          </button>
        </Modal>
      )}

      {showReturnAll && (
        <Modal title={t('return_all_title')} onClose={() => setShowReturnAll(false)}>
          <div className="bg-slate-50 p-3 rounded-lg mb-4 text-sm">
            {order.items.map(item => {
              const p = db.products.find(x => x.id === item.productId);
              const remaining = (item.exportedQuantity || item.quantity) - item.returnedQuantity;
              if (remaining <= 0) return null;
              return <div key={item.itemId} className="flex justify-between py-1"><span>{p?.name}</span><span className="font-bold">x{remaining}</span></div>;
            })}
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{t('staff_confirm')} *</label>
            <input type="text" className="w-full border p-2 rounded-lg" value={returnStaffName} onChange={e => setReturnStaffName(e.target.value)} placeholder={t('staff_name_placeholder')} />
          </div>
          <button onClick={handleReturnAll} disabled={!returnStaffName.trim()} className="w-full bg-blue-500 text-white py-2.5 rounded-lg font-bold disabled:opacity-50">
            {t('confirm_return')}
          </button>
        </Modal>
      )}

      {showAddItem && (
        <Modal title={t('add_equipment_title')} onClose={() => setShowAddItem(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t('product')}</label>
              <select className="w-full border p-2 rounded-lg" value={newProductId || ''} onChange={e => setNewProductId(Number(e.target.value))}>
                <option value="">{t('select')}</option>
                {db.products.filter(p => p.id > 0).map(p => <option key={p.id} value={p.id}>{p.code} - {p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('quantity')}</label>
              <input type="number" inputMode="numeric" pattern="[0-9]*" className="w-full border p-2 rounded-lg" value={newQty} onChange={e => setNewQty(Number(e.target.value))} min={1} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={isExternal} onChange={e => setIsExternal(e.target.checked)} /> {t('external_rent')}
            </label>
            {isExternal && (
              <select className="w-full border p-2 rounded-lg" value={supplierId || ''} onChange={e => setSupplierId(Number(e.target.value))}>
                <option value="">{t('select_supplier_placeholder')}</option>
                {db.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">{t('note')}</label>
              <input type="text" className="w-full border p-2 rounded-lg" value={newItemNote} onChange={e => setNewItemNote(e.target.value)} placeholder="VD: Màu đỏ..." />
            </div>
            <button onClick={handleAddItem} className="w-full bg-green-500 text-white py-2.5 rounded-lg font-bold">{t('add')}</button>
          </div>
        </Modal>
      )}

      {showExtendDate && (
        <Modal title={t('extend_date')} onClose={() => setShowExtendDate(false)}>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">{t('current_return_date')}</label>
              <input type="date" className="w-full border p-2 rounded-lg bg-slate-50" value={order.expectedReturnDate.split('T')[0]} disabled />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('new_return_date')}</label>
              <input type="date" className="w-full border p-2 rounded-lg" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} />
            </div>
            <button onClick={handleExtendDate} className="w-full bg-orange-500 text-white py-2.5 rounded-lg font-bold">{t('confirm')}</button>
          </div>
        </Modal>
      )}

      {showPartialReturn && (
        <Modal title={t('partial_return_title')} onClose={() => setShowPartialReturn(null)}>
          <div className="bg-slate-50 p-3 rounded-lg mb-4">
            <p className="font-medium">{db.products.find(p => p.id === showPartialReturn.productId)?.name}</p>
            <p className="text-sm text-slate-500">{t('holding')}: {(showPartialReturn.exportedQuantity || showPartialReturn.quantity) - showPartialReturn.returnedQuantity}</p>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">{t('return_quantity')}</label>
            <input type="number" inputMode="numeric" pattern="[0-9]*" className="w-full border p-2 rounded-lg" value={returnQty} onChange={e => setReturnQty(Number(e.target.value))} min={1} />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{t('staff_info')} *</label>
            <input type="text" className="w-full border p-2 rounded-lg" value={returnStaffName} onChange={e => setReturnStaffName(e.target.value)} placeholder={t('staff_name_placeholder')} />
          </div>
          <button onClick={handlePartialReturn} disabled={!returnStaffName.trim()} className="w-full bg-blue-500 text-white py-2.5 rounded-lg font-bold disabled:opacity-50">{t('confirm')}</button>
        </Modal>
      )}

      {showExportItem && (
        <Modal title={t('export_stock') || 'Xuất kho'} onClose={() => setShowExportItem(null)}>
          <div className="bg-orange-50 p-3 rounded-lg mb-4">
            <p className="font-medium">{db.products.find(p => p.id === showExportItem.productId)?.name}</p>
            <p className="text-sm text-slate-500">Chờ xuất: {showExportItem.quantity - (showExportItem.exportedQuantity || 0)}</p>
          </div>
          <div className="mb-3">
            <label className="block text-sm font-medium mb-1">Số lượng xuất</label>
            <input type="number" inputMode="numeric" pattern="[0-9]*" className="w-full border p-2 rounded-lg" value={exportQty} onChange={e => setExportQty(Number(e.target.value))} min={1} max={showExportItem.quantity - (showExportItem.exportedQuantity || 0)} />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">{t('staff_info')} *</label>
            <input type="text" className="w-full border p-2 rounded-lg" value={exportStaffName} onChange={e => setExportStaffName(e.target.value)} placeholder={t('staff_name_placeholder')} />
          </div>
          <button onClick={handleExportItem} disabled={!exportStaffName.trim()} className="w-full bg-orange-500 text-white py-2.5 rounded-lg font-bold disabled:opacity-50">{t('confirm')}</button>
        </Modal>
      )}
    </div>
  );
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]">
    <div className="bg-white rounded-xl p-5 w-full max-w-sm shadow-2xl">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold text-lg">{title}</h3>
        <button onClick={onClose}><X className="w-5 h-5 text-slate-500" /></button>
      </div>
      {children}
    </div>
  </div>
);
