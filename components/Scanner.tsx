import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { Product, EquipmentSet } from '../types';
import { Scan, ArrowUpCircle, ArrowDownCircle, CheckCircle, Search, Camera, X, Package, FileText, User, Minus, Plus, AlertCircle, Box, ChevronDown, QrCode } from 'lucide-react';

declare const Html5QrcodeScanner: any;

interface ScannerProps {
  refreshApp: () => void;
  pendingScanCode?: string | null;
  onClearPendingCode?: () => void;
}

export const Scanner: React.FC<ScannerProps> = ({ refreshApp, pendingScanCode, onClearPendingCode }) => {
  const [inputQuery, setInputQuery] = useState('');
  const [scannedProduct, setScannedProduct] = useState<Product | null>(null);
  const [scannedSet, setScannedSet] = useState<EquipmentSet | null>(null);
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [note, setNote] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [showOrderSelect, setShowOrderSelect] = useState(false);
  const [isProcessingSet, setIsProcessingSet] = useState(false);
  const scannerRef = useRef<any>(null);

  const currentStaff = db.currentUser;
  const activeOrders = db.orders.filter(o => o.status === 'BOOKED' || o.status === 'ACTIVE');

  // Handle pending scan code from deep link
  useEffect(() => {
    if (pendingScanCode) {
      // Process the pending code as if it was scanned
      const set = db.getEquipmentSetByCode(pendingScanCode);
      if (set) {
        setScannedSet(set);
      } else {
        setFeedback({ type: 'error', msg: `${t('set_not_found')}: ${pendingScanCode}` });
      }
      // Clear the pending code
      if (onClearPendingCode) {
        onClearPendingCode();
      }
    }
  }, [pendingScanCode, onClearPendingCode]);

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
      setTimeout(async () => {
        try {
          // Use Html5Qrcode directly for auto camera selection
          const html5Qrcode = new (window as any).Html5Qrcode("reader");
          scannerRef.current = html5Qrcode;

          await html5Qrcode.start(
            { facingMode: "environment" }, // Prefer back camera
            { fps: 10, qrbox: { width: 250, height: 250 } },
            onScanSuccess,
            () => { } // Ignore errors from scanning
          );
        } catch (err) {
          console.error("Failed to start camera:", err);
          setFeedback({ type: 'error', msg: 'カメラを起動できませんでした' });
          setShowCamera(false);
        }
      }, 100);
    } else {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => { });
        scannerRef.current = null;
      }
    }
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => { });
      }
    };
  }, [showCamera]);

  // Haptic feedback for scan success
  const vibrate = (pattern: number | number[] = 50) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  };

  const onScanSuccess = (decodedText: string) => {
    setShowCamera(false);
    vibrate([50, 30, 50]); // Short vibration pattern for feedback

    // Check if this is a URL-based Equipment Set QR (format: https://domain/scan?code=SET-001)
    let setCode: string | null = null;
    if (decodedText.includes('/scan?code=')) {
      const url = new URL(decodedText);
      setCode = url.searchParams.get('code');
    } else if (decodedText.startsWith('SET:')) {
      setCode = decodedText.replace('SET:', '');
    }

    if (setCode) {
      const equipmentSet = db.getEquipmentSetByCode(setCode);
      if (equipmentSet) {
        setScannedSet(equipmentSet);
        setScannedProduct(null);
        setSearchResults([]);
        setInputQuery('');
        vibrate(100); // Longer vibration for success
        return;
      } else {
        setFeedback({ type: 'error', msg: `${t('set_not_found')}: ${setCode}` });
        return;
      }
    }

    // Regular product search
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
    if (!query) {
      setSearchResults([]);
      return;
    }

    // Find all matching products (by code or name)
    const matches = db.products.filter(p =>
      p.code.toLowerCase().includes(query) || p.name.toLowerCase().includes(query)
    );

    if (matches.length === 0) {
      setFeedback({ type: 'error', msg: `${t('not_found')}: "${query}"` });
      setSearchResults([]);
    } else {
      // Always show suggestions - let user click to select
      setSearchResults(matches.slice(0, 10)); // Limit to 10 for performance
      setFeedback(null);
    }
  };

  const handleExport = async () => {
    if (!scannedProduct || quantity <= 0) return;
    if (quantity > scannedProduct.currentPhysicalStock) {
      setFeedback({ type: 'error', msg: t('not_enough_stock') });
      return;
    }

    try {
      console.log('Exporting:', scannedProduct.id, quantity, selectedOrderId);

      if (selectedOrderId) {
        await db.exportStock(selectedOrderId, scannedProduct.id, quantity, note || t('export_stock'));
      } else {
        // Direct update to Supabase
        const newStock = scannedProduct.currentPhysicalStock - quantity;
        console.log('Updating stock to:', newStock);
        await db.updateProductStock(scannedProduct.id, newStock, 'EXPORT', quantity, note || t('export_stock'));
      }

      setFeedback({ type: 'success', msg: `${t('export_stock_success')} ${quantity} ${scannedProduct.name}` });
      await refreshApp();

      setTimeout(() => {
        setScannedProduct(null);
        setQuantity(1);
        setNote('');
        setSelectedOrderId(null);
        setFeedback(null);
      }, 1500);
    } catch (e: any) {
      console.error('Export error:', e);
      setFeedback({ type: 'error', msg: e.message || 'Lỗi xuất kho' });
    }
  };

  const handleImport = async () => {
    if (!scannedProduct || quantity <= 0) return;

    try {
      console.log('Importing:', scannedProduct.id, quantity, selectedOrderId);

      if (selectedOrderId) {
        await db.importStock(selectedOrderId, scannedProduct.id, quantity, note || t('import_stock'));
      } else {
        // Direct update to Supabase
        const newStock = scannedProduct.currentPhysicalStock + quantity;
        console.log('Updating stock to:', newStock);
        await db.updateProductStock(scannedProduct.id, newStock, 'IMPORT', quantity, note || t('import_stock'));
      }

      setFeedback({ type: 'success', msg: `Nhập kho ${quantity} ${scannedProduct.name}` });
      await refreshApp();

      setTimeout(() => {
        setScannedProduct(null);
        setQuantity(1);
        setNote('');
        setSelectedOrderId(null);
        setFeedback(null);
      }, 1500);
    } catch (e: any) {
      console.error('Import error:', e);
      setFeedback({ type: 'error', msg: e.message || 'Lỗi nhập kho' });
    }
  };

  // Batch export all items in a set
  const handleBatchExport = async () => {
    if (!scannedSet || isProcessingSet) return;
    setIsProcessingSet(true);

    try {
      let successCount = 0;
      let failCount = 0;

      for (const item of scannedSet.items) {
        const product = db.products.find(p => p.id === item.productId);
        if (product && product.currentPhysicalStock >= item.quantity) {
          try {
            await db.updateProductStock(
              product.id,
              product.currentPhysicalStock - item.quantity,
              'EXPORT',
              item.quantity,
              `${t('export_by_set')}: ${scannedSet.name}`
            );
            successCount++;
          } catch {
            failCount++;
          }
        } else {
          failCount++;
        }
      }

      await refreshApp();
      setFeedback({
        type: successCount > 0 ? 'success' : 'error',
        msg: `Đã xuất ${successCount}/${scannedSet.items.length} sản phẩm${failCount > 0 ? ` (${failCount} lỗi)` : ''}`
      });

      setTimeout(() => {
        setScannedSet(null);
        setFeedback(null);
      }, 2000);
    } finally {
      setIsProcessingSet(false);
    }
  };

  // Batch import all items in a set
  const handleBatchImport = async () => {
    if (!scannedSet || isProcessingSet) return;
    setIsProcessingSet(true);

    try {
      let successCount = 0;

      for (const item of scannedSet.items) {
        const product = db.products.find(p => p.id === item.productId);
        if (product) {
          try {
            await db.updateProductStock(
              product.id,
              product.currentPhysicalStock + item.quantity,
              'IMPORT',
              item.quantity,
              `Nhập theo bộ: ${scannedSet.name}`
            );
            successCount++;
          } catch { }
        }
      }

      await refreshApp();
      setFeedback({
        type: 'success',
        msg: `Đã nhập ${successCount}/${scannedSet.items.length} sản phẩm`
      });

      setTimeout(() => {
        setScannedSet(null);
        setFeedback(null);
      }, 2000);
    } finally {
      setIsProcessingSet(false);
    }
  };

  // State for per-item actions when processing a set
  const [setItemActions, setSetItemActions] = useState<{
    [productId: number]: { action: 'EXPORT' | 'IMPORT' | 'NONE'; quantity: number }
  }>({});

  // Initialize per-item actions when a set is scanned
  React.useEffect(() => {
    if (scannedSet) {
      const initialActions: { [productId: number]: { action: 'EXPORT' | 'IMPORT' | 'NONE'; quantity: number } } = {};
      scannedSet.productIds.forEach(productId => {
        initialActions[productId] = { action: 'NONE', quantity: 1 };
      });
      setSetItemActions(initialActions);
    }
  }, [scannedSet]);

  const updateItemAction = (productId: number, action: 'EXPORT' | 'IMPORT' | 'NONE') => {
    setSetItemActions(prev => ({
      ...prev,
      [productId]: { ...prev[productId], action }
    }));
  };

  const updateItemQuantity = (productId: number, qty: number) => {
    setSetItemActions(prev => ({
      ...prev,
      [productId]: { ...prev[productId], quantity: Math.max(0, qty) }
    }));
  };

  // Remove item from the set view (set quantity to 0)
  const removeItemFromSet = (productId: number) => {
    setSetItemActions(prev => ({
      ...prev,
      [productId]: { action: 'NONE', quantity: 0 }
    }));
  };

  // Process all items with their individual actions
  const handleProcessSet = async () => {
    if (!scannedSet || isProcessingSet) return;
    setIsProcessingSet(true);

    try {
      let exportCount = 0;
      let importCount = 0;
      let errorCount = 0;

      const entries = Object.entries(setItemActions) as [string, { action: 'EXPORT' | 'IMPORT' | 'NONE'; quantity: number }][];

      for (const [productIdStr, itemAction] of entries) {
        const { action, quantity } = itemAction;
        // Skip if no action or quantity is 0
        if (action === 'NONE' || quantity <= 0) continue;

        const productId = parseInt(productIdStr);
        const product = db.products.find(p => p.id === productId);
        if (!product) continue;

        try {
          if (action === 'EXPORT') {
            if (product.currentPhysicalStock < quantity) {
              errorCount++;
              continue;
            }
            await db.updateProductStock(
              product.id,
              product.currentPhysicalStock - quantity,
              'EXPORT',
              quantity,
              `${t('export_by_set')}: ${scannedSet.name}`
            );
            exportCount++;
          } else if (action === 'IMPORT') {
            await db.updateProductStock(
              product.id,
              product.currentPhysicalStock + quantity,
              'IMPORT',
              quantity,
              `${t('import_by_set')}: ${scannedSet.name}`
            );
            importCount++;
          }
        } catch {
          errorCount++;
        }
      }

      await refreshApp();

      const messages = [];
      if (exportCount > 0) messages.push(`${t('export_count_result')} ${exportCount}`);
      if (importCount > 0) messages.push(`${t('import_count_result')} ${importCount}`);
      if (errorCount > 0) messages.push(`${t('error_count_result')} ${errorCount}`);

      setFeedback({
        type: exportCount + importCount > 0 ? 'success' : 'error',
        msg: messages.join(', ') + ` ${t('products_text')}`
      });

      setTimeout(() => {
        setScannedSet(null);
        setSetItemActions({});
        setFeedback(null);
      }, 2000);
    } finally {
      setIsProcessingSet(false);
    }
  };

  // Quick export all - 1 of each product
  const handleQuickExport = async () => {
    if (!scannedSet || isProcessingSet) return;
    setIsProcessingSet(true);
    vibrate(50);

    let successCount = 0;
    for (const productId of scannedSet.productIds) {
      const product = db.products.find(p => p.id === productId);
      if (!product || product.currentPhysicalStock < 1) continue;
      try {
        await db.updateProductStock(product.id, product.currentPhysicalStock - 1, 'EXPORT', 1, `${t('export_by_set')}: ${scannedSet.name}`);
        successCount++;
      } catch { }
    }

    await refreshApp();
    vibrate([100, 50, 100]);
    setFeedback({ type: 'success', msg: `${t('export_count_result')} ${successCount}/${scannedSet.productIds.length}` });
    setIsProcessingSet(false);
    setTimeout(() => { setScannedSet(null); setFeedback(null); }, 1500);
  };

  // Quick import all - 1 of each product
  const handleQuickImport = async () => {
    if (!scannedSet || isProcessingSet) return;
    setIsProcessingSet(true);
    vibrate(50);

    let successCount = 0;
    for (const productId of scannedSet.productIds) {
      const product = db.products.find(p => p.id === productId);
      if (!product) continue;
      try {
        await db.updateProductStock(product.id, product.currentPhysicalStock + 1, 'IMPORT', 1, `${t('import_by_set')}: ${scannedSet.name}`);
        successCount++;
      } catch { }
    }

    await refreshApp();
    vibrate([100, 50, 100]);
    setFeedback({ type: 'success', msg: `${t('import_count_result')} ${successCount}/${scannedSet.productIds.length}` });
    setIsProcessingSet(false);
    setTimeout(() => { setScannedSet(null); setFeedback(null); }, 1500);
  };

  const actionValues = Object.values(setItemActions) as { action: 'EXPORT' | 'IMPORT' | 'NONE'; quantity: number }[];
  const hasAnyAction = actionValues.some(a => a.action !== 'NONE');

  // Equipment Set View - SIMPLIFIED with 2 big buttons
  if (scannedSet) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col">
        {/* Header */}
        <div className="p-4 flex items-center justify-between">
          <button
            onClick={() => { setScannedSet(null); setFeedback(null); }}
            className="p-2 text-white/70 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <span className="text-white/50 text-sm font-mono">{scannedSet.code}</span>
        </div>

        {/* Center Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-6">
          <div className="w-20 h-20 bg-teal-500/20 rounded-3xl flex items-center justify-center mb-4">
            <QrCode className="w-10 h-10 text-teal-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">{scannedSet.name}</h1>
          <p className="text-slate-400 mb-8">{scannedSet.productIds.length} {t('products_text')}</p>

          {/* Feedback */}
          {feedback && (
            <div className={`w-full max-w-xs p-4 rounded-2xl flex items-center gap-3 mb-6 ${feedback.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
              {feedback.type === 'success' ? <CheckCircle className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
              <span className="font-medium">{feedback.msg}</span>
            </div>
          )}

          {/* Two Big Action Buttons */}
          {!feedback && !isProcessingSet && (
            <div className="w-full max-w-xs space-y-4">
              <button
                onClick={handleQuickExport}
                className="w-full py-5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg shadow-orange-500/30 active:scale-95 transition-transform"
              >
                <ArrowUpCircle className="w-7 h-7" />
                {t('batch_export')}
              </button>

              <button
                onClick={handleQuickImport}
                className="w-full py-5 bg-gradient-to-r from-teal-500 to-emerald-500 text-white rounded-2xl font-bold text-xl flex items-center justify-center gap-3 shadow-lg shadow-teal-500/30 active:scale-95 transition-transform"
              >
                <ArrowDownCircle className="w-7 h-7" />
                {t('batch_import')}
              </button>
            </div>
          )}

          {/* Loading */}
          {isProcessingSet && !feedback && (
            <div className="text-white/50 flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {t('processing')}
            </div>
          )}
        </div>

        {/* Product preview */}
        <div className="p-4 border-t border-white/10">
          <div className="flex flex-wrap gap-1 justify-center">
            {scannedSet.productIds.slice(0, 4).map(productId => {
              const product = db.products.find(p => p.id === productId);
              return product ? (
                <span key={productId} className="px-2 py-1 bg-white/10 text-white/60 text-xs rounded-lg truncate max-w-[80px]">
                  {product.name}
                </span>
              ) : null;
            })}
            {scannedSet.productIds.length > 4 && (
              <span className="px-2 py-1 text-white/40 text-xs">+{scannedSet.productIds.length - 4}</span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Product Detail View - Modern Design
  if (scannedProduct && !feedback?.type) {
    const availPercent = (scannedProduct.currentPhysicalStock / scannedProduct.totalOwned) * 100;
    const onRent = scannedProduct.totalOwned - scannedProduct.currentPhysicalStock;
    const isLow = scannedProduct.currentPhysicalStock <= 2;
    const isOut = scannedProduct.currentPhysicalStock === 0;

    return (
      <div className="min-h-screen bg-slate-100">
        {/* Header with Product Image */}
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 to-transparent z-10" />
          <img
            src={scannedProduct.imageUrl}
            alt={scannedProduct.name}
            className="w-full h-56 md:h-72 object-cover"
          />
          <button
            onClick={() => setScannedProduct(null)}
            className="absolute top-4 left-4 z-20 bg-white/20 backdrop-blur-md text-white p-2 rounded-full hover:bg-white/30 transition-all"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Product Badge */}
          <div className="absolute bottom-4 left-4 right-4 z-20">
            <div className="flex items-end justify-between">
              <div>
                <span className="inline-block px-2 py-1 bg-white/20 backdrop-blur-md text-white text-xs font-medium rounded-lg mb-2">
                  {scannedProduct.code}
                </span>
                <h1 className="text-2xl font-bold text-white drop-shadow-lg">{scannedProduct.name}</h1>
              </div>
              <div className={`px-3 py-1.5 rounded-xl text-sm font-bold ${isOut ? 'bg-red-500 text-white' : isLow ? 'bg-orange-500 text-white' : 'bg-green-500 text-white'}`}>
                {isOut ? t('out_of_stock') : isLow ? t('low_stock') : t('available')}
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-4 -mt-4 relative z-30 pb-32">
          {/* Stock Card */}
          <div className="bg-white rounded-2xl shadow-lg p-5 mb-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-slate-500">{t('current_stock_label')}</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className={`text-4xl font-bold ${isOut ? 'text-red-500' : isLow ? 'text-orange-500' : 'text-green-600'}`}>
                    {scannedProduct.currentPhysicalStock}
                  </span>
                  <span className="text-slate-400">/ {scannedProduct.totalOwned}</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">{t('on_rent')}</p>
                <p className="text-2xl font-bold text-blue-600 mt-1">{onRent}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all rounded-full ${isOut ? 'bg-red-500' : isLow ? 'bg-orange-500' : 'bg-green-500'}`}
                style={{ width: `${availPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-400">
              <span>{t('available')}: {scannedProduct.currentPhysicalStock}</span>
              <span>{t('on_rent')}: {onRent}</span>
            </div>
          </div>

          {/* Location Banner - Prominent display for warehouse staff */}
          {scannedProduct.location && (
            <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg p-5 mb-4 text-white">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
                  <Box className="w-7 h-7" />
                </div>
                <div className="flex-1">
                  <p className="text-indigo-200 text-sm font-medium">{t('location') || 'Vị trí kho'}</p>
                  <p className="text-2xl font-bold tracking-wide">{scannedProduct.location}</p>
                </div>
              </div>
            </div>
          )}

          {/* Quantity Selector */}
          <div className="bg-white rounded-2xl shadow-lg p-5 mb-4">
            <label className="text-sm font-medium text-slate-700 mb-3 block">{t('quantity')}</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all"
              >
                <Minus className="w-6 h-6 text-slate-600" />
              </button>
              <div className="flex-1 relative">
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="w-full text-center text-3xl font-bold py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  min={1}
                />
              </div>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="w-14 h-14 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all"
              >
                <Plus className="w-6 h-6 text-slate-600" />
              </button>
            </div>

            {/* Quick quantity buttons */}
            <div className="flex gap-2 mt-3">
              {[1, 5, 10, 20].map(n => (
                <button
                  key={n}
                  onClick={() => setQuantity(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${quantity === n ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Order Link & Note */}
          <div className="bg-white rounded-2xl shadow-lg p-5 mb-4 space-y-4">
            {/* Order Select */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block flex items-center gap-2">
                <FileText className="w-4 h-4" /> {t('link_to_order')}
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowOrderSelect(!showOrderSelect)}
                  className="w-full p-3 border-2 border-slate-200 rounded-xl text-left flex items-center justify-between hover:border-slate-300 transition-all"
                >
                  <span className={selectedOrderId ? 'text-slate-800' : 'text-slate-400'}>
                    {selectedOrderId
                      ? `#${selectedOrderId} - ${db.customers.find(c => c.id === db.orders.find(o => o.id === selectedOrderId)?.customerId)?.name}`
                      : t('no_order_link')
                    }
                  </span>
                  <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showOrderSelect ? 'rotate-180' : ''}`} />
                </button>

                {showOrderSelect && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-lg z-50 max-h-48 overflow-y-auto">
                    <button
                      onClick={() => { setSelectedOrderId(null); setShowOrderSelect(false); }}
                      className="w-full p-3 text-left hover:bg-slate-50 text-slate-500"
                    >
                      {t('no_link')}
                    </button>
                    {activeOrders.map(o => {
                      const customer = db.customers.find(c => c.id === o.customerId);
                      return (
                        <button
                          key={o.id}
                          onClick={() => { setSelectedOrderId(o.id); setShowOrderSelect(false); }}
                          className="w-full p-3 text-left hover:bg-blue-50 flex items-center justify-between"
                        >
                          <span>#{o.id} - {customer?.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {o.status === 'ACTIVE' ? t('renting_status') : t('booked_status')}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Note */}
            <div>
              <label className="text-sm font-medium text-slate-700 mb-2 block">{t('note')}</label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('note_placeholder')}
                className="w-full p-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
              />
            </div>

            {/* Staff Info */}
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
              <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-blue-600">{t('performed_by')}</p>
                <p className="font-semibold text-blue-800">{currentStaff?.name}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Action Buttons - above mobile nav */}
        <div className="fixed bottom-20 md:bottom-0 left-0 right-0 bg-white border-t shadow-lg p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:pb-4 z-40">
          <div className="max-w-lg mx-auto grid grid-cols-2 gap-3">
            <button
              onClick={handleImport}
              className="py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40 active:scale-[0.98] transition-all"
            >
              <ArrowDownCircle className="w-5 h-5" /> {t('import_to_stock')}
            </button>
            <button
              onClick={handleExport}
              disabled={quantity > scannedProduct.currentPhysicalStock}
              className="py-4 bg-gradient-to-r from-red-500 to-red-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 hover:shadow-xl hover:shadow-red-500/40 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <ArrowUpCircle className="w-5 h-5" /> {t('export_from_stock')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Main Scanner View
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 text-white px-4 pt-4 pb-8 md:px-8">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/10 rounded-xl">
              <Scan className="w-6 h-6" />
            </div>
            <h1 className="text-xl font-bold">{t('scanner_title')}</h1>
          </div>
          <p className="text-slate-400 text-sm">{t('scan_or_search')}</p>
        </div>
      </div>

      <div className="px-4 -mt-4 pb-24 md:pb-8">
        <div className="max-w-lg mx-auto space-y-4">

          {/* Camera Button / Scanner */}
          {!showCamera ? (
            <button
              onClick={() => setShowCamera(true)}
              className="w-full bg-white p-6 rounded-2xl shadow-lg flex items-center gap-4 hover:shadow-xl transition-all group"
            >
              <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30 group-hover:scale-105 transition-transform">
                <Camera className="w-7 h-7 text-white" />
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-800">{t('open_camera')}</p>
                <p className="text-sm text-slate-500">{t('scan_qr_barcode')}</p>
              </div>
            </button>
          ) : (
            <div className="bg-black rounded-2xl overflow-hidden shadow-xl relative">
              <div id="reader" className="w-full"></div>
              <button
                onClick={() => setShowCamera(false)}
                className="absolute top-3 right-3 bg-white/20 backdrop-blur text-white p-2 rounded-full hover:bg-red-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}

          {/* Search Box */}
          <div className="bg-white p-4 rounded-2xl shadow-lg">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => {
                    const value = e.target.value;
                    setInputQuery(value);
                    // Auto-search as user types
                    if (value.trim()) {
                      handleSearch(value);
                    } else {
                      setSearchResults([]);
                      setFeedback(null);
                    }
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder={t('enter_product')}
                  className="w-full pl-12 pr-4 py-3 bg-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                />
              </div>
              {inputQuery.trim() ? (
                <button
                  onClick={() => {
                    setInputQuery('');
                    setSearchResults([]);
                    setFeedback(null);
                  }}
                  className="px-6 bg-slate-200 text-slate-600 rounded-xl font-medium hover:bg-slate-300 active:scale-95 transition-all flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  {t('clear') || 'Xóa'}
                </button>
              ) : (
                <button
                  onClick={() => handleSearch()}
                  className="px-6 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 active:scale-95 transition-all"
                >
                  {t('find')}
                </button>
              )}
            </div>
          </div>

          {/* Feedback */}
          {feedback && (
            <div className={`p-4 rounded-2xl flex items-center gap-3 ${feedback.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              {feedback.type === 'success' ? <CheckCircle className="w-6 h-6 shrink-0" /> : <AlertCircle className="w-6 h-6 shrink-0" />}
              <p className="font-medium">{feedback.msg}</p>
            </div>
          )}

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="p-4 bg-slate-50 border-b">
                <p className="font-medium text-slate-700">{t('select_product_count')} ({searchResults.length})</p>
              </div>
              <div className="divide-y max-h-64 overflow-y-auto">
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className="w-full p-4 flex items-center gap-4 hover:bg-blue-50 transition-colors"
                  >
                    <img src={p.imageUrl} className="w-14 h-14 object-cover rounded-xl bg-slate-100" />
                    <div className="flex-1 text-left">
                      <p className="font-semibold text-slate-800">{p.name}</p>
                      <p className="text-sm text-slate-500">{p.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-400">{t('in_stock')}</p>
                      <p className={`text-xl font-bold ${p.currentPhysicalStock <= 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {p.currentPhysicalStock}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quick Stock List */}
          {!showCamera && searchResults.length === 0 && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-slate-500" />
                  <p className="font-medium text-slate-700">{t('equipment_in_stock')}</p>
                </div>
                <span className="text-sm text-slate-400">{db.products.length} {t('products_count')}</span>
              </div>
              <div className="divide-y max-h-80 overflow-y-auto">
                {db.products.map(p => {
                  const isLow = p.currentPhysicalStock > 0 && p.currentPhysicalStock <= 2;
                  const isOut = p.currentPhysicalStock === 0;
                  return (
                    <button
                      key={p.id}
                      onClick={() => selectProduct(p)}
                      className="w-full p-4 flex items-center gap-4 hover:bg-blue-50 transition-colors"
                    >
                      <div className="relative">
                        <img src={p.imageUrl} className="w-12 h-12 object-cover rounded-xl bg-slate-100" />
                        {(isOut || isLow) && (
                          <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${isOut ? 'bg-red-500' : 'bg-orange-500'}`} />
                        )}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium text-slate-800 truncate">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.code}</p>
                        {p.location && <p className="text-xs text-indigo-500 font-mono">📍 {p.location}</p>}
                      </div>
                      <div className={`text-xl font-bold ${isOut ? 'text-red-500' : isLow ? 'text-orange-500' : 'text-green-600'}`}>
                        {p.currentPhysicalStock}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
