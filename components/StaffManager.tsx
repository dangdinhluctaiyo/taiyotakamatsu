import React, { useState } from 'react';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { Staff } from '../types';
import { Users, Plus, Edit, Trash2, X, Save, Shield, User, Check, Ban } from 'lucide-react';

export const StaffManager: React.FC<{ refreshApp: () => void }> = ({ refreshApp }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState({ username: '', password: '', name: '', role: 'staff' as 'admin' | 'staff', active: true });

  const handleAdd = () => {
    setEditingStaff(null);
    setFormData({ username: '', password: '', name: '', role: 'staff', active: true });
    setShowModal(true);
  };

  const handleEdit = (staff: Staff) => {
    setEditingStaff(staff);
    setFormData({ username: staff.username, password: '', name: staff.name, role: staff.role, active: staff.active });
    setShowModal(true);
  };

  const handleSave = () => {
    if (!formData.username.trim() || !formData.name.trim()) {
      alert(t('please_enter_info'));
      return;
    }

    if (editingStaff) {
      const updates: Partial<Staff> = { username: formData.username, name: formData.name, role: formData.role, active: formData.active };
      if (formData.password.trim()) updates.password = formData.password;
      db.updateStaff(editingStaff.id, updates);
    } else {
      if (!formData.password.trim()) {
        alert(t('please_enter_info'));
        return;
      }
      db.addStaff({ username: formData.username, password: formData.password, name: formData.name, role: formData.role, active: formData.active });
    }

    setShowModal(false);
    refreshApp();
  };

  const handleDelete = (staffId: number) => {
    if (staffId === db.currentUser?.id) {
      alert(t('cannot_delete_self'));
      return;
    }
    if (confirm(t('delete_confirm'))) {
      db.deleteStaff(staffId);
      refreshApp();
    }
  };

  const toggleActive = (staff: Staff) => {
    if (staff.id === db.currentUser?.id) {
      alert(t('cannot_disable_self'));
      return;
    }
    db.updateStaff(staff.id, { active: !staff.active });
    refreshApp();
  };

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
            <Users className="w-8 h-8" /> {t('staff_title')}
          </h1>
          <p className="text-slate-500 mt-1">{t('staff_management_desc')}</p>
        </div>
        <button onClick={handleAdd} className="bg-primary text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 hover:bg-primaryDark">
          <Plus className="w-5 h-5" /> {t('add_staff')}
        </button>
      </div>

      {/* Staff Table */}
      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-4 font-medium">{t('staff_column')}</th>
              <th className="text-left p-4 font-medium">{t('username')}</th>
              <th className="text-center p-4 font-medium">{t('role')}</th>
              <th className="text-center p-4 font-medium">{t('status')}</th>
              <th className="text-center p-4 font-medium w-32">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {db.staff.map(staff => (
              <tr key={staff.id} className={`hover:bg-slate-50 ${!staff.active ? 'opacity-50' : ''}`}>
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${staff.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                      {staff.role === 'admin' ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
                    </div>
                    <div>
                      <div className="font-medium">{staff.name}</div>
                      {staff.id === db.currentUser?.id && <span className="text-xs text-green-600">({t('logged_in')})</span>}
                    </div>
                  </div>
                </td>
                <td className="p-4 font-mono text-slate-600">{staff.username}</td>
                <td className="p-4 text-center">
                  <span className={`px-2 py-1 rounded text-xs font-bold ${staff.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                    {staff.role === 'admin' ? t('role_admin') : t('role_staff')}
                  </span>
                </td>
                <td className="p-4 text-center">
                  <button onClick={() => toggleActive(staff)} className={`px-2 py-1 rounded text-xs font-bold flex items-center gap-1 mx-auto ${staff.active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {staff.active ? <><Check className="w-3 h-3" /> {t('status_active')}</> : <><Ban className="w-3 h-3" /> {t('status_inactive')}</>}
                  </button>
                </td>
                <td className="p-4">
                  <div className="flex gap-1 justify-center">
                    <button onClick={() => handleEdit(staff)} className="p-2 text-blue-600 hover:bg-blue-50 rounded" title={t('edit')}>
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(staff.id)} className="p-2 text-red-600 hover:bg-red-50 rounded" title={t('delete')}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">{editingStaff ? t('edit_staff') : t('add_new_staff')}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">{t('full_name')} *</label>
                <input type="text" className="w-full border p-2 rounded-lg" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder={t('placeholder_staff_name')} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('username')} *</label>
                <input type="text" className="w-full border p-2 rounded-lg font-mono" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} placeholder={t('placeholder_username')} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{editingStaff ? t('password_change_hint') : t('password') + ' *'}</label>
                <input type="password" className="w-full border p-2 rounded-lg" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="••••••" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('role')}</label>
                <select className="w-full border p-2 rounded-lg" value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value as 'admin' | 'staff' })}>
                  <option value="staff">{t('role_staff')}</option>
                  <option value="admin">{t('role_admin')}</option>
                </select>
              </div>
              <button onClick={handleSave} className="w-full bg-primary text-white py-2.5 rounded-lg font-bold flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {t('save')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
