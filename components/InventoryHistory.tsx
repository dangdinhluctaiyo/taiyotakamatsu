import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { InventoryLog } from '../types';
import { History, ArrowUpRight, ArrowDownLeft, Search, Edit, Trash2, X, Save } from 'lucide-react';

export const InventoryHistory: React.FC<{ refreshApp: () => void }> = ({ refreshApp }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'EXPORT' | 'IMPORT' | 'ADJUST'>('ALL');
  const [editingLog, setEditingLog] = useState<InventoryLog | null>(null);
  const [editNote, setEditNote] = useState('');
  const [editQty, setEditQty] = useState(0);
  const [editStaff, setEditStaff] = useState('');

  const logs = useMemo(() => {
    return db.logs
      .filter(log => {
        if (filterType !== 'ALL' && log.actionType !== filterType) return false;
        if (searchTerm) {
          const product = db.products.find(p => p.id === log.productId);
          const searchLower = searchTerm.toLowerCase();
          return (
            product?.name.toLowerCase().includes(searchLower) ||
            product?.code.toLowerCase().includes(searchLower) ||
            log.note?.toLowerCase().includes(searchLower) ||
            log.staffName?.toLowerCase().includes(searchLower)
          );
        }
        return true;
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [db.logs, searchTerm, filterType]);

  const handleEdit = (log: InventoryLog) => {
    setEditingLog(log);
    setEditNote(log.note || '');
    setEditQty(log.quantity);
    setEditStaff(log.staffName || '');
  };

  const handleSave = () => {
    if (!editingLog) return;
    db.updateLog(editingLog.id, { note: editNote, quantity: editQty, staffName: editStaff });
    setEditingLog(null);
    refreshApp();
  };

  const handleDelete = (logId: number) => {
    if (confirm(t('delete_record_confirm'))) {
      db.deleteLog(logId);
      refreshApp();
    }
  };

  const stats = useMemo(() => ({
    exports: db.logs.filter(l => l.actionType === 'EXPORT').length,
    imports: db.logs.filter(l => l.actionType === 'IMPORT').length,
  }), [db.logs]);

  return (
    <div className="p-3 md:p-8 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-3xl font-bold text-slate-800 flex items-center gap-2">
          <History className="w-6 h-6 md:w-8 md:h-8" /> {t('history_title')}
        </h1>
        <p className="text-sm text-slate-500 mt-1 hidden md:block">{t('track_transactions')}</p>
      </div>

      {/* Stats - Compact on mobile */}
      <div className="flex gap-2">
        <div className="flex-1 bg-orange-50 p-2 md:p-3 rounded-lg text-center">
          <p className="text-lg md:text-xl font-bold text-orange-600">{stats.exports}</p>
          <p className="text-[10px] md:text-xs text-orange-500">{t('export')}</p>
        </div>
        <div className="flex-1 bg-green-50 p-2 md:p-3 rounded-lg text-center">
          <p className="text-lg md:text-xl font-bold text-green-600">{stats.imports}</p>
          <p className="text-[10px] md:text-xs text-green-500">{t('import')}</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder={t('search_placeholder')}
            className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-1 overflow-x-auto pb-1">
          {[
            { key: 'ALL', label: t('all') },
            { key: 'EXPORT', label: t('export') },
            { key: 'IMPORT', label: t('import') },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap ${
                filterType === f.key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mobile Card List */}
      <div className="md:hidden space-y-2">
        {logs.length === 0 ? (
          <p className="text-center text-slate-400 py-8">{t('no_transactions')}</p>
        ) : (
          logs.map(log => {
            const product = db.products.find(p => p.id === log.productId);
            return (
              <div key={log.id} className="bg-white p-3 rounded-xl border shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${log.actionType === 'EXPORT' ? 'bg-orange-100' : 'bg-green-100'}`}>
                      {log.actionType === 'EXPORT' ? 
                        <ArrowUpRight className="w-4 h-4 text-orange-600" /> : 
                        <ArrowDownLeft className="w-4 h-4 text-green-600" />
                      }
                    </div>
                    <div>
                      <p className="font-medium text-sm">{product?.name}</p>
                      <p className="text-[10px] text-slate-400">{product?.code}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">{log.quantity}</p>
                    <p className={`text-[10px] font-medium ${log.actionType === 'EXPORT' ? 'text-orange-600' : 'text-green-600'}`}>
                      {log.actionType === 'EXPORT' ? t('export').toUpperCase() : t('import').toUpperCase()}
                    </p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t flex items-center justify-between text-xs text-slate-500">
                  <div>
                    <span>{new Date(log.timestamp).toLocaleDateString('vi-VN')}</span>
                    {log.staffName && <span className="ml-2">• {log.staffName}</span>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => handleEdit(log)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(log.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {log.note && <p className="text-xs text-slate-500 mt-1 truncate">{log.note}</p>}
              </div>
            );
          })
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left p-3 font-medium">{t('time')}</th>
              <th className="text-left p-3 font-medium">{t('type')}</th>
              <th className="text-left p-3 font-medium">{t('product')}</th>
              <th className="text-center p-3 font-medium">{t('qty')}</th>
              <th className="text-left p-3 font-medium">{t('staff_label')}</th>
              <th className="text-left p-3 font-medium">{t('note')}</th>
              <th className="text-center p-3 font-medium w-20"></th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.length === 0 ? (
              <tr><td colSpan={7} className="p-8 text-center text-slate-400">{t('no_transactions')}</td></tr>
            ) : (
              logs.map(log => {
                const product = db.products.find(p => p.id === log.productId);
                return (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="p-3">
                      <div className="text-sm">{new Date(log.timestamp).toLocaleDateString('vi-VN')}</div>
                      <div className="text-xs text-slate-400">{new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
                        log.actionType === 'EXPORT' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                      }`}>
                        {log.actionType === 'EXPORT' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                        {log.actionType === 'EXPORT' ? t('export').toUpperCase() : t('import').toUpperCase()}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="font-medium">{product?.name}</div>
                      <div className="text-xs text-slate-400">{product?.code}</div>
                    </td>
                    <td className="p-3 text-center font-bold">{log.quantity}</td>
                    <td className="p-3 text-slate-600">{log.staffName || '-'}</td>
                    <td className="p-3 text-slate-500 truncate max-w-[150px]">{log.note || '-'}</td>
                    <td className="p-3">
                      <div className="flex gap-1 justify-center">
                        <button onClick={() => handleEdit(log)} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(log.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingLog && (
        <div className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50">
          <div className="bg-white rounded-t-2xl md:rounded-xl p-4 w-full max-w-md shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold">{t('edit_note')}</h3>
              <button onClick={() => setEditingLog(null)}><X className="w-5 h-5 text-slate-500" /></button>
            </div>
            <div className="space-y-3">
              <div className="bg-slate-50 p-2 rounded-lg text-sm">
                <span className="text-slate-500">{t('product')}:</span> <span className="font-medium">{db.products.find(p => p.id === editingLog.productId)?.name}</span>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('quantity')}</label>
                <input type="number" className="w-full border p-2 rounded-lg" value={editQty} onChange={e => setEditQty(Number(e.target.value))} min={1} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('staff_info')}</label>
                <input type="text" className="w-full border p-2 rounded-lg" value={editStaff} onChange={e => setEditStaff(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{t('note')}</label>
                <input type="text" className="w-full border p-2 rounded-lg" value={editNote} onChange={e => setEditNote(e.target.value)} />
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
