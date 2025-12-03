import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { Customer } from '../types';
import { Plus, Edit, Trash2, Search, X, Phone, User, Users } from 'lucide-react';

import { useToast } from './Toast';

interface Props {
  refreshApp: () => void;
}

export const CustomerManager: React.FC<Props> = ({ refreshApp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '' });

  const { success, error } = useToast();
  const isAdmin = db.currentUser?.role === 'admin';

  const filteredCustomers = useMemo(() => {
    return db.customers.filter(c =>
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm)
    );
  }, [db.customers, searchTerm]);

  const handleAddNew = () => {
    setEditingCustomer(null);
    setFormData({ name: '', phone: '' });
    setIsModalOpen(true);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({ name: customer.name, phone: customer.phone });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      error(t('please_enter_info'));
      return;
    }

    if (editingCustomer) {
      await db.updateCustomer(editingCustomer.id, formData);
    } else {
      await db.addCustomer(formData);
    }

    refreshApp();
    setIsModalOpen(false);
    success(editingCustomer ? (t('update_success') || 'Cập nhật thành công') : (t('create_success') || 'Tạo mới thành công'));
  };

  const handleDelete = async (id: number) => {
    // Check if customer has orders
    const hasOrders = db.orders.some(o => o.customerId === id);
    if (hasOrders) {
      error(t('cannot_delete_customer_with_orders') || 'Không thể xóa khách hàng đã có đơn hàng');
      return;
    }

    if (confirm(t('delete_confirm'))) {
      await db.deleteCustomer(id);
      refreshApp();
      success(t('delete_success') || 'Đã xóa khách hàng');
    }
  };

  // Get order count for each customer
  const getOrderCount = (customerId: number) => {
    return db.orders.filter(o => o.customerId === customerId).length;
  };

  return (
    <div className="p-4 md:p-8 min-h-full max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-500" />
            {t('customer_management') || 'Quản lý khách hàng'}
          </h1>
          <p className="text-slate-500 mt-1">{t('customer_management_desc') || 'Quản lý thông tin khách hàng'}</p>
        </div>
        <div className="flex gap-3">
          <div className="bg-white px-4 py-2 rounded-xl shadow-sm border text-center">
            <p className="text-xs text-slate-400 uppercase font-bold">{t('total_customers') || 'Tổng KH'}</p>
            <p className="text-xl font-bold text-slate-700">{db.customers.length}</p>
          </div>
        </div>
      </div>

      {/* Search & Add */}
      <div className="bg-white p-3 rounded-2xl shadow-soft border flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder={t('search_customer') || 'Tìm khách hàng...'}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <button
          onClick={handleAddNew}
          className="w-full md:w-auto bg-primary hover:bg-primaryDark text-white px-6 py-2.5 rounded-xl font-semibold shadow-glow flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" /> {t('add_customer') || 'Thêm khách hàng'}
        </button>
      </div>

      {/* Customer List */}
      <div className="bg-white rounded-2xl shadow-soft border overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
            <tr>
              <th className="p-4">{t('customer') || 'Khách hàng'}</th>
              <th className="p-4">{t('phone') || 'Điện thoại'}</th>
              <th className="p-4 text-center">{t('orders') || 'Đơn hàng'}</th>
              <th className="p-4 text-center">{t('actions') || 'Thao tác'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCustomers.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-slate-400">
                  {t('no_customers') || 'Chưa có khách hàng'}
                </td>
              </tr>
            ) : (
              filteredCustomers.map(customer => (
                <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{customer.name}</p>
                        <p className="text-xs text-slate-400">ID: {customer.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-4 h-4 text-slate-400" />
                      {customer.phone || '-'}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <span className="px-2 py-1 bg-slate-100 rounded-lg text-sm font-medium">
                      {getOrderCount(customer.id)}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-center gap-2">
                      <button
                        onClick={() => handleEdit(customer)}
                        className="p-2 hover:bg-blue-50 rounded-lg text-blue-600"
                        title={t('edit')}
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      {isAdmin && getOrderCount(customer.id) === 0 && (
                        <button
                          onClick={() => handleDelete(customer.id)}
                          className="p-2 hover:bg-red-50 rounded-lg text-red-500"
                          title={t('delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-5 border-b flex justify-between items-center">
              <h3 className="font-bold text-lg">
                {editingCustomer ? t('edit_customer') || 'Sửa khách hàng' : t('add_customer') || 'Thêm khách hàng'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('customer_name')} *</label>
                <input
                  type="text"
                  className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t('placeholder_company')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('customer_phone')}</label>
                <input
                  type="text"
                  className="w-full border p-2.5 rounded-lg outline-none focus:ring-2 focus:ring-primary/20"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  placeholder={t('placeholder_phone')}
                />
              </div>
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
                className="flex-1 py-2.5 bg-primary text-white rounded-lg font-bold hover:bg-primaryDark"
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
