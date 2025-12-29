import React, { useState, useMemo, useRef, useEffect } from 'react';
import { db } from '../services/db';
import { supabase } from '../services/supabase';
import { t, i18n } from '../services/i18n';
import { Product } from '../types';
import { Plus, Edit, Trash2, QrCode, X, Save, Image as ImageIcon, History, Search, ArrowUpRight, ArrowDownLeft, LayoutGrid, List as ListIcon, Box, Calendar, Package, Truck, MapPin, FileText, ChevronLeft, ChevronRight, Upload, Link, Tag, RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from './Toast';
import { SerialManager } from './SerialManager';
import { SkeletonProductGrid } from './Skeleton';
import { usePullToRefresh, PullIndicator } from '../hooks/usePullToRefresh';
import { useDebounce } from '../hooks/useDebounce';
import { LazyImage } from './LazyImage';
import { useInfiniteScroll } from '../hooks/useInfiniteScroll';

export const ProductManager: React.FC<{ refreshApp: () => void }> = ({ refreshApp }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'GRID'>('GRID');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [showQRFor, setShowQRFor] = useState<Product | null>(null);
  const [viewHistoryFor, setViewHistoryFor] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewDetailFor, setViewDetailFor] = useState<Product | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [stockFilter, setStockFilter] = useState<'all' | 'available' | 'low' | 'out'>('all');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showSerialFor, setShowSerialFor] = useState<Product | null>(null);
  const [serialCounts, setSerialCounts] = useState<{ total: number, available: number, on_rent: number, dirty: number, broken: number }>({ total: 0, available: 0, on_rent: 0, dirty: 0, broken: 0 });
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(db.products.length === 0);

  // Debounce search term for performance
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Pull-to-refresh
  const handleRefresh = async () => {
    await db.refreshProducts();
    refreshApp();
  };

  const { pullDistance, isRefreshing, handlers: pullHandlers } = usePullToRefresh({
    onRefresh: handleRefresh
  });

  const { success, error } = useToast();
  const isAdmin = db.currentUser?.role === 'admin';

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', code: '', category: '', pricePerDay: 0, totalOwned: 0, imageUrl: '', images: [], location: '', specs: ''
  });
  const [newImageUrl, setNewImageUrl] = useState('');
  const [imageInputMode, setImageInputMode] = useState<'url' | 'upload'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update loading state when products load
  useEffect(() => {
    if (db.products.length > 0) {
      setIsLoading(false);
    }
  }, [db.products.length]);

  // Load serial counts when viewing serialized product
  useEffect(() => {
    if (viewDetailFor?.isSerialized) {
      (async () => {
        const { data, error } = await supabase
          .from('device_serials')
          .select('status')
          .eq('product_id', viewDetailFor.id);
        if (!error && data) {
          const counts = { total: data.length, available: 0, on_rent: 0, dirty: 0, broken: 0 };
          data.forEach(d => {
            if (d.status === 'AVAILABLE') counts.available++;
            else if (d.status === 'ON_RENT') counts.on_rent++;
            else if (d.status === 'DIRTY') counts.dirty++;
            else if (d.status === 'BROKEN') counts.broken++;
          });
          setSerialCounts(counts);
        }
      })();
    }
  }, [viewDetailFor]);

  // Load product images on-demand when viewing details (performance optimization)
  const [productImages, setProductImages] = useState<string[]>([]);
  useEffect(() => {
    if (viewDetailFor) {
      // First use cached imageUrl, then load full images array
      setProductImages(viewDetailFor.imageUrl ? [viewDetailFor.imageUrl] : []);
      // Async load additional images from DB
      db.fetchProductImages(viewDetailFor.id).then(imgs => {
        if (imgs.length > 0) setProductImages(imgs);
      });
    }
  }, [viewDetailFor?.id]);

  const filteredProducts = useMemo(() => {
    return db.products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) || p.code.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;

      let matchesStock = true;
      if (stockFilter === 'available') matchesStock = p.currentPhysicalStock > 2;
      else if (stockFilter === 'low') matchesStock = p.currentPhysicalStock > 0 && p.currentPhysicalStock <= 2;
      else if (stockFilter === 'out') matchesStock = p.currentPhysicalStock === 0;

      return matchesSearch && matchesCategory && matchesStock;
    });
  }, [db.products, debouncedSearchTerm, selectedCategory, stockFilter]);

  // Infinite scroll - load 20 products at a time
  const { visibleItems: visibleProducts, hasMore, loadMore } = useInfiniteScroll<Product>({
    items: filteredProducts,
    pageSize: 20
  });

  const categories = useMemo(() => {
    const cats = new Set(db.products.map(p => p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [db.products]);

  const handleEdit = (product: Product) => {
    if (!isAdmin) { error(t('only_admin_can_edit')); return; }
    setEditingProduct(product); setFormData({ ...product }); setIsModalOpen(true);
  };

  const handleAddNew = () => {
    if (!isAdmin) { error(t('only_admin_can_add')); return; }
    setEditingProduct(null);
    setFormData({ name: '', code: '', category: t('default_category'), pricePerDay: 0, totalOwned: 1, imageUrl: '', images: [], location: '', specs: '', isSerialized: false });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!isAdmin) { error(t('only_admin_can_delete')); return; }
    if (confirm(t('delete_equipment_prompt'))) {
      await db.deleteProduct(id);
      refreshApp();
      success(t('delete_success') || 'Đã xóa thiết bị');
    }
  };

  const handleSave = async () => {
    if (!formData.name || !formData.code) { error(t('enter_name_code')); return; }
    const productToSave: Product = {
      id: editingProduct ? editingProduct.id : 0,
      code: formData.code!,
      name: formData.name!,
      category: formData.category || t('other_category'),
      pricePerDay: Number(formData.pricePerDay),
      totalOwned: Number(formData.totalOwned),
      currentPhysicalStock: editingProduct ? editingProduct.currentPhysicalStock : Number(formData.totalOwned),
      imageUrl: formData.imageUrl || formData.images?.[0] || 'https://via.placeholder.com/150',
      images: formData.images || [],
      location: formData.location || '',
      specs: formData.specs || '',
      isSerialized: formData.isSerialized || false
    };
    await db.saveProduct(productToSave);
    // Close modal immediately for better UX, refresh in background
    setIsModalOpen(false);
    success(editingProduct ? (t('update_success') || 'Cập nhật thành công') : (t('create_success') || 'Tạo mới thành công'));
    // Background refresh - don't await to avoid blocking
    refreshApp();
  };

  const addImage = () => {
    if (newImageUrl.trim()) {
      setFormData({ ...formData, images: [...(formData.images || []), newImageUrl] });
      setNewImageUrl('');
    }
  };

  const removeImage = (idx: number) => {
    setFormData({ ...formData, images: formData.images?.filter((_, i) => i !== idx) });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setFormData(prev => ({ ...prev, images: [...(prev.images || []), base64] }));
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const openHistory = (product: Product) => { setViewHistoryFor(product); setIsHistoryOpen(true); };
  const getProductLogs = (productId: number) => db.logs.filter(l => l.productId === productId && l.actionType !== 'CLEAN').sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const getUpcomingRentals = (productId: number) => {
    const today = new Date().toISOString().split('T')[0];
    return db.orders.filter(o => o.items.some(i => i.productId === productId) && (o.status === 'BOOKED' || o.status === 'ACTIVE') && o.expectedReturnDate >= today)
      .sort((a, b) => new Date(a.rentalStartDate).getTime() - new Date(b.rentalStartDate).getTime());
  };

  // For detail view, use on-demand loaded images; for list view, use basic imageUrl
  const getAllImages = (p: Product) => {
    // If viewing this product, use on-demand loaded images
    if (viewDetailFor?.id === p.id && productImages.length > 0) {
      return productImages;
    }
    // Fallback to imageUrl only (images not loaded in initial fetch for performance)
    return p.imageUrl ? [p.imageUrl] : ['https://via.placeholder.com/400x300?text=No+Image'];
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header - Simple */}
      <div className="px-4 pt-4 pb-4 md:px-8 md:pt-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800">{t('products_title')}</h1>
              <p className="text-slate-500 text-sm mt-1">{t('inventory_desc')}</p>
            </div>
            {isAdmin && (
              <button
                onClick={handleAddNew}
                className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5" /> {t('add_equipment_btn')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 md:px-8 pb-24 md:pb-8">
        <div className="max-w-7xl mx-auto space-y-4">

          {/* Search & Filter */}
          <div className="bg-white rounded-2xl shadow-sm border p-4 sticky top-0 z-20">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={t('search_equipment')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2.5 bg-slate-50 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 outline-none cursor-pointer"
              >
                <option value="ALL">{t('all_categories')}</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              {/* View Mode Toggle - Desktop only */}
              <div className="hidden md:flex gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode('GRID')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <LayoutGrid className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('LIST')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-white shadow text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <ListIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Stock Filter Pills */}
            <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
              <FilterPill active={stockFilter === 'all'} onClick={() => setStockFilter('all')} label={t('filter_all')} count={db.products.length} />
              <FilterPill active={stockFilter === 'available'} onClick={() => setStockFilter('available')} label={t('filter_available')} color="green" />
              <FilterPill active={stockFilter === 'low'} onClick={() => setStockFilter('low')} label={t('filter_low')} color="orange" />
              <FilterPill active={stockFilter === 'out'} onClick={() => setStockFilter('out')} label={t('filter_out')} color="red" />
            </div>
          </div>

          {/* Pull-to-refresh indicator */}
          <PullIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />

          {/* Product Grid with pull-to-refresh */}
          <div {...pullHandlers}>
            {isLoading ? (
              /* Skeleton loading */
              <SkeletonProductGrid count={8} />
            ) : filteredProducts.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center">
                <Box className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">{t('no_equipment_found')}</p>
              </div>
            ) : viewMode === 'GRID' || window.innerWidth < 768 ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                  {visibleProducts.map(p => (
                    <ProductCard
                      key={p.id}
                      product={p}
                      onView={() => { setViewDetailFor(p); setCurrentImageIndex(0); }}
                      onEdit={() => handleEdit(p)}
                      onDelete={() => handleDelete(p.id)}
                      onQR={() => setShowQRFor(p)}
                      onHistory={() => openHistory(p)}
                      onSerial={() => setShowSerialFor(p)}
                      isAdmin={isAdmin}
                    />
                  ))}
                </div>
                {/* Load More Button */}
                {hasMore && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={loadMore}
                      className="px-6 py-3 bg-white border-2 border-indigo-500 text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-all flex items-center gap-2"
                    >
                      <Loader2 className="w-4 h-4" />
                      {t('load_more') || 'Tải thêm'} ({visibleProducts.length}/{filteredProducts.length})
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 text-slate-500 text-xs font-bold uppercase">
                    <tr>
                      <th className="p-4">{t('product')}</th>
                      <th className="p-4">{t('category')}</th>
                      <th className="p-4">{t('location')}</th>
                      <th className="p-4 text-center">{t('in_stock')}</th>
                      <th className="p-4 text-center">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visibleProducts.map(p => {
                      const isLow = p.currentPhysicalStock > 0 && p.currentPhysicalStock <= 2;
                      const isOut = p.currentPhysicalStock === 0;
                      const stockPercent = (p.currentPhysicalStock / p.totalOwned) * 100;

                      return (
                        <tr key={p.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setViewDetailFor(p); setCurrentImageIndex(0); }}>
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <LazyImage src={p.imageUrl || ''} alt="" className="w-12 h-12 rounded-xl bg-slate-100" />
                              <div>
                                <p className="font-semibold text-slate-800">{p.name}</p>
                                <p className="text-xs text-slate-400 font-mono">{p.code}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-sm text-slate-600">{p.category}</td>
                          <td className="p-4 text-sm text-slate-600">{p.location || '-'}</td>
                          <td className="p-4">
                            <div className="max-w-[100px] mx-auto">
                              <div className="flex justify-between text-xs font-bold mb-1">
                                <span className={isOut ? 'text-red-500' : isLow ? 'text-orange-500' : 'text-green-600'}>{p.currentPhysicalStock}</span>
                                <span className="text-slate-400">/ {p.totalOwned}</span>
                              </div>
                              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full ${isOut ? 'bg-red-500' : isLow ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${stockPercent}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="p-4" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-center gap-1">
                              <IconBtn onClick={() => openHistory(p)} icon={<History className="w-4 h-4" />} />
                              <IconBtn onClick={() => setShowQRFor(p)} icon={<QrCode className="w-4 h-4" />} />
                              <IconBtn onClick={() => setShowSerialFor(p)} icon={<Tag className="w-4 h-4 text-purple-500" />} />
                              {isAdmin && <IconBtn onClick={() => handleEdit(p)} icon={<Edit className="w-4 h-4" />} />}
                              {isAdmin && <IconBtn onClick={() => handleDelete(p.id)} icon={<Trash2 className="w-4 h-4 text-red-500" />} />}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Load More for Table */}
                {hasMore && (
                  <div className="p-4 bg-slate-50 text-center">
                    <button
                      onClick={loadMore}
                      className="px-4 py-2 text-indigo-600 font-medium hover:underline"
                    >
                      {t('load_more') || 'Tải thêm'} ({visibleProducts.length}/{filteredProducts.length})
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {filteredProducts.length > 0 && (
            <p className="text-center text-xs text-slate-400">
              {t('showing_count')?.replace('{0}', String(visibleProducts.length)).replace('{1}', String(filteredProducts.length))}
            </p>
          )}
        </div>
      </div>

      {/* PRODUCT DETAIL MODAL */}
      {viewDetailFor && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white w-full h-[90vh] md:h-auto md:max-h-[90vh] md:max-w-2xl md:mx-4 md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            {/* Compact Header with Image */}
            <div className="p-4 border-b shrink-0">
              <div className="flex gap-4">
                {/* Small Image */}
                <div
                  className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0 cursor-zoom-in relative"
                  onClick={() => setLightboxImage(getAllImages(viewDetailFor)[currentImageIndex])}
                >
                  <img
                    src={getAllImages(viewDetailFor)[currentImageIndex]}
                    alt={viewDetailFor.name}
                    className="w-full h-full object-cover"
                  />
                  {getAllImages(viewDetailFor).length > 1 && (
                    <div className="absolute bottom-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded-md">
                      {currentImageIndex + 1}/{getAllImages(viewDetailFor).length}
                    </div>
                  )}
                </div>

                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <span className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-mono font-bold mb-1">{viewDetailFor.code}</span>
                      <h2 className="text-lg font-bold text-slate-800 truncate">{viewDetailFor.name}</h2>
                      <p className="text-slate-500 text-sm">{viewDetailFor.category}</p>
                    </div>
                    <button onClick={() => setViewDetailFor(null)} className="p-2 hover:bg-slate-100 rounded-full">
                      <X className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>
                  {viewDetailFor.location && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <MapPin className="w-3.5 h-3.5 text-blue-500" />
                      <span className="text-xs font-medium text-blue-600">{viewDetailFor.location}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Image thumbnails if multiple */}
              {getAllImages(viewDetailFor).length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {getAllImages(viewDetailFor).map((img, i) => (
                    <div
                      key={i}
                      onClick={() => setCurrentImageIndex(i)}
                      className={`w-12 h-12 rounded-lg cursor-pointer overflow-hidden shrink-0 border-2 ${i === currentImageIndex ? 'border-indigo-500' : 'border-transparent'}`}
                    >
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 overflow-y-auto flex-1">

              {/* Stats */}
              {viewDetailFor.isSerialized ? (
                /* Serial-based stats */
                <div className="grid grid-cols-4 gap-2 mb-5">
                  <div className="bg-indigo-50 p-2 rounded-xl text-center">
                    <p className="text-lg font-bold text-indigo-600">{serialCounts.total}</p>
                    <p className="text-[10px] text-indigo-500 uppercase font-bold">{t('stat_total')}</p>
                  </div>
                  <div className="bg-green-50 p-2 rounded-xl text-center">
                    <p className="text-lg font-bold text-green-600">{serialCounts.available}</p>
                    <p className="text-[10px] text-green-500 uppercase font-bold">{t('status_available')}</p>
                  </div>
                  <div className="bg-orange-50 p-2 rounded-xl text-center">
                    <p className="text-lg font-bold text-orange-600">{serialCounts.on_rent}</p>
                    <p className="text-[10px] text-orange-500 uppercase font-bold">{t('status_on_rent')}</p>
                  </div>
                  <div className="bg-yellow-50 p-2 rounded-xl text-center">
                    <p className="text-lg font-bold text-yellow-600">{serialCounts.dirty + serialCounts.broken}</p>
                    <p className="text-[10px] text-yellow-600 uppercase font-bold">{t('status_dirty')}</p>
                  </div>
                </div>
              ) : (
                /* Quantity-based stats */
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-indigo-50 p-3 rounded-xl text-center">
                    <Package className="w-5 h-5 text-indigo-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-indigo-600">{viewDetailFor.totalOwned}</p>
                    <p className="text-[10px] text-indigo-500 uppercase font-bold">{t('total_owned_label')}</p>
                  </div>
                  <div className="bg-green-50 p-3 rounded-xl text-center">
                    <Box className="w-5 h-5 text-green-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-green-600">{viewDetailFor.currentPhysicalStock}</p>
                    <p className="text-[10px] text-green-500 uppercase font-bold">{t('at_warehouse')}</p>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-xl text-center">
                    <Truck className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                    <p className="text-xl font-bold text-orange-600">{Math.max(0, viewDetailFor.totalOwned - viewDetailFor.currentPhysicalStock)}</p>
                    <p className="text-[10px] text-orange-500 uppercase font-bold">{t('renting')}</p>
                  </div>
                </div>
              )}

              {/* Specs */}
              {viewDetailFor.specs && (
                <div className="mb-5">
                  <h3 className="font-bold text-slate-700 mb-2 text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4" /> {t('specs')}
                  </h3>
                  <div className="bg-slate-50 p-3 rounded-lg">
                    <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans">{viewDetailFor.specs}</pre>
                  </div>
                </div>
              )}

              {/* Upcoming Rentals */}
              <div className="mb-5">
                <h3 className="font-bold text-slate-700 mb-2 text-sm flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> {t('upcoming_rentals')}
                </h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {getUpcomingRentals(viewDetailFor.id).length === 0 ? (
                    <p className="text-slate-400 text-sm py-3 text-center bg-slate-50 rounded-lg">{t('no_rentals')}</p>
                  ) : getUpcomingRentals(viewDetailFor.id).slice(0, 3).map(order => {
                    const item = order.items.find(i => i.productId === viewDetailFor.id);
                    const customer = db.customers.find(c => c.id === order.customerId);
                    return (
                      <div key={order.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg">
                        <div>
                          <span className="font-medium text-slate-800 text-sm">{customer?.name}</span>
                          <p className="text-xs text-slate-500">{new Date(order.rentalStartDate).toLocaleDateString(i18n.getLanguage() === 'vi' ? 'vi-VN' : 'ja-JP')}</p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-slate-700">x{item?.quantity}</span>
                          <p className={`text-xs font-bold ${order.status === 'ACTIVE' ? 'text-green-600' : 'text-orange-500'}`}>{order.status}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Activity */}
              <div>
                <h3 className="font-bold text-slate-700 mb-2 text-sm flex items-center gap-2">
                  <History className="w-4 h-4" /> {t('recent_activity')}
                </h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {getProductLogs(viewDetailFor.id).length === 0 ? (
                    <p className="text-slate-400 text-sm py-3 text-center bg-slate-50 rounded-lg">{t('no_activity')}</p>
                  ) : getProductLogs(viewDetailFor.id).slice(0, 5).map(log => (
                    <div
                      key={log.id}
                      className="p-2.5 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                      onClick={() => setSelectedLog(log)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`p-1.5 rounded-lg ${log.actionType === 'EXPORT' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                            {log.actionType === 'EXPORT' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                          </span>
                          <div>
                            <span className="font-medium text-slate-800 text-sm">{log.actionType === 'EXPORT' ? t('export_stock') : t('import_stock')}</span>
                            <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleDateString(i18n.getLanguage() === 'vi' ? 'vi-VN' : 'ja-JP')}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700">x{log.quantity}</span>
                          <ChevronRight className="w-4 h-4 text-slate-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="p-4 border-t bg-slate-50 flex gap-2 shrink-0">
              <button onClick={() => { setViewDetailFor(null); openHistory(viewDetailFor); }} className="flex-1 py-2.5 border rounded-xl font-medium hover:bg-white flex items-center justify-center gap-2 text-sm">
                <History className="w-4 h-4" /> {t('view_history')}
              </button>
              {isAdmin && (
                <>
                  <button onClick={() => { setViewDetailFor(null); handleEdit(viewDetailFor); }} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 text-sm">
                    <Edit className="w-4 h-4" /> {t('edit')}
                  </button>
                  <button onClick={() => { if (confirm(t('delete_equipment_prompt'))) { handleDelete(viewDetailFor.id); setViewDetailFor(null); } }} className="py-2.5 px-4 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT/CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white w-full h-[90vh] md:h-auto md:max-h-[90vh] md:max-w-xl md:mx-4 md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-bold text-lg text-slate-800">{editingProduct ? t('edit_product') : t('add_new_product')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300">
                <X className="w-4 h-4 text-slate-600" />
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('sku_code')}</label>
                  <input type="text" className="w-full border p-2.5 rounded-xl uppercase font-mono bg-slate-50 focus:bg-white outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="GHE-HP01" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('category')}</label>
                  <input type="text" className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="Âm thanh" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('equipment_name')}</label>
                <input type="text" className="w-full border p-2.5 rounded-xl outline-none font-medium focus:ring-2 focus:ring-indigo-500/20" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ghế Tiffany Vàng" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('total_assets')}</label>
                <input type="number" inputMode="numeric" pattern="[0-9]*" className="w-full border p-2.5 rounded-xl font-bold text-indigo-600 bg-indigo-50 outline-none focus:ring-2 focus:ring-indigo-500/20" value={formData.totalOwned} onChange={e => setFormData({ ...formData, totalOwned: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1"><MapPin className="w-3 h-3 inline" /> {t('location')}</label>
                <input type="text" className="w-full border p-2.5 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500/20 font-mono" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value.toUpperCase() })} placeholder="A-K01-T2-O3" />
                <p className="text-[10px] text-slate-400 mt-1">{t('location_format_hint')}</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1"><FileText className="w-3 h-3 inline" /> {t('specs')}</label>
                <textarea className="w-full border p-2.5 rounded-xl outline-none text-sm focus:ring-2 focus:ring-indigo-500/20" rows={3} value={formData.specs} onChange={e => setFormData({ ...formData, specs: e.target.value })} placeholder={t('specs_placeholder')} />
              </div>

              {/* Serial Tracking Toggle */}
              <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl">
                <div>
                  <p className="font-medium text-slate-800">{t('serial_management')}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{t('serial_management_desc')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, isSerialized: !formData.isSerialized })}
                  className={`relative w-14 h-8 rounded-full transition-colors ${formData.isSerialized ? 'bg-indigo-600' : 'bg-slate-300'}`}
                >
                  <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow transition-transform ${formData.isSerialized ? 'translate-x-6' : ''}`} />
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1"><ImageIcon className="w-3 h-3 inline" /> {t('images')}</label>
                <div className="flex gap-2 mb-2">
                  <button type="button" onClick={() => setImageInputMode('upload')} className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${imageInputMode === 'upload' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Upload className="w-4 h-4" /> {t('upload_image')}
                  </button>
                  <button type="button" onClick={() => setImageInputMode('url')} className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${imageInputMode === 'url' ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <Link className="w-4 h-4" /> {t('url_image')}
                  </button>
                </div>
                {imageInputMode === 'upload' && (
                  <div className="mb-2">
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full border-2 border-dashed border-slate-300 rounded-xl p-4 text-center hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">{t('click_to_upload')}</p>
                      <p className="text-xs text-slate-400 mt-1">{t('supported_formats')}</p>
                    </button>
                  </div>
                )}
                {imageInputMode === 'url' && (
                  <div className="flex gap-2 mb-2">
                    <input type="text" className="flex-1 border p-2 rounded-xl text-sm outline-none" value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} placeholder={t('paste_url')} />
                    <button type="button" onClick={addImage} className="px-4 py-2 bg-indigo-500 text-white rounded-xl text-sm font-medium hover:bg-indigo-600">{t('add')}</button>
                  </div>
                )}
                {(formData.images?.length || 0) > 0 && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    {formData.images?.map((img, i) => (
                      <div key={i} className="relative group">
                        <img src={img} className="w-16 h-16 object-cover rounded-xl border" />
                        <button type="button" onClick={() => removeImage(i)} className="absolute -top-2 -right-2 bg-red-500 text-white w-5 h-5 rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                      </div>
                    ))}
                  </div>
                )}
                {(formData.images?.length || 0) > 0 && (
                  <p className="text-xs text-slate-400 mt-1">{formData.images?.length} {t('images_added')}</p>
                )}
              </div>
            </div>
            <div className="p-4 pb-[calc(1rem+env(safe-area-inset-bottom)+70px)] md:pb-4 border-t bg-slate-50 flex justify-end gap-3 shrink-0">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-xl">{t('cancel')}</button>
              <button onClick={handleSave} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700 flex items-center gap-2">
                <Save className="w-4 h-4" /> {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR CODE MODAL */}
      {showQRFor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white p-6 rounded-2xl shadow-2xl flex flex-col items-center max-w-sm w-full relative">
            <button onClick={() => setShowQRFor(null)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200">
              <X className="w-5 h-5 text-slate-500" />
            </button>
            <div className="mb-4 text-center">
              <h3 className="text-xl font-bold text-slate-800 mb-1">{showQRFor.name}</h3>
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-mono font-bold text-sm">{showQRFor.code}</span>
            </div>
            <div className="p-3 bg-white border-4 border-slate-900 rounded-2xl mb-4">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${showQRFor.code}`} alt={showQRFor.code} className="w-48 h-48 object-contain" />
            </div>
            <button onClick={() => window.print()} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 flex items-center justify-center gap-2">
              <QrCode className="w-5 h-5" /> {t('print_qr')}
            </button>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL */}
      {lightboxImage && (
        <div
          className="fixed inset-0 bg-black/95 flex items-center justify-center z-[60] cursor-zoom-out"
          onClick={() => setLightboxImage(null)}
        >
          <button
            onClick={() => setLightboxImage(null)}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>
          <img
            src={lightboxImage}
            alt="Full size"
            className="max-w-[95vw] max-h-[95vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {viewDetailFor && getAllImages(viewDetailFor).length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const imgs = getAllImages(viewDetailFor);
                  const currentIdx = imgs.indexOf(lightboxImage);
                  const newIdx = currentIdx > 0 ? currentIdx - 1 : imgs.length - 1;
                  setLightboxImage(imgs[newIdx]);
                  setCurrentImageIndex(newIdx);
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
              >
                <ChevronLeft className="w-6 h-6 text-white" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const imgs = getAllImages(viewDetailFor);
                  const currentIdx = imgs.indexOf(lightboxImage);
                  const newIdx = currentIdx < imgs.length - 1 ? currentIdx + 1 : 0;
                  setLightboxImage(imgs[newIdx]);
                  setCurrentImageIndex(newIdx);
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors"
              >
                <ChevronRight className="w-6 h-6 text-white" />
              </button>
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {getAllImages(viewDetailFor).map((img, i) => (
                  <div
                    key={i}
                    onClick={(e) => {
                      e.stopPropagation();
                      setLightboxImage(img);
                      setCurrentImageIndex(i);
                    }}
                    className={`w-12 h-12 rounded-lg cursor-pointer overflow-hidden border-2 ${img === lightboxImage ? 'border-white shadow-lg' : 'border-white/30'}`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* HISTORY MODAL */}
      {isHistoryOpen && viewHistoryFor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[80vh]">
            <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl shrink-0">
              <div>
                <h3 className="font-bold text-lg text-slate-800">{t('history_title')}</h3>
                <p className="text-sm text-slate-500">{viewHistoryFor.name} — <span className="font-mono">{viewHistoryFor.code}</span></p>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="bg-white p-2 rounded-full border hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0">
                  <tr>
                    <th className="p-3">{t('time')}</th>
                    <th className="p-3">{t('type')}</th>
                    <th className="p-3 text-right">{t('qty')}</th>
                    <th className="p-3">顧客</th>
                    <th className="p-3">担当者</th>
                    <th className="p-3">{t('note')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {getProductLogs(viewHistoryFor.id).length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-slate-400">{t('no_transactions')}</td></tr>
                  ) : getProductLogs(viewHistoryFor.id).map(log => {
                    // Extract customer name from note (format: "CustomerName - optional note")
                    const noteParts = log.note?.split(' - ') || [];
                    const customerName = noteParts.length > 0 ? noteParts[0] : '-';
                    const noteText = noteParts.length > 1 ? noteParts.slice(1).join(' - ') : (noteParts.length === 1 ? '' : '-');
                    return (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-600">{new Date(log.timestamp).toLocaleDateString(i18n.getLanguage() === 'vi' ? 'vi-VN' : 'ja-JP')}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold ${log.actionType === 'EXPORT' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'}`}>
                            {log.actionType === 'EXPORT' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                            {log.actionType === 'EXPORT' ? t('export') : t('import')}
                          </span>
                        </td>
                        <td className="p-3 text-right font-bold">{log.quantity}</td>
                        <td className="p-3 text-blue-600 font-medium">{customerName}</td>
                        <td className="p-3 text-slate-600">{log.staffName || '-'}</td>
                        <td className="p-3 text-slate-500 truncate max-w-[100px]">{noteText || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SERIAL MANAGER MODAL */}
      {showSerialFor && (
        <SerialManager
          product={showSerialFor}
          onClose={() => setShowSerialFor(null)}
          refreshApp={refreshApp}
        />
      )}

      {/* LOG DETAIL MODAL - Clean Design */}
      {selectedLog && (() => {
        const product = db.products.find(p => p.id === selectedLog.productId);
        // Extract customer name from note (format: "CustomerName - optional note")
        const noteParts = selectedLog.note?.split(' - ') || [];
        const customerName = noteParts.length > 0 ? noteParts[0] : null;
        const noteText = noteParts.length > 1 ? noteParts.slice(1).join(' - ') : selectedLog.note;

        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4" onClick={() => setSelectedLog(null)}>
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
              {/* Header - Action Type */}
              <div className={`p-4 text-white flex items-center justify-between ${selectedLog.actionType === 'EXPORT' ? 'bg-gradient-to-r from-orange-500 to-red-500' : selectedLog.actionType === 'IMPORT' ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                    {selectedLog.actionType === 'EXPORT' ? <ArrowUpRight className="w-5 h-5" /> : selectedLog.actionType === 'IMPORT' ? <ArrowDownLeft className="w-5 h-5" /> : <RefreshCw className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">
                      {selectedLog.actionType === 'EXPORT' ? t('export_stock') : selectedLog.actionType === 'IMPORT' ? t('import_stock') : t('cleaning')}
                    </h3>
                    <p className="text-white/80 text-xs">
                      {new Date(selectedLog.timestamp).toLocaleString(i18n.getLanguage() === 'vi' ? 'vi-VN' : 'ja-JP')}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedLog(null)} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 space-y-3">
                {/* Product Info - Top */}
                {product && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    {product.imageUrl && <img src={product.imageUrl} className="w-12 h-12 object-cover rounded-xl bg-white shadow-sm" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-800 truncate">{product.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{product.code}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-slate-800">×{selectedLog.quantity}</p>
                    </div>
                  </div>
                )}

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {selectedLog.staffName && (
                    <div className="p-3 bg-slate-50 rounded-xl">
                      <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">{t('staff_label') || 'Nhân viên'}</p>
                      <p className="text-sm font-medium text-slate-700 truncate">{selectedLog.staffName}</p>
                    </div>
                  )}
                  {customerName && (
                    <div className="p-3 bg-amber-50 rounded-xl">
                      <p className="text-[10px] text-amber-600 uppercase font-bold mb-0.5">{t('customer_name') || 'Khách hàng'}</p>
                      <p className="text-sm font-medium text-amber-800 truncate">{customerName}</p>
                    </div>
                  )}
                </div>

                {/* Note */}
                {noteText && noteText !== customerName && (
                  <div className="p-3 bg-slate-50 rounded-xl">
                    <p className="text-[10px] text-slate-400 uppercase font-bold mb-0.5">{t('note_label')}</p>
                    <p className="text-sm text-slate-600">{noteText}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// Components
const FilterPill = ({ active, onClick, label, count, color }: {
  active: boolean; onClick: () => void; label: string; count?: number; color?: 'green' | 'orange' | 'red';
}) => {
  const dotColors = { green: 'bg-green-500', orange: 'bg-orange-500', red: 'bg-red-500' };
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${active ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border hover:bg-slate-50'}`}>
      {color && <span className={`w-2 h-2 rounded-full ${active ? 'bg-white' : dotColors[color]}`} />}
      {label}
      {count !== undefined && <span className={`text-xs ${active ? 'text-indigo-200' : 'text-slate-400'}`}>({count})</span>}
    </button>
  );
};

const ProductCard: React.FC<{
  product: Product; onView: () => void; onEdit: () => void; onDelete: () => void; onQR: () => void; onHistory: () => void; onSerial: () => void; isAdmin: boolean;
}> = ({ product: p, onView, onEdit, onDelete, onQR, onHistory, onSerial, isAdmin }) => {
  const isLow = p.currentPhysicalStock > 0 && p.currentPhysicalStock <= 2;
  const isOut = p.currentPhysicalStock === 0;
  const stockPercent = (p.currentPhysicalStock / p.totalOwned) * 100;
  const onRent = p.totalOwned - p.currentPhysicalStock;

  return (
    <div onClick={onView} className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all overflow-hidden border group cursor-pointer">
      <div className="relative h-28 bg-slate-100 overflow-hidden">
        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-0.5 rounded-lg text-xs font-mono font-bold">{p.code}</div>
        {(isOut || isLow) && (
          <div className={`absolute top-2 left-2 px-2 py-0.5 rounded-lg text-xs font-bold text-white ${isOut ? 'bg-red-500' : 'bg-orange-500'}`}>
            {isOut ? t('out_of_stock') : t('low_stock')}
          </div>
        )}
        {p.location && (
          <div className="absolute bottom-2 right-2 bg-indigo-500/90 text-white px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-0.5">
            <MapPin className="w-2.5 h-2.5" /> {p.location}
          </div>
        )}
      </div>
      <div className="p-2.5">
        <h3 className="font-semibold text-slate-800 text-sm leading-tight mb-0.5 truncate">{p.name}</h3>
        <p className="text-[10px] text-slate-400 mb-2 truncate">{p.category}</p>

        {/* Compact Stock Stats */}
        <div className="flex items-center gap-1.5 mb-2">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isOut ? 'bg-red-100 text-red-600' : isLow ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
            {p.currentPhysicalStock}/{p.totalOwned}
          </span>
          {onRent > 0 && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600">
              🚚{onRent}
            </span>
          )}
        </div>

        {/* Stock Bar */}
        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full ${isOut ? 'bg-red-500' : isLow ? 'bg-orange-500' : 'bg-green-500'}`} style={{ width: `${stockPercent}%` }} />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end pt-2 mt-2 border-t gap-0.5" onClick={e => e.stopPropagation()}>
          {/* Desktop: Show all buttons */}
          <div className="hidden md:flex gap-0.5">
            <IconBtn onClick={onHistory} icon={<History className="w-3.5 h-3.5" />} />
            <IconBtn onClick={onSerial} icon={<Tag className="w-3.5 h-3.5 text-purple-500" />} />
            <IconBtn onClick={onQR} icon={<QrCode className="w-3.5 h-3.5" />} />
            {isAdmin && <IconBtn onClick={onEdit} icon={<Edit className="w-3.5 h-3.5" />} />}
            {isAdmin && <IconBtn onClick={onDelete} icon={<Trash2 className="w-3.5 h-3.5 text-red-500" />} />}
          </div>

          {/* Mobile: iOS-style simple icon buttons */}
          <div className="flex md:hidden items-center gap-0.5">
            <button onClick={onHistory} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-500">
              <History className="w-3.5 h-3.5" />
            </button>
            <button onClick={onSerial} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-500">
              <Tag className="w-3.5 h-3.5" />
            </button>
            <button onClick={onQR} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-500">
              <QrCode className="w-3.5 h-3.5" />
            </button>
            {isAdmin && (
              <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-indigo-500">
                <Edit className="w-3.5 h-3.5" />
              </button>
            )}
            {isAdmin && (
              <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center text-red-400 hover:text-red-500">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const IconBtn = ({ onClick, icon }: { onClick: () => void; icon: React.ReactNode }) => (
  <button onClick={onClick} className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 transition-all">
    {icon}
  </button>
);
