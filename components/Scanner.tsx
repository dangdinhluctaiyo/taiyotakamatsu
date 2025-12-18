import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { Product } from '../types';
import { Scan, ArrowUpCircle, ArrowDownCircle, CheckCircle, Search, Camera, X, Package, FileText, User } from 'lucide-react';

declare const Html5QrcodeScanner: any;

export const Scanner: React.FC<{ refreshApp: () => void }> = ({ refreshApp }) => {
  const [inputQuery, setInputQuery] = useState('');
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [note, setNote] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const scannerRef = useRef<any>(null);

  // Lấy thông tin nhân viên đang đăng nhập
  const currentStaff = db.currentUser;

  // Lấy danh sách đơn hàng đang hoạt động (BOOKED hoặc ACTIVE)
  const activeOrders = db.orders.filter(o => o.status === 'BOOKED' || o.status === 'ACTIVE');

  // Khi chọn đơn hàng, tự động điền ghi chú
  useEffect(() => {
    if (selectedOrderId) {
      const order = db.orders.find(o => o.id === selectedOrderId);
      if (order) {
        const customer = db.customers.find(c => c.id === order.customerId);
        setNote(`#${order.id} - ${customer?.name || t('customer')}`);
      }
    }
  }, [selectedOrderId]);

  useEffect(() => {
    if (showCamera) {
      setTimeout(() => {
        const scanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: 250 }, false);
        scanner.render(onScanSuccess, () => { });
        scannerRef.current = scanner;
      }, 100);
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(() => { });
        scannerRef.current = null;
      }
    }
    return () => {
      if (scannerRef.current) scannerRef.current.clear().catch(() => { });
    };
  }, [showCamera]);

  const onScanSuccess = (decodedText: string) => {
    setShowCamera(false);
    setInputQuery(decodedText);
    handleSearch(decodedText);
  };

  const selectProduct = (product: Product) => {
    setScannedProduct(product);
    setSearchResults([]);
    setInputQuery('');
    setFeedback(null);
    setQuantity(1);
    setNote('');
  };

  const handleSearch = (queryOverride?: string) => {
    const query = (queryOverride || inputQuery).toLowerCase().trim();
    if (!query) return;

    const exactMatch = db.products.find(p => p.code.toLowerCase() === query);
    if (exactMatch) { selectProduct(exactMatch); return; }

    const matches = db.products.filter(p =>
      p.code.toLowerCase().includes(query) || p.name.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      setFeedback({ type: 'error', msg: `${t('not_found')}: "${query}"` });
      setScannedProduct(null);
      setSearchResults([]);
    } else if (matches.length === 1) {
      selectProduct(matches[0]);
    } else {
      setSearchResults(matches);
      setScannedProduct(null);
    }
  };

  const handleExport = () => {
    if (!scannedProduct || quantity <= 0) return;
    if (quantity > scannedProduct.currentPhysicalStock) {
      setFeedback({ type: 'error', msg: t('not_enough_stock') });
      return;
    }

    // Giảm tồn kho và ghi log
    scannedProduct.currentPhysicalStock -= quantity;
    db.logs.push({
      id: Math.floor(Math.random() * 100000),
      productId: scannedProduct.id,
      orderId: selectedOrderId || 0,
      actionType: 'EXPORT',
      quantity,
      timestamp: new Date().toISOString(),
      note: note || t('export_stock'),
      staffId: currentStaff?.id,
      staffName: currentStaff?.name || 'Unknown'
    });
    (db as any).save?.();

    setFeedback({ type: 'success', msg: `✓ ${t('export_stock')} ${quantity} ${scannedProduct.name}\n${t('staff_label')}: ${currentStaff?.name}` });
    refreshApp();

    // Reset sau 2s
    setTimeout(() => {
      setScannedProduct(null);
      setQuantity(1);
      setNote('');
      setSelectedOrderId(null);
      setFeedback(null);
    }, 1500);
  };

  const handleImport = () => {
    if (!scannedProduct || quantity <= 0) return;

    // Tăng tồn kho và ghi log
    scannedProduct.currentPhysicalStock += quantity;
    db.logs.push({
      id: Math.floor(Math.random() * 100000),
      productId: scannedProduct.id,
      orderId: selectedOrderId || 0,
      actionType: 'IMPORT',
      quantity,
      timestamp: new Date().toISOString(),
      note: note || t('import_stock'),
      staffId: currentStaff?.id,
      staffName: currentStaff?.name || 'Unknown'
    });
    (db as any).save?.();

    setFeedback({ type: 'success', msg: `✓ ${t('import_stock')} ${quantity} ${scannedProduct.name}\n${t('staff_label')}: ${currentStaff?.name}` });
    refreshApp();

    setTimeout(() => {
      setScannedProduct(null);
      setQuantity(1);
      setNote('');
      setSelectedOrderId(null);
      setFeedback(null);
    }, 1500);
  };

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <Scan className="w-6 h-6" /> {t('scanner_title')}
      </h2>

      {/* Camera */}
      {!scannedProduct && (
        <div className="mb-4">
          {!showCamera ? (
            <button
              onClick={() => setShowCamera(true)}
              className="w-full bg-slate-800 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg hover:bg-slate-700"
            >
              <Camera className="w-6 h-6" /> {t('open_camera')}
            </button>
          ) : (
            <div className="bg-black rounded-xl overflow-hidden shadow-lg relative">
              <div id="reader" className="w-full"></div>
              <button
                onClick={() => setShowCamera(false)}
                className="absolute top-2 right-2 bg-white/20 text-white p-2 rounded-full hover:bg-red-500"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="bg-white p-4 rounded-xl shadow mb-4">
        <div className="flex gap-2 relative">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t('enter_product')}
            className="flex-1 border p-3 rounded-lg pl-10 focus:ring-2 focus:ring-primary outline-none"
          />
          <Search className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
          <button
            onClick={() => handleSearch()}
            className="bg-primary text-white px-6 rounded-lg font-medium hover:bg-blue-700"
          >
            {t('find')}
          </button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`p-4 mb-4 rounded-xl flex items-center gap-2 text-lg font-bold ${feedback.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
          }`}>
          {feedback.type === 'success' && <CheckCircle className="w-6 h-6" />}
          {feedback.msg}
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="bg-white rounded-xl shadow mb-4 overflow-hidden">
          <div className="p-3 bg-gray-50 border-b font-medium">{t('select_product')} ({searchResults.length})</div>
          <div className="divide-y max-h-60 overflow-y-auto">
            {searchResults.map(p => (
              <button
                key={p.id}
                onClick={() => selectProduct(p)}
                className="w-full text-left p-3 hover:bg-blue-50 flex items-center gap-3"
              >
                <img src={p.imageUrl} className="w-12 h-12 object-cover rounded bg-gray-200" />
                <div className="flex-1">
                  <div className="font-bold">{p.name}</div>
                  <div className="text-sm text-gray-500">{p.code}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">{t('in_stock')}</div>
                  <div className="font-bold text-lg">{p.currentPhysicalStock}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected Product */}
      {scannedProduct && !feedback?.type && (
        <div className="bg-white rounded-xl shadow overflow-hidden border-2 border-blue-500">
          {/* Product Info */}
          <div className="p-4 bg-blue-50 flex gap-4 items-center">
            <img src={scannedProduct.imageUrl} className="w-20 h-20 object-cover rounded-lg shadow" />
            <div className="flex-1">
              <h3 className="font-bold text-lg">{scannedProduct.name}</h3>
              <p className="text-gray-500 font-mono text-sm">{scannedProduct.code}</p>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-500">{t('in_stock')}</div>
              <div className="text-3xl font-bold text-primary">{scannedProduct.currentPhysicalStock}</div>
            </div>
          </div>

          {/* Quantity */}
          <div className="p-4 border-t">
            <label className="block text-sm font-medium mb-2">{t('quantity')}</label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-12 h-12 bg-gray-100 rounded-lg font-bold text-xl hover:bg-gray-200"
              >
                -
              </button>
              <input
                type="number"
                className="flex-1 border-2 p-3 rounded-lg text-center font-bold text-2xl"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                min={1}
              />
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-12 h-12 bg-gray-100 rounded-lg font-bold text-xl hover:bg-gray-200"
              >
                +
              </button>
            </div>
          </div>

          {/* Link to Order (optional) */}
          <div className="px-4 pb-2">
            <label className="block text-sm font-medium mb-1 text-gray-600">
              <FileText className="w-4 h-4 inline mr-1" /> {t('link_order_optional')}
            </label>
            <select
              value={selectedOrderId || ''}
              onChange={(e) => setSelectedOrderId(e.target.value ? Number(e.target.value) : null)}
              className="w-full border p-2 rounded-lg text-sm bg-white"
            >
              <option value="">{t('no_link_order')}</option>
              {activeOrders.map(o => {
                const customer = db.customers.find(c => c.id === o.customerId);
                return (
                  <option key={o.id} value={o.id}>
                    #{o.id} - {customer?.name} ({o.status === 'ACTIVE' ? t('renting_status') : t('booked_status')})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Current Staff Info */}
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 bg-blue-50 p-2 rounded-lg">
              <User className="w-4 h-4 text-blue-600" />
              <span className="text-sm text-blue-700">{t('staff_info')}: <strong>{currentStaff?.name}</strong></span>
            </div>
          </div>

          {/* Note */}
          <div className="px-4 pb-4">
            <label className="block text-sm font-medium mb-1 text-gray-600">
              <FileText className="w-4 h-4 inline mr-1" /> {t('note')}
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('note_placeholder')}
              className="w-full border p-2 rounded-lg text-sm"
            />
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-0 border-t">
            <button
              onClick={handleImport}
              className="py-5 bg-green-500 text-white font-bold text-lg flex items-center justify-center gap-2 hover:bg-green-600 active:bg-green-700"
            >
              <ArrowDownCircle className="w-6 h-6" /> {t('import_btn')}
            </button>
            <button
              onClick={handleExport}
              disabled={quantity > scannedProduct.currentPhysicalStock}
              className="py-5 bg-red-500 text-white font-bold text-lg flex items-center justify-center gap-2 hover:bg-red-600 active:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowUpCircle className="w-6 h-6" /> {t('export_btn')}
            </button>
          </div>

          {/* Cancel */}
          <button
            onClick={() => setScannedProduct(null)}
            className="w-full py-3 text-gray-500 hover:bg-gray-50 text-sm"
          >
            ← {t('select_other')}
          </button>
        </div>
      )}

      {/* Quick Stock Overview */}
      {!scannedProduct && !showCamera && (
        <div className="mt-6">
          <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Package className="w-5 h-5" /> {t('current_stock_label')}
          </h3>
          <div className="bg-white rounded-xl shadow divide-y max-h-80 overflow-y-auto">
            {db.products.map(p => (
              <div
                key={p.id}
                onClick={() => selectProduct(p)}
                className="p-3 flex items-center gap-3 hover:bg-blue-50 cursor-pointer"
              >
                <img src={p.imageUrl} className="w-10 h-10 object-cover rounded" />
                <div className="flex-1">
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-gray-400">{p.code}</div>
                </div>
                <div className={`font-bold text-lg ${p.currentPhysicalStock <= 0 ? 'text-red-500' : 'text-green-600'}`}>
                  {p.currentPhysicalStock}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
