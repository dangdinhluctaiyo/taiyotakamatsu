import React, { useState, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { t, i18n } from '../services/i18n';
import { Product } from '../types';
import { Plus, Edit, Trash2, QrCode, X, Save, Image as ImageIcon, History, Search, ArrowUpRight, ArrowDownLeft, AlertCircle, LayoutGrid, List as ListIcon, Box, Calendar, DollarSign, Package, Truck, MapPin, FileText, ChevronLeft, ChevronRight, Upload, Link } from 'lucide-react';
import { useToast } from './Toast';

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

  const { success, error } = useToast();
  const isAdmin = db.currentUser?.role === 'admin';

  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', code: '', category: '', pricePerDay: 0, totalOwned: 0, imageUrl: '', images: [], location: '', specs: ''
  });
  const [newImageUrl, setNewImageUrl] = useState('');
  const [imageInputMode, setImageInputMode] = useState<'url' | 'upload'>('upload');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredProducts = useMemo(() => {
    return db.products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [db.products, searchTerm, selectedCategory]);

  const categories = useMemo(() => {
    const cats = new Set(db.products.map(p => p.category).filter(Boolean));
    return Array.from(cats).sort();
  }, [db.products]);

  const totalItemsCount = db.products.reduce((sum, p) => sum + p.totalOwned, 0);
  const lowStockItems = db.products.filter(p => p.currentPhysicalStock < 3).length;

  const handleEdit = (product: Product) => {
    console.log('handleEdit - isAdmin:', isAdmin, 'currentUser:', db.currentUser);
    if (!isAdmin) { error(t('only_admin_can_edit')); return; }
    setEditingProduct(product); setFormData({ ...product }); setIsModalOpen(true);
  };
  const handleAddNew = () => {
    console.log('handleAddNew - isAdmin:', isAdmin, 'currentUser:', db.currentUser);
    if (!isAdmin) { error(t('only_admin_can_add')); return; }
    setEditingProduct(null); setFormData({ name: '', code: '', category: 'Thiết bị', pricePerDay: 0, totalOwned: 1, imageUrl: '', images: [], location: '', specs: '' }); setIsModalOpen(true);
  };
  const handleDelete = async (id: number) => {
    console.log('handleDelete - isAdmin:', isAdmin, 'currentUser:', db.currentUser);
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
      id: editingProduct ? editingProduct.id : 0, code: formData.code!, name: formData.name!, category: formData.category || 'Khác',
      pricePerDay: Number(formData.pricePerDay), totalOwned: Number(formData.totalOwned),
      currentPhysicalStock: editingProduct ? editingProduct.currentPhysicalStock : Number(formData.totalOwned),
      imageUrl: formData.imageUrl || formData.images?.[0] || 'https://via.placeholder.com/150',
      images: formData.images || [], location: formData.location || '', specs: formData.specs || ''
    };
    await db.saveProduct(productToSave);
    refreshApp();
    setIsModalOpen(false);
    success(editingProduct ? (t('update_success') || 'Cập nhật thành công') : (t('create_success') || 'Tạo mới thành công'));
  };

  const addImage = () => { if (newImageUrl.trim()) { setFormData({ ...formData, images: [...(formData.images || []), newImageUrl] }); setNewImageUrl(''); } };
  const removeImage = (idx: number) => { setFormData({ ...formData, images: formData.images?.filter((_, i) => i !== idx) }); };

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

    // Reset input
    e.target.value = '';
  };

  const openHistory = (product: Product) => { setViewHistoryFor(product); setIsHistoryOpen(true); };
  const getProductLogs = (productId: number) => db.logs.filter(l => l.productId === productId).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const getUpcomingRentals = (productId: number) => {
    const today = new Date().toISOString().split('T')[0];
    return db.orders.filter(o => o.items.some(i => i.productId === productId) && (o.status === 'BOOKED' || o.status === 'ACTIVE') && o.expectedReturnDate >= today)
      .sort((a, b) => new Date(a.rentalStartDate).getTime() - new Date(b.rentalStartDate).getTime());
  };

  const getAllImages = (p: Product) => {
    const imgs = [...(p.images || [])];
    if (p.imageUrl && !imgs.includes(p.imageUrl)) imgs.unshift(p.imageUrl);
    return imgs.length > 0 ? imgs : ['https://via.placeholder.com/400x300?text=No+Image'];
  };

  return (
    <div className="p-4 md:p-8 min-h-full max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">{t('products_title')}</h1>
          <p className="text-slate-500 mt-1">{t('inventory_desc')}</p>
        </div>
        <div className="flex gap-4">
          <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100 text-center">
            <p className="text-xs text-slate-400 uppercase font-bold">{t('total_equipment')}</p>
            <p className="text-xl font-bold text-slate-700">{totalItemsCount}</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-100 text-center">
            <p className="text-xs text-slate-400 uppercase font-bold">{t('low_stock_warning')}</p>
            <p className={`text-xl font-bold ${lowStockItems > 0 ? 'text-red-500' : 'text-green-500'}`}>{lowStockItems}</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-2 rounded-2xl shadow-soft border border-slate-100 flex flex-col md:flex-row gap-2 items-center justify-between">
        <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto p-1">
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={() => setViewMode('GRID')} className={`flex-1 md:flex-none p-2 rounded-lg transition-all ${viewMode === 'GRID' ? 'bg-slate-100 text-slate-800 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid className="w-5 h-5 mx-auto" /></button>
            <button onClick={() => setViewMode('LIST')} className={`hidden md:block p-2 rounded-lg transition-all ${viewMode === 'LIST' ? 'bg-slate-100 text-slate-800 shadow-inner' : 'text-slate-400 hover:text-slate-600'}`}><ListIcon className="w-5 h-5" /></button>
          </div>
          <div className="hidden md:block h-6 w-px bg-slate-200 mx-1 self-center"></div>
          <div className="relative flex-1 md:w-80 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input type="text" placeholder={t('search_equipment')} className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <div className="w-full md:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm outline-none cursor-pointer"
            >
              <option value="ALL">{t('all_categories') || 'Tất cả danh mục'}</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
        {isAdmin && (
          <button onClick={handleAddNew} className="w-full md:w-auto bg-primary hover:bg-primaryDark text-white px-6 py-2.5 rounded-xl font-semibold shadow-glow flex items-center justify-center gap-2"><Plus className="w-5 h-5" /> {t('add_equipment_btn')}</button>
        )}
      </div>

      {viewMode === 'GRID' || window.innerWidth < 768 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(p => {
            const stockPercent = (p.currentPhysicalStock / p.totalOwned) * 100;
            const isLow = p.currentPhysicalStock < 5;
            return (
              <div key={p.id} onClick={() => { setViewDetailFor(p); setCurrentImageIndex(0); }} className="bg-white rounded-2xl shadow-soft hover:shadow-xl transition-all duration-300 overflow-hidden border border-slate-100 group flex flex-col cursor-pointer">
                <div className="relative h-48 bg-slate-100 overflow-hidden">
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500" />
                  <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg text-xs font-bold shadow-sm">{p.code}</div>
                  {isLow && <div className="absolute bottom-2 left-2 bg-red-500 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1 animate-pulse"><AlertCircle className="w-3 h-3" /> {t('low_stock')}</div>}
                  {p.location && <div className="absolute bottom-2 right-2 bg-blue-500/90 text-white px-2 py-1 rounded-lg text-xs font-bold shadow-sm flex items-center gap-1"><MapPin className="w-3 h-3" /> {p.location}</div>}
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="mb-3">
                    <h3 className="font-bold text-slate-800 text-lg leading-tight mb-1">{p.name}</h3>
                    <p className="text-sm text-slate-500">{p.category}</p>
                  </div>
                  <div className="mt-auto space-y-3">
                    <div>
                      <div className="flex justify-between text-xs font-medium mb-1">
                        <span className={isLow ? 'text-red-600' : 'text-slate-600'}>{t('at_warehouse')}: {p.currentPhysicalStock}</span>
                        <span className="text-slate-400">{t('total_owned')}: {p.totalOwned}</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${stockPercent}%` }}></div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-slate-50">
                      <span className="font-bold text-primary">{p.pricePerDay.toLocaleString()}{t('vnd')}</span>
                      <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                        <IconButton onClick={() => openHistory(p)} icon={<History className="w-4 h-4" />} title={t('view_history')} />
                        <IconButton onClick={() => setShowQRFor(p)} icon={<QrCode className="w-4 h-4" />} title={t('qr_code')} />
                        {isAdmin && <IconButton onClick={() => handleEdit(p)} icon={<Edit className="w-4 h-4" />} title={t('edit')} />}
                        {isAdmin && <IconButton onClick={() => handleDelete(p.id)} icon={<Trash2 className="w-4 h-4 text-red-500" />} title={t('delete')} />}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
              <tr><th className="p-4 w-16">{t('images')}</th><th className="p-4">{t('items')}</th><th className="p-4">{t('location')}</th><th className="p-4 text-center">{t('in_stock')}</th><th className="p-4 text-right">{t('price_per_day')}</th><th className="p-4 text-center">{t('actions')}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(p => {
                const stockPercent = (p.currentPhysicalStock / p.totalOwned) * 100;
                const isLow = p.currentPhysicalStock < 5;
                return (
                  <tr key={p.id} onClick={() => { setViewDetailFor(p); setCurrentImageIndex(0); }} className="hover:bg-slate-50 transition-colors group cursor-pointer">
                    <td className="p-4"><img src={p.imageUrl} alt="" className="w-12 h-12 rounded-lg object-cover bg-slate-200 border" /></td>
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{p.name}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 border">{p.code}</span>
                        <span className="text-xs text-slate-400">{p.category}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-slate-600">{p.location || '-'}</td>
                    <td className="p-4 align-middle">
                      <div className="max-w-[100px] mx-auto">
                        <div className="flex justify-between text-xs font-bold mb-1">
                          <span className={isLow ? 'text-red-500' : 'text-green-600'}>{p.currentPhysicalStock}</span>
                          <span className="text-slate-400">/ {p.totalOwned}</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${isLow ? 'bg-red-500' : 'bg-green-500'}`} style={{ width: `${stockPercent}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-right font-medium text-slate-600">{p.pricePerDay.toLocaleString()}</td>
                    <td className="p-4" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-center gap-2 opacity-60 group-hover:opacity-100">
                        <IconButton onClick={() => openHistory(p)} icon={<History className="w-4 h-4" />} />
                        <IconButton onClick={() => setShowQRFor(p)} icon={<QrCode className="w-4 h-4" />} />
                        {isAdmin && <IconButton onClick={() => handleEdit(p)} icon={<Edit className="w-4 h-4" />} />}
                        {isAdmin && <IconButton onClick={() => handleDelete(p.id)} icon={<Trash2 className="w-4 h-4 text-red-500" />} />}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* PRODUCT DETAIL MODAL */}
      {viewDetailFor && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4 z-50 backdrop-blur-sm">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-slide-up md:animate-fade-in">
            {/* Image Gallery */}
            <div className="relative h-64 bg-slate-100">
              <img src={getAllImages(viewDetailFor)[currentImageIndex]} alt={viewDetailFor.name} className="w-full h-full object-cover" />
              <button onClick={() => setViewDetailFor(null)} className="absolute top-4 right-4 bg-white/90 p-2 rounded-full hover:bg-white shadow-lg"><X className="w-5 h-5 text-slate-600" /></button>
              {getAllImages(viewDetailFor).length > 1 && (
                <>
                  <button onClick={() => setCurrentImageIndex(i => i > 0 ? i - 1 : getAllImages(viewDetailFor).length - 1)} className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 p-2 rounded-full hover:bg-white shadow-lg"><ChevronLeft className="w-5 h-5" /></button>
                  <button onClick={() => setCurrentImageIndex(i => i < getAllImages(viewDetailFor).length - 1 ? i + 1 : 0)} className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 p-2 rounded-full hover:bg-white shadow-lg"><ChevronRight className="w-5 h-5" /></button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {getAllImages(viewDetailFor).map((_, i) => <div key={i} onClick={() => setCurrentImageIndex(i)} className={`w-2 h-2 rounded-full cursor-pointer ${i === currentImageIndex ? 'bg-white' : 'bg-white/50'}`} />)}
                  </div>
                </>
              )}
              <div className="absolute bottom-4 left-4"><span className="bg-white/90 backdrop-blur px-3 py-1 rounded-lg text-sm font-mono font-bold shadow">{viewDetailFor.code}</span></div>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 mb-1">{viewDetailFor.name}</h2>
                  <p className="text-slate-500">{viewDetailFor.category}</p>
                </div>
                {viewDetailFor.location && (
                  <div className="flex items-center gap-2 bg-blue-50 px-3 py-2 rounded-lg">
                    <MapPin className="w-4 h-4 text-blue-500" />
                    <span className="text-sm font-medium text-blue-700">{viewDetailFor.location}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-xl text-center">
                  <Package className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-600">{viewDetailFor.totalOwned}</p>
                  <p className="text-xs text-blue-500 uppercase font-bold">{t('total_owned_label')}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-xl text-center">
                  <Box className="w-6 h-6 text-green-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">{viewDetailFor.currentPhysicalStock}</p>
                  <p className="text-xs text-green-500 uppercase font-bold">{t('at_warehouse')}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-xl text-center">
                  <Truck className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-orange-600">{viewDetailFor.totalOwned - viewDetailFor.currentPhysicalStock}</p>
                  <p className="text-xs text-orange-500 uppercase font-bold">{t('renting')}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-xl text-center">
                  <DollarSign className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-600">{viewDetailFor.pricePerDay.toLocaleString()}</p>
                  <p className="text-xs text-purple-500 uppercase font-bold">{t('vnd_per_day')}</p>
                </div>
              </div>

              {/* Specs */}
              {viewDetailFor.specs && (
                <div className="mb-6">
                  <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><FileText className="w-4 h-4" /> {t('specs')}</h3>
                  <div className="bg-slate-50 p-4 rounded-lg">
                    <pre className="text-sm text-slate-600 whitespace-pre-wrap font-sans">{viewDetailFor.specs}</pre>
                  </div>
                </div>
              )}

              {/* Upcoming Rentals */}
              <div className="mb-6">
                <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><Calendar className="w-4 h-4" /> {t('upcoming_rentals')}</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {getUpcomingRentals(viewDetailFor.id).length === 0 ? (
                    <p className="text-slate-400 text-sm py-4 text-center bg-slate-50 rounded-lg">{t('no_rentals')}</p>
                  ) : getUpcomingRentals(viewDetailFor.id).slice(0, 5).map(order => {
                    const item = order.items.find(i => i.productId === viewDetailFor.id);
                    const customer = db.customers.find(c => c.id === order.customerId);
                    return (
                      <div key={order.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <span className="font-medium text-slate-800">{customer?.name}</span>
                          <p className="text-xs text-slate-500">{new Date(order.rentalStartDate).toLocaleDateString(i18n.getLanguage() === 'vi' ? 'vi-VN' : 'ja-JP')} → {new Date(order.expectedReturnDate).toLocaleDateString(i18n.getLanguage() === 'vi' ? 'vi-VN' : 'ja-JP')}</p>
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
                <h3 className="font-bold text-slate-700 mb-3 flex items-center gap-2"><History className="w-4 h-4" /> {t('recent_activity')}</h3>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {getProductLogs(viewDetailFor.id).length === 0 ? (
                    <p className="text-slate-400 text-sm py-4 text-center bg-slate-50 rounded-lg">{t('no_activity')}</p>
                  ) : getProductLogs(viewDetailFor.id).slice(0, 5).map(log => (
                    <div key={log.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className={`p-2 rounded-lg ${log.actionType === 'EXPORT' ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600'}`}>
                          {log.actionType === 'EXPORT' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                        </span>
                        <div>
                          <span className="font-medium text-slate-800">{log.actionType === 'EXPORT' ? t('export_stock') : log.actionType === 'IMPORT' ? t('import_stock') : t('adjust')}</span>
                          <p className="text-xs text-slate-500">{new Date(log.timestamp).toLocaleString(i18n.getLanguage() === 'vi' ? 'vi-VN' : 'ja-JP')}</p>
                        </div>
                      </div>
                      <span className="font-bold text-slate-700">x{log.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t bg-slate-50 flex gap-3">
              <button onClick={() => { setViewDetailFor(null); openHistory(viewDetailFor); }} className="flex-1 py-2.5 border border-slate-200 rounded-lg font-medium hover:bg-white flex items-center justify-center gap-2"><History className="w-4 h-4" /> {t('view_history')}</button>
              {isAdmin && (
                <>
                  <button onClick={() => { setViewDetailFor(null); handleEdit(viewDetailFor); }} className="flex-1 py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-primaryDark flex items-center justify-center gap-2"><Edit className="w-4 h-4" /> {t('edit')}</button>
                  <button onClick={() => { if (confirm(t('delete_equipment_prompt'))) { handleDelete(viewDetailFor.id); setViewDetailFor(null); } }} className="py-2.5 px-4 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 flex items-center justify-center gap-2"><Trash2 className="w-4 h-4" /> {t('delete')}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* EDIT/CREATE MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center p-0 md:p-4 z-50 backdrop-blur-sm">
          <div className="bg-white w-full h-full md:h-auto md:max-h-[90vh] md:max-w-xl md:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 animate-slide-up md:animate-fade-in">
            <div className="p-4 md:p-5 border-b flex justify-between items-center bg-slate-50/50 pt-[max(1rem,env(safe-area-inset-top))]">
              <h3 className="font-bold text-lg text-slate-800">{editingProduct ? t('edit_product') : t('add_new_product')}</h3>
              <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300"><X className="w-4 h-4 text-slate-600" /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('sku_code')}</label>
                  <input type="text" className="w-full border border-slate-200 p-2.5 rounded-lg uppercase font-mono bg-slate-50 focus:bg-white outline-none" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} placeholder="GHE-HP01" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('category')}</label>
                  <input type="text" className="w-full border border-slate-200 p-2.5 rounded-lg outline-none" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="Âm thanh" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('equipment_name')}</label>
                <input type="text" className="w-full border border-slate-200 p-2.5 rounded-lg outline-none font-medium" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ghế Tiffany Vàng" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('price_per_day')}</label>
                  <div className="relative">
                    <input type="number" className="w-full border border-slate-200 p-2.5 pl-8 rounded-lg outline-none" value={formData.pricePerDay} onChange={e => setFormData({ ...formData, pricePerDay: Number(e.target.value) })} />
                    <span className="absolute left-3 top-2.5 text-slate-400 font-bold">{t('vnd')}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('total_assets')}</label>
                  <input type="number" className="w-full border border-slate-200 p-2.5 rounded-lg font-bold text-blue-600 bg-blue-50 outline-none" value={formData.totalOwned} onChange={e => setFormData({ ...formData, totalOwned: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1"><MapPin className="w-3 h-3 inline" /> {t('location')}</label>
                <input type="text" className="w-full border border-slate-200 p-2.5 rounded-lg outline-none" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} placeholder="VD: Kệ A1 - Kho 1" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1"><FileText className="w-3 h-3 inline" /> {t('specs')}</label>
                <textarea className="w-full border border-slate-200 p-2.5 rounded-lg outline-none text-sm" rows={3} value={formData.specs} onChange={e => setFormData({ ...formData, specs: e.target.value })} placeholder="Chất liệu: ...&#10;Kích thước: ...&#10;Công suất: ..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1"><ImageIcon className="w-3 h-3 inline" /> {t('images')}</label>

                {/* Toggle buttons */}
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setImageInputMode('upload')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${imageInputMode === 'upload' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    <Upload className="w-4 h-4" /> {t('upload_image')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setImageInputMode('url')}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 ${imageInputMode === 'url' ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-600'}`}
                  >
                    <Link className="w-4 h-4" /> {t('url_image')}
                  </button>
                </div>

                {/* Upload mode */}
                {imageInputMode === 'upload' && (
                  <div className="mb-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept="image/*"
                      multiple
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-blue-400 hover:bg-blue-50 transition-colors"
                    >
                      <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm text-slate-600">{t('click_to_upload')}</p>
                      <p className="text-xs text-slate-400 mt-1">{t('supported_formats')}</p>
                    </button>
                  </div>
                )}

                {/* URL mode */}
                {imageInputMode === 'url' && (
                  <div className="flex gap-2 mb-2">
                    <input type="text" className="flex-1 border border-slate-200 p-2 rounded-lg text-sm outline-none" value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} placeholder={t('paste_url')} />
                    <button type="button" onClick={addImage} className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600">{t('add')}</button>
                  </div>
                )}

                {/* Image preview */}
                {(formData.images?.length || 0) > 0 && (
                  <div className="flex gap-2 flex-wrap mt-2">
                    {formData.images?.map((img, i) => (
                      <div key={i} className="relative group">
                        <img src={img} className="w-16 h-16 object-cover rounded-lg border" />
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
            <div className="p-5 border-t bg-slate-50 flex justify-end gap-3">
              <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-200 rounded-lg">{t('cancel')}</button>
              <button onClick={handleSave} className="px-6 py-2.5 bg-primary text-white rounded-lg font-bold shadow-lg hover:bg-primaryDark flex items-center gap-2"><Save className="w-4 h-4" /> {t('save')}</button>
            </div>
          </div>
        </div>
      )}

      {/* QR CODE MODAL */}
      {showQRFor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full relative">
            <button onClick={() => setShowQRFor(null)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full hover:bg-slate-200"><X className="w-5 h-5 text-slate-500" /></button>
            <div className="mb-6 text-center">
              <h3 className="text-2xl font-bold text-slate-800 mb-1">{showQRFor.name}</h3>
              <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-mono font-bold text-sm border">{showQRFor.code}</span>
            </div>
            <div className="p-4 bg-white border-4 border-slate-900 rounded-2xl mb-6 shadow-sm">
              <img src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${showQRFor.code}`} alt={showQRFor.code} className="w-56 h-56 object-contain" />
            </div>
            <button onClick={() => window.print()} className="w-full bg-slate-900 text-white py-3.5 rounded-xl font-bold hover:bg-slate-800 shadow-lg flex items-center justify-center gap-2"><QrCode className="w-5 h-5" /> {t('print_qr')}</button>
          </div>
        </div>
      )}

      {/* HISTORY MODAL */}
      {isHistoryOpen && viewHistoryFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[80vh] border">
            <div className="p-5 border-b flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="font-bold text-xl text-slate-800">{t('history_title')}</h3>
                <p className="text-sm text-slate-500 mt-0.5">{viewHistoryFor.name} — <span className="font-mono">{viewHistoryFor.code}</span></p>
              </div>
              <button onClick={() => setIsHistoryOpen(false)} className="bg-white p-2 rounded-full border hover:bg-slate-100"><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 font-bold sticky top-0 shadow-sm">
                  <tr><th className="p-4">{t('time')}</th><th className="p-4">{t('type')}</th><th className="p-4 text-right">{t('qty')}</th><th className="p-4">{t('order')}</th><th className="p-4">{t('note')}</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {getProductLogs(viewHistoryFor.id).length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-slate-400">{t('no_transactions')}</td></tr>
                  ) : getProductLogs(viewHistoryFor.id).map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="p-4 text-slate-600">{new Date(log.timestamp).toLocaleDateString(i18n.getLanguage() === 'vi' ? 'vi-VN' : 'ja-JP')} <span className="text-slate-400 text-xs">{new Date(log.timestamp).toLocaleTimeString(i18n.getLanguage() === 'vi' ? 'vi-VN' : 'ja-JP', { hour: '2-digit', minute: '2-digit' })}</span></td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${log.actionType === 'EXPORT' ? 'bg-orange-50 text-orange-700 border-orange-200' : log.actionType === 'IMPORT' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {log.actionType === 'EXPORT' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                          {log.actionType === 'EXPORT' ? t('export').toUpperCase() : log.actionType === 'IMPORT' ? t('import').toUpperCase() : t('adjust').toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-right font-bold text-slate-800">{log.quantity}</td>
                      <td className="p-4">{log.orderId ? <span className="text-primary font-medium bg-blue-50 px-2 py-0.5 rounded text-xs">#{log.orderId}</span> : '-'}</td>
                      <td className="p-4 text-slate-500 italic truncate max-w-[150px]">{log.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const IconButton = ({ onClick, icon, title }: any) => (
  <button onClick={onClick} className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-50 text-slate-500 hover:bg-white hover:text-primary hover:shadow-md transition-all border border-transparent hover:border-slate-100" title={title}>{icon}</button>
);
