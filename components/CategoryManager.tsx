import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { Plus, Edit, Trash2, Search, X, Tag, FolderOpen } from 'lucide-react';

interface Props {
  refreshApp: () => void;
}

export const CategoryManager: React.FC<Props> = ({ refreshApp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [formData, setFormData] = useState('');

  const isAdmin = db.currentUser?.role === 'admin';

  // Get unique categories from products
  const categories = useMemo(() => {
    const cats = new Set<string>();
    db.products.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [db.products]);

  const filteredCategories = useMemo(() => {
    return categories.filter(c => 
      c.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [categories, searchTerm]);

  const handleAddNew = () => {
    setEditingCategory(null);
    setFormData('');
    setIsModalOpen(true);
  };

  const handleEdit = (category: string) => {
    setEditingCategory(category);
    setFormData(category);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.trim()) {
      alert(t('please_enter_info'));
      return;
    }

    if (editingCategory) {
      // Update all products with old category to new category
      const productsToUpdate = db.products.filter(p => p.category === editingCategory);
      for (const product of productsToUpdate) {
        await db.saveProduct({ ...product, category: formData.trim() });
      }
    } else {
      // Just close modal - category will be created when adding product
      alert(t('category_created_info') || 'Danh mục sẽ được tạo khi thêm sản phẩm mới với danh mục này');
    }
    
    refreshApp();
    setIsModalOpen(false);
  };

  const handleDelete = async (category: string) => {
    const productCount = getProductCount(category);
    if (productCount > 0) {
      alert(t('cannot_delete_category_with_products') || `Không thể xóa danh mục có ${productCount} sản phẩm`);
      return;
    }
    
    // Category without products will be removed automatically
    alert(t('category_empty') || 'Danh mục không có sản phẩm sẽ tự động bị xóa');
  };

  // Get product count for each category
  const getProductCount = (category: string) => {
    return db.products.filter(p => p.category === category).length;
  };

  // Get total stock for category
  const getTotalStock = (category: string) => {
    return db.products
      .filter(p => p.category === category)
      .reduce((sum, p) => sum + p.totalOwned, 0);
  };

  return (
    <div className="p-4 md:p-8 min-h-full max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <FolderOpen className="w-8 h-8 text-purple-500" />
            {t('category_management') || 'Quản lý danh mục'}
          </h1>
          <p className="text-slate-500 mt-1">{t('category_management_desc') || 'Quản lý danh mục thiết bị'}</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white px-4 py-2 rounded-xl shadow-sm border text-center">
            <p className="text-xs text-slate-400 uppercase font-bold">{t('total_categories') || 'Tổng danh mục'}</p>
            <p className="text-xl font-bold text-slate-700">{categories.length}</p>
          </div>
        </div>
      </div>

      {/* Search & Add */}
      <div className="bg-white p-3 rounded-2xl shadow-soft border flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder={t('search_category') || 'Tìm danh mục...'}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        {isAdmin && (
          <button
            onClick={handleAddNew}
            className="w-full md:w-auto bg-purple-500 hover:bg-purple-600 text-white px-6 py-2.5 rounded-xl font-semibold shadow flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> {t('add_category') || 'Thêm danh mục'}
          </button>
        )}
      </div>

      {/* Category Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCategories.length === 0 ? (
          <div className="col-span-full text-center py-12 bg-white rounded-2xl border border-dashed">
            <FolderOpen className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-400">{t('no_categories') || 'Chưa có danh mục'}</p>
          </div>
        ) : (
          filteredCategories.map(category => (
            <div key={category} className="bg-white p-5 rounded-2xl shadow-soft border hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Tag className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800">{category}</h3>
                    <p className="text-xs text-slate-400">{getProductCount(category)} sản phẩm</p>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(category)}
                      className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                      title={t('edit')}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {getProductCount(category) === 0 && (
                      <button
                        onClick={() => handleDelete(category)}
                        className="p-2 hover:bg-red-50 rounded-lg text-red-500"
                        title={t('delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t('total_stock') || 'Tổng tồn kho'}</span>
                <span className="font-bold text-slate-700">{getTotalStock(category)}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">
                {editingCategory ? t('edit_category') || 'Sửa danh mục' : t('add_category') || 'Thêm danh mục'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('category_name') || 'Tên danh mục'} *</label>
                <input
                  type="text"
                  className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                  value={formData}
                  onChange={e => setFormData(e.target.value)}
                  placeholder="VD: Âm thanh, Ánh sáng, Ghế..."
                />
              </div>
              {!editingCategory && (
                <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg">
                  💡 {t('category_tip') || 'Danh mục sẽ tự động được tạo khi bạn thêm sản phẩm mới với danh mục này'}
                </p>
              )}
            </div>
            <div className="p-5 border-t flex gap-3">
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 border rounded-lg font-medium hover:bg-slate-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                className="flex-1 py-2.5 bg-purple-500 text-white rounded-lg font-bold hover:bg-purple-600"
              >
                {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
