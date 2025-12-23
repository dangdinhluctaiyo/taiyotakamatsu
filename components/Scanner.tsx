import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../services/db';
import { supabase } from '../services/supabase';
import { t } from '../services/i18n';
import { Product, EquipmentSet, DeviceSerial } from '../types';
import { Scan, ArrowUpCircle, ArrowDownCircle, CheckCircle, Search, Camera, X, Package, FileText, User, Minus, Plus, AlertCircle, Box, ChevronDown, QrCode, Tag, Check } from 'lucide-react';

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
  const [isProcessing, setIsProcessing] = useState(false);
  const scannerRef = useRef<any>(null);

  const [availableSerials, setAvailableSerials] = useState<DeviceSerial[]>([]);
  const [selectedSerialIds, setSelectedSerialIds] = useState<number[]>([]);
  const [loadingSerials, setLoadingSerials] = useState(false);
  const [serialSearchTerm, setSerialSearchTerm] = useState('');
  const [serialMode, setSerialMode] = useState<'export' | 'import'>('export');

  // Customer input states
  const [customerName, setCustomerName] = useState('');
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const customerSuggestions = customerName.length > 0
    ? db.customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).slice(0, 5)
    : [];

  const currentStaff = db.currentUser;
  const activeOrders = db.orders.filter(o => o.status === 'BOOKED' || o.status === 'ACTIVE');

  // Load serials when a serialized product is scanned
  const loadSerials = async (productId: number, mode: 'export' | 'import') => {
    setLoadingSerials(true);
    setAvailableSerials([]);
    setSelectedSerialIds([]);
    try {
      // Filter by status based on mode
      const statusFilter = mode === 'export' ? 'AVAILABLE' : 'ON_RENT';

      const { data, error } = await supabase
        .from('device_serials')
        .select('*')
        .eq('product_id', productId)
        .eq('status', statusFilter)
        .order('serial_number', { ascending: true });

      if (error) {
        console.error('Error loading serials:', error);
        // Fallback to localStorage
        const storedSerials = localStorage.getItem(`serials_${productId}`);
        if (storedSerials) {
          const parsed = JSON.parse(storedSerials) as DeviceSerial[];
          setAvailableSerials(parsed.filter(s => s.status === statusFilter));
        }
      } else if (data) {
        const serials: DeviceSerial[] = data.map(d => ({
          id: d.id,
          productId: d.product_id,
          serialNumber: d.serial_number,
          status: d.status,
          orderId: d.order_id
        }));
        setAvailableSerials(serials);
      }
    } catch (e) {
      console.error('Error loading serials:', e);
    } finally {
      setLoadingSerials(false);
    }
  };

  // Load serials when scannedProduct changes and is serialized
  useEffect(() => {
    if (scannedProduct?.isSerialized) {
      loadSerials(scannedProduct.id, 'export');
    } else {
      setAvailableSerials([]);
      setSelectedSerialIds([]);
    }
  }, [scannedProduct?.id, scannedProduct?.isSerialized]);

  // Toggle serial selection
  const toggleSerialSelection = (serialId: number) => {
    setSelectedSerialIds(prev =>
      prev.includes(serialId)
        ? prev.filter(id => id !== serialId)
        : [...prev, serialId]
    );
  };

  // Select all serials
  const selectAllSerials = () => {
    const filteredIds = filteredSerials.map(s => s.id);
    setSelectedSerialIds(filteredIds);
  };

  // Clear all selections
  const clearSerialSelection = () => {
    setSelectedSerialIds([]);
  };

  // Filter serials by search term
  const filteredSerials = availableSerials.filter(s =>
    s.serialNumber.toLowerCase().includes(serialSearchTerm.toLowerCase())
  );


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
    let isMounted = true;

    if (showCamera) {
      setTimeout(async () => {
        try {
          // Check if component is still mounted
          if (!isMounted) return;

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
          if (isMounted) {
            setFeedback({ type: 'error', msg: 'カメラを起動できませんでした' });
            setShowCamera(false);
          }
        }
      }, 100);
    } else {
      // Safe cleanup when closing camera
      const stopCamera = async () => {
        if (scannerRef.current) {
          try {
            const scanner = scannerRef.current;
            scannerRef.current = null;
            await scanner.stop();
          } catch (err) {
            console.log('Camera already stopped or not started:', err);
          }
        }
      };
      stopCamera();
    }

    return () => {
      isMounted = false;
      // Cleanup on unmount
      const cleanupCamera = async () => {
        if (scannerRef.current) {
          try {
            const scanner = scannerRef.current;
            scannerRef.current = null;
            await scanner.stop();
          } catch (err) {
            console.log('Cleanup: Camera already stopped:', err);
          }
        }
      };
      cleanupCamera();
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
    if (!scannedProduct || isProcessing) return;

    // Require customer name
    if (!customerName.trim()) {
      setFeedback({ type: 'error', msg: 'Vui lòng nhập tên khách hàng' });
      return;
    }

    setIsProcessing(true);

    // Create new customer if name entered but not found
    let finalCustomerName = customerName.trim();
    if (finalCustomerName && !db.customers.some(c => c.name === finalCustomerName)) {
      try {
        await db.addCustomer({ name: finalCustomerName, phone: '' });
        await refreshApp();
      } catch (e) {
        console.error('Error creating customer:', e);
      }
    }

    // Build note with customer name
    const noteWithCustomer = finalCustomerName
      ? `${finalCustomerName}${note ? ' - ' + note : ''}`
      : note;

    // For serialized products, use selected serials
    if (scannedProduct.isSerialized) {
      if (selectedSerialIds.length === 0) {
        setFeedback({ type: 'error', msg: 'Vui lòng chọn serial để xuất' });
        setIsProcessing(false);
        return;
      }

      try {
        console.log('Exporting serials:', selectedSerialIds);

        // Update each selected serial to ON_RENT
        for (const serialId of selectedSerialIds) {
          await supabase
            .from('device_serials')
            .update({
              status: 'ON_RENT',
              order_id: selectedOrderId || null
            })
            .eq('id', serialId);
        }
        // Update stock count
        const exportQty = selectedSerialIds.length;
        if (selectedOrderId) {
          await db.exportStock(selectedOrderId, scannedProduct.id, exportQty, noteWithCustomer || t('export_stock'));
        } else {
          const newStock = scannedProduct.currentPhysicalStock - exportQty;
          await db.updateProductStock(scannedProduct.id, newStock, 'EXPORT', exportQty, noteWithCustomer || t('export_stock'));
        }

        const serialNumbers = availableSerials
          .filter(s => selectedSerialIds.includes(s.id))
          .map(s => s.serialNumber)
          .join(', ');

        // Also create CLEAN log to remove from cleaning tasks
        await supabase.from('inventory_logs').insert({
          product_id: scannedProduct.id,
          order_id: selectedOrderId || null,
          action_type: 'CLEAN',
          quantity: exportQty,
          staff_id: db.currentUser?.id,
          staff_name: db.currentUser?.name,
          note: `出庫時清掃済み / Đã xuất kho (${serialNumbers})`
        });

        await refreshApp();

        // Reset immediately
        setScannedProduct(null);
        setQuantity(1);
        setNote('');
        setCustomerName('');
        setSelectedOrderId(null);
        setSelectedSerialIds([]);
        setIsProcessing(false);
      } catch (e: any) {
        console.error('Export error:', e);
        setFeedback({ type: 'error', msg: e.message || 'Lỗi xuất kho' });
        setIsProcessing(false);
      }
    } else {
      // Non-serialized product: use quantity
      if (quantity <= 0) { setIsProcessing(false); return; }
      if (quantity > scannedProduct.currentPhysicalStock) {
        setFeedback({ type: 'error', msg: t('not_enough_stock') });
        setIsProcessing(false);
        return;
      }

      try {
        console.log('Exporting:', scannedProduct.id, quantity, selectedOrderId);

        if (selectedOrderId) {
          await db.exportStock(selectedOrderId, scannedProduct.id, quantity, noteWithCustomer || t('export_stock'));
        } else {
          const newStock = scannedProduct.currentPhysicalStock - quantity;
          console.log('Updating stock to:', newStock);
          await db.updateProductStock(scannedProduct.id, newStock, 'EXPORT', quantity, noteWithCustomer || t('export_stock'));
        }

        // Also create CLEAN log to remove from cleaning tasks
        await supabase.from('inventory_logs').insert({
          product_id: scannedProduct.id,
          order_id: selectedOrderId || null,
          action_type: 'CLEAN',
          quantity: quantity,
          staff_id: db.currentUser?.id,
          staff_name: db.currentUser?.name,
          note: `出庫時清掃済み / Đã xuất kho`
        });

        await refreshApp();

        // Reset immediately
        setScannedProduct(null);
        setQuantity(1);
        setNote('');
        setCustomerName('');
        setSelectedOrderId(null);
        setIsProcessing(false);
      } catch (e: any) {
        console.error('Export error:', e);
        setFeedback({ type: 'error', msg: e.message || 'Lỗi xuất kho' });
        setIsProcessing(false);
      }
    }
  };

  const handleImport = async () => {
    if (!scannedProduct || isProcessing) return;

    // Require customer name
    if (!customerName.trim()) {
      setFeedback({ type: 'error', msg: 'Vui lòng nhập tên khách hàng / nguồn nhập' });
      return;
    }

    setIsProcessing(true);

    // Create new customer if name entered but not found
    let finalCustomerName = customerName.trim();
    if (finalCustomerName && !db.customers.some(c => c.name === finalCustomerName)) {
      try {
        await db.addCustomer({ name: finalCustomerName, phone: '' });
        await refreshApp();
      } catch (e) {
        console.error('Error creating customer:', e);
      }
    }

    // Build note with customer name
    const noteWithCustomer = finalCustomerName
      ? `${finalCustomerName}${note ? ' - ' + note : ''}`
      : note;

    // For serialized products, use selected serials
    if (scannedProduct.isSerialized) {
      if (selectedSerialIds.length === 0) {
        setFeedback({ type: 'error', msg: 'Vui lòng chọn serial để nhập lại' });
        setIsProcessing(false);
        return;
      }

      try {
        console.log('Importing serials:', selectedSerialIds);

        // Update each selected serial to AVAILABLE (ready to use again)
        for (const serialId of selectedSerialIds) {
          await supabase
            .from('device_serials')
            .update({
              status: 'AVAILABLE',
              order_id: null // Clear order reference
            })
            .eq('id', serialId);
        }

        // Update stock count
        const importQty = selectedSerialIds.length;
        if (selectedOrderId) {
          await db.importStock(selectedOrderId, scannedProduct.id, importQty, noteWithCustomer || t('import_stock'));
        } else {
          const newStock = scannedProduct.currentPhysicalStock + importQty;
          await db.updateProductStock(scannedProduct.id, newStock, 'IMPORT', importQty, noteWithCustomer || t('import_stock'));
        }

        await refreshApp();

        // Reset immediately
        setScannedProduct(null);
        setQuantity(1);
        setNote('');
        setCustomerName('');
        setSelectedOrderId(null);
        setSelectedSerialIds([]);
        setIsProcessing(false);
      } catch (e: any) {
        console.error('Import error:', e);
        setFeedback({ type: 'error', msg: e.message || 'Lỗi nhập kho' });
        setIsProcessing(false);
      }
    } else {
      // Non-serialized product: use quantity
      if (quantity <= 0) { setIsProcessing(false); return; }

      try {
        console.log('Importing:', scannedProduct.id, quantity, selectedOrderId);

        if (selectedOrderId) {
          await db.importStock(selectedOrderId, scannedProduct.id, quantity, noteWithCustomer || t('import_stock'));
        } else {
          const newStock = scannedProduct.currentPhysicalStock + quantity;
          console.log('Updating stock to:', newStock);
          await db.updateProductStock(scannedProduct.id, newStock, 'IMPORT', quantity, noteWithCustomer || t('import_stock'));
        }

        await refreshApp();

        // Reset immediately
        setScannedProduct(null);
        setQuantity(1);
        setNote('');
        setCustomerName('');
        setSelectedOrderId(null);
        setIsProcessing(false);
      } catch (e: any) {
        console.error('Import error:', e);
        setFeedback({ type: 'error', msg: e.message || 'Lỗi nhập kho' });
        setIsProcessing(false);
      }
    }
  };

  // Switch mode for serialized products (export loads AVAILABLE, import loads ON_RENT)
  const switchToImportMode = () => {
    if (scannedProduct?.isSerialized) {
      loadSerials(scannedProduct.id, 'import');
    }
  };

  const switchToExportMode = () => {
    if (scannedProduct?.isSerialized) {
      loadSerials(scannedProduct.id, 'export');
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
      }, 500);
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
      }, 500);
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
      }, 500);
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
    setTimeout(() => { setScannedSet(null); setFeedback(null); }, 500);
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
    setTimeout(() => { setScannedSet(null); setFeedback(null); }, 500);
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

  // Product Detail View - Simplified & Optimized for Mobile
  if (scannedProduct) {
    const onRent = scannedProduct.totalOwned - scannedProduct.currentPhysicalStock;
    const isLow = scannedProduct.currentPhysicalStock <= 2;
    const isOut = scannedProduct.currentPhysicalStock === 0;
    // For serialized products, can export if serials are selected; for non-serialized, check quantity
    const canExport = scannedProduct.isSerialized
      ? selectedSerialIds.length > 0
      : (quantity <= scannedProduct.currentPhysicalStock && scannedProduct.currentPhysicalStock > 0);

    return createPortal(
      <div className="fixed inset-0 z-[9999] bg-white flex flex-col">
        {/* Compact Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-slate-800 to-slate-900 text-white p-4 safe-area-top">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setScannedProduct(null)}
              className="p-2 bg-white/20 rounded-full hover:bg-white/30 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">{scannedProduct.name}</h1>
              <p className="text-slate-400 text-sm">{scannedProduct.code}</p>
            </div>
            {/* Status Badge */}
            <div className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 ${isOut ? 'bg-red-500' : isLow ? 'bg-orange-500' : 'bg-green-500'}`}>
              {isOut ? t('out_of_stock') : isLow ? t('low_stock') : `${scannedProduct.currentPhysicalStock} ${t('in_stock')}`}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          <div className="p-4 space-y-4">

            {/* Product Image & Stock Info */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="flex">
                <img
                  src={scannedProduct.imageUrl}
                  alt={scannedProduct.name}
                  className="w-24 h-24 object-cover bg-slate-100"
                />
                <div className="flex-1 p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-500 mb-1">{t('current_stock_label')}</p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-3xl font-bold ${isOut ? 'text-red-500' : isLow ? 'text-orange-500' : 'text-green-600'}`}>
                        {scannedProduct.currentPhysicalStock}
                      </span>
                      <span className="text-slate-400 text-lg">/ {scannedProduct.totalOwned}</span>
                    </div>
                  </div>
                  {onRent > 0 && (
                    <div className="text-right">
                      <p className="text-xs text-slate-500 mb-1">{t('on_rent')}</p>
                      <p className="text-2xl font-bold text-blue-600">{onRent}</p>
                    </div>
                  )}
                </div>
              </div>
              {/* Location */}
              {scannedProduct.location && (
                <div className="px-4 py-3 bg-indigo-50 border-t flex items-center gap-3">
                  <Box className="w-5 h-5 text-indigo-600" />
                  <div>
                    <p className="text-xs text-indigo-500">{t('location') || 'Vị trí'}</p>
                    <p className="font-bold text-indigo-700">{scannedProduct.location}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Serial Picker for serialized products */}
            {scannedProduct.isSerialized ? (
              <div className="bg-white rounded-2xl shadow-sm p-4">
                {/* Mode Toggle */}
                <div className="flex gap-2 mb-4">
                  <button
                    onClick={() => {
                      setSerialMode('export');
                      loadSerials(scannedProduct.id, 'export');
                      setSelectedSerialIds([]);
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${serialMode === 'export'
                      ? 'bg-orange-500 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    <ArrowUpCircle className="w-4 h-4" />
                    {t('serial_export_mode')}
                  </button>
                  <button
                    onClick={() => {
                      setSerialMode('import');
                      loadSerials(scannedProduct.id, 'import');
                      setSelectedSerialIds([]);
                    }}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${serialMode === 'import'
                      ? 'bg-teal-500 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    <ArrowDownCircle className="w-4 h-4" />
                    {t('serial_import_mode')}
                  </button>
                </div>

                {/* Input serial directly */}
                <div className="mb-3">
                  <p className="text-xs text-slate-500 mb-2">
                    {t('serial_input_hint')} ({availableSerials.length} {serialMode === 'export' ? t('serial_ready') : t('serial_on_rent')})
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={serialSearchTerm}
                      onChange={(e) => setSerialSearchTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && serialSearchTerm.trim()) {
                          // Find matching serial and add to selection
                          const found = availableSerials.find(s =>
                            s.serialNumber.toLowerCase() === serialSearchTerm.toLowerCase().trim()
                          );
                          if (found && !selectedSerialIds.includes(found.id)) {
                            setSelectedSerialIds([...selectedSerialIds, found.id]);
                            setSerialSearchTerm('');
                          }
                        }
                      }}
                      placeholder={t('serial_input_placeholder')}
                      className="flex-1 px-4 py-3 bg-slate-50 border-2 rounded-xl text-sm font-mono outline-none focus:border-indigo-500"
                    />
                    <button
                      onClick={() => {
                        const found = availableSerials.find(s =>
                          s.serialNumber.toLowerCase() === serialSearchTerm.toLowerCase().trim()
                        );
                        if (found && !selectedSerialIds.includes(found.id)) {
                          setSelectedSerialIds([...selectedSerialIds, found.id]);
                          setSerialSearchTerm('');
                        }
                      }}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium"
                    >
                      +
                    </button>
                  </div>
                  {/* Autocomplete suggestions */}
                  {serialSearchTerm.trim() && (
                    <div className="mt-2 max-h-32 overflow-y-auto bg-slate-50 rounded-xl border">
                      {availableSerials
                        .filter(s =>
                          s.serialNumber.toLowerCase().includes(serialSearchTerm.toLowerCase()) &&
                          !selectedSerialIds.includes(s.id)
                        )
                        .slice(0, 5)
                        .map(serial => (
                          <button
                            key={serial.id}
                            onClick={() => {
                              setSelectedSerialIds([...selectedSerialIds, serial.id]);
                              setSerialSearchTerm('');
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-indigo-50 text-sm font-mono flex items-center justify-between"
                          >
                            <span>{serial.serialNumber}</span>
                            {serial.orderId && <span className="text-xs text-blue-500">#{serial.orderId}</span>}
                          </button>
                        ))}
                      {availableSerials.filter(s =>
                        s.serialNumber.toLowerCase().includes(serialSearchTerm.toLowerCase()) &&
                        !selectedSerialIds.includes(s.id)
                      ).length === 0 && (
                          <p className="px-4 py-2 text-sm text-slate-400">{t('serial_not_found')}</p>
                        )}
                    </div>
                  )}
                </div>

                {/* Selected serials as chips */}
                {selectedSerialIds.length > 0 && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-slate-500">{t('serial_selected')} ({selectedSerialIds.length})</span>
                      <button onClick={clearSerialSelection} className="text-xs text-red-500 hover:underline">
                        {t('serial_clear_all')}
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedSerialIds.map(id => {
                        const serial = availableSerials.find(s => s.id === id);
                        return serial ? (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-mono"
                          >
                            {serial.serialNumber}
                            <button
                              onClick={() => setSelectedSerialIds(selectedSerialIds.filter(i => i !== id))}
                              className="ml-1 hover:text-red-500"
                            >
                              ×
                            </button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {/* Quick actions */}
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={selectAllSerials}
                    className="flex-1 py-2 bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200"
                  >
                    {t('serial_select_all')} ({availableSerials.length})
                  </button>
                </div>
              </div>
            ) : (
              /* Quantity Selector for non-serialized products */
              <div className="bg-white rounded-2xl shadow-sm p-4">
                <label className="text-sm font-medium text-slate-600 mb-3 block text-center">{t('quantity')}</label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all"
                  >
                    <Minus className="w-8 h-8 text-slate-600" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    className="w-24 text-center text-4xl font-bold py-3 border-2 border-slate-200 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 outline-none transition-all"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                    min={1}
                  />
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center hover:bg-slate-200 active:scale-95 transition-all"
                  >
                    <Plus className="w-8 h-8 text-slate-600" />
                  </button>
                </div>
                {/* Quick quantity buttons */}
                <div className="flex gap-2 mt-4">
                  {[1, 5, 10, 20].map(n => (
                    <button
                      key={n}
                      onClick={() => setQuantity(n)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${quantity === n ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Optional: Order Link (Collapsible) */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <button
                onClick={() => setShowOrderSelect(!showOrderSelect)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-5 h-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-700">{t('link_to_order')}</p>
                    <p className="text-xs text-slate-400">
                      {selectedOrderId
                        ? `#${selectedOrderId} - ${db.customers.find(c => c.id === db.orders.find(o => o.id === selectedOrderId)?.customerId)?.name}`
                        : t('no_order_link')
                      }
                    </p>
                  </div>
                </div>
                <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${showOrderSelect ? 'rotate-180' : ''}`} />
              </button>

              {showOrderSelect && (
                <div className="border-t max-h-40 overflow-y-auto">
                  <button
                    onClick={() => { setSelectedOrderId(null); setShowOrderSelect(false); }}
                    className="w-full p-3 text-left hover:bg-slate-50 text-slate-500 text-sm"
                  >
                    {t('no_link')}
                  </button>
                  {activeOrders.map(o => {
                    const customer = db.customers.find(c => c.id === o.customerId);
                    return (
                      <button
                        key={o.id}
                        onClick={() => { setSelectedOrderId(o.id); setShowOrderSelect(false); }}
                        className="w-full p-3 text-left hover:bg-blue-50 flex items-center justify-between text-sm"
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

            {/* Customer Name Input with Auto-suggest */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <label className="text-sm font-medium text-slate-700 mb-2 block flex items-center gap-2">
                <User className="w-4 h-4" />
                {t('customer_name') || 'Tên khách hàng'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    setShowCustomerSuggestions(true);
                  }}
                  onFocus={() => setShowCustomerSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCustomerSuggestions(false), 200)}
                  placeholder="Nhập tên khách hàng..."
                  className="w-full p-3 bg-slate-50 border-2 border-transparent rounded-xl focus:border-blue-500 focus:bg-white outline-none transition-all text-sm"
                />
                {showCustomerSuggestions && customerSuggestions.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white rounded-xl shadow-lg border max-h-40 overflow-y-auto">
                    {customerSuggestions.map(c => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setCustomerName(c.name);
                          setShowCustomerSuggestions(false);
                        }}
                        className="w-full p-3 text-left hover:bg-blue-50 text-sm flex items-center gap-2"
                      >
                        <User className="w-4 h-4 text-slate-400" />
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {customerName && !customerSuggestions.some(c => c.name === customerName) && (
                <p className="text-xs text-blue-500 mt-2 flex items-center gap-1">
                  <Plus className="w-3 h-3" />
                  Sẽ tạo khách hàng mới
                </p>
              )}
            </div>

            {/* Note Input */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t('note_placeholder') || 'Ghi chú (tùy chọn)...'}
                className="w-full p-3 bg-slate-50 border-2 border-transparent rounded-xl focus:border-blue-500 focus:bg-white outline-none transition-all text-sm"
              />
            </div>

            {/* Staff Badge */}
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
              <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center">
                <User className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-xs text-blue-500">{t('performed_by')}</p>
                <p className="font-semibold text-blue-800 text-sm">{currentStaff?.name}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Fixed Bottom Actions */}
        <div className="flex-shrink-0 bg-white border-t shadow-lg p-4 pb-[calc(1rem+env(safe-area-inset-bottom)+80px)]">
          {scannedProduct.isSerialized ? (
            /* Single button based on mode for serialized products */
            <button
              onClick={serialMode === 'export' ? handleExport : handleImport}
              disabled={selectedSerialIds.length === 0 || isProcessing}
              className={`w-full py-4 font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all disabled:opacity-40 disabled:shadow-none ${serialMode === 'export'
                ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white shadow-red-500/30 disabled:from-slate-400 disabled:to-slate-500'
                : 'bg-gradient-to-r from-emerald-500 to-green-600 text-white shadow-green-500/30 disabled:from-slate-400 disabled:to-slate-500'
                }`}
            >
              {serialMode === 'export' ? (
                <>
                  <ArrowUpCircle className="w-6 h-6" />
                  <span>{t('serial_export_count').replace('{0}', String(selectedSerialIds.length))}</span>
                </>
              ) : (
                <>
                  <ArrowDownCircle className="w-6 h-6" />
                  <span>{t('serial_import_count').replace('{0}', String(selectedSerialIds.length))}</span>
                </>
              )}
            </button>
          ) : (
            /* Two buttons for non-serialized products */
            <>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleImport}
                  disabled={isProcessing}
                  className="py-4 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-500/30 active:scale-[0.98] transition-all disabled:opacity-40 disabled:shadow-none disabled:from-slate-400 disabled:to-slate-500"
                >
                  <ArrowDownCircle className="w-6 h-6" />
                  <span>{t('import_to_stock')}</span>
                </button>
                <button
                  onClick={handleExport}
                  disabled={!canExport || isProcessing}
                  className="py-4 bg-gradient-to-r from-red-500 to-rose-600 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-red-500/30 active:scale-[0.98] transition-all disabled:opacity-40 disabled:shadow-none disabled:from-slate-400 disabled:to-slate-500"
                >
                  <ArrowUpCircle className="w-6 h-6" />
                  <span>{t('export_from_stock')}</span>
                </button>
              </div>
              {/* Warning if can't export */}
              {!canExport && (
                <p className="text-center text-xs text-red-500 mt-2">
                  {isOut ? t('out_of_stock') : `${t('not_enough_stock')} (${t('available')}: ${scannedProduct.currentPhysicalStock})`}
                </p>
              )}
            </>
          )}
        </div>
      </div>,
      document.body
    );
  }


  // Main Scanner View
  return (
    <div className="bg-slate-50 md:min-h-screen">
      {/* Fixed Top Section on Mobile */}
      <div className="md:relative">
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

        <div className="px-4 -mt-4 pb-4 md:pb-0">
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
          </div>
        </div>
      </div>

      {/* Scrollable Product List - with fixed height on mobile */}
      <div className="px-4 pb-4 md:pb-8">
        <div className="max-w-lg mx-auto">
          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="p-4 bg-slate-50 border-b sticky top-0 z-10">
                <p className="font-medium text-slate-700">{t('select_product_count')} ({searchResults.length})</p>
              </div>
              <div className="divide-y max-h-[40vh] overflow-y-auto">
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
              <div className="p-4 bg-slate-50 border-b sticky top-0 z-10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-slate-500" />
                  <p className="font-medium text-slate-700">{t('equipment_in_stock')}</p>
                </div>
                <span className="text-sm text-slate-400">{db.products.length} {t('products_count')}</span>
              </div>
              <div className="divide-y max-h-[40vh] overflow-y-auto">
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
