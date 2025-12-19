import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { supabase } from '../services/supabase';
import { t } from '../services/i18n';
import { Product } from '../types';
import { X, Plus, Trash2, Search, Tag, Package, Scan } from 'lucide-react';

interface Props {
    product: Product;
    onClose: () => void;
    refreshApp: () => void;
}

interface Serial {
    id: number;
    serialNumber: string;
    status: 'AVAILABLE' | 'RESERVED' | 'ON_RENT' | 'DIRTY' | 'BROKEN';
    orderId?: number;
}

export const SerialManager: React.FC<Props> = ({ product, onClose, refreshApp }) => {
    const [serials, setSerials] = useState<Serial[]>([]);
    const [newSerial, setNewSerial] = useState('');
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    useEffect(() => {
        loadSerials();
    }, [product.id]);

    const loadSerials = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('device_serials')
                .select('*')
                .eq('product_id', product.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Error loading serials:', error);
                // Fallback to localStorage if table doesn't exist
                const storedSerials = localStorage.getItem(`serials_${product.id}`);
                if (storedSerials) {
                    setSerials(JSON.parse(storedSerials));
                }
            } else if (data) {
                setSerials(data.map(d => ({
                    id: d.id,
                    serialNumber: d.serial_number,
                    status: d.status,
                    orderId: d.order_id
                })));
            }
        } catch (e) {
            console.error('Error loading serials:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleAddSerial = async () => {
        if (!newSerial.trim()) return;

        // Check for duplicates
        if (serials.some(s => s.serialNumber === newSerial.toUpperCase())) {
            return;
        }

        try {
            const { data, error } = await supabase
                .from('device_serials')
                .insert({
                    product_id: product.id,
                    serial_number: newSerial.toUpperCase(),
                    status: 'AVAILABLE'
                })
                .select()
                .single();

            if (error) {
                console.error('Error adding serial:', error);
                // Fallback to localStorage
                const serial: Serial = {
                    id: Date.now(),
                    serialNumber: newSerial.toUpperCase(),
                    status: 'AVAILABLE'
                };
                const newSerials = [...serials, serial];
                localStorage.setItem(`serials_${product.id}`, JSON.stringify(newSerials));
                setSerials(newSerials);
            } else if (data) {
                setSerials([{
                    id: data.id,
                    serialNumber: data.serial_number,
                    status: data.status,
                    orderId: data.order_id
                }, ...serials]);
            }
            setNewSerial('');
        } catch (e) {
            console.error('Error adding serial:', e);
        }
    };

    const handleDeleteSerial = async (id: number) => {
        if (!confirm(t('confirm_delete'))) return;

        try {
            const { error } = await supabase
                .from('device_serials')
                .delete()
                .eq('id', id);

            if (error) {
                console.error('Error deleting serial:', error);
                // Fallback to localStorage
                const newSerials = serials.filter(s => s.id !== id);
                localStorage.setItem(`serials_${product.id}`, JSON.stringify(newSerials));
                setSerials(newSerials);
            } else {
                setSerials(serials.filter(s => s.id !== id));
            }
        } catch (e) {
            console.error('Error deleting serial:', e);
        }
    };

    const handleStatusChange = async (id: number, status: Serial['status']) => {
        try {
            const { error } = await supabase
                .from('device_serials')
                .update({ status })
                .eq('id', id);

            if (error) {
                console.error('Error updating status:', error);
                // Fallback to localStorage
                const newSerials = serials.map(s => s.id === id ? { ...s, status } : s);
                localStorage.setItem(`serials_${product.id}`, JSON.stringify(newSerials));
                setSerials(newSerials);
            } else {
                setSerials(serials.map(s => s.id === id ? { ...s, status } : s));
            }
        } catch (e) {
            console.error('Error updating status:', e);
        }
    };

    const filteredSerials = serials.filter(s => {
        const matchesSearch = s.serialNumber.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = filterStatus === 'ALL' || s.status === filterStatus;
        return matchesSearch && matchesStatus;
    });

    const statusColors: Record<string, string> = {
        AVAILABLE: 'bg-green-100 text-green-700',
        RESERVED: 'bg-orange-100 text-orange-700',
        ON_RENT: 'bg-blue-100 text-blue-700',
        DIRTY: 'bg-yellow-100 text-yellow-700',
        BROKEN: 'bg-red-100 text-red-700'
    };

    const statusLabels: Record<string, string> = {
        AVAILABLE: 'Sẵn sàng',
        RESERVED: 'Đã đặt',
        ON_RENT: 'Đang thuê',
        DIRTY: 'Cần vệ sinh',
        BROKEN: 'Hỏng'
    };

    const stats = {
        total: serials.length,
        available: serials.filter(s => s.status === 'AVAILABLE').length,
        onRent: serials.filter(s => s.status === 'ON_RENT' || s.status === 'RESERVED').length,
        dirty: serials.filter(s => s.status === 'DIRTY').length,
        broken: serials.filter(s => s.status === 'BROKEN').length
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-5 border-b bg-gradient-to-r from-indigo-500 to-purple-600 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                                <Tag className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="font-bold text-lg">{t('manage_serials') || 'Quản lý Serial'}</h2>
                                <p className="text-indigo-200 text-sm">{product.name} ({product.code})</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="px-5 py-3 bg-slate-50 border-b grid grid-cols-5 gap-2">
                    <div className="text-center">
                        <p className="text-lg font-bold text-slate-700">{stats.total}</p>
                        <p className="text-[10px] text-slate-500 uppercase">Tổng</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-green-600">{stats.available}</p>
                        <p className="text-[10px] text-slate-500 uppercase">Sẵn sàng</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-blue-600">{stats.onRent}</p>
                        <p className="text-[10px] text-slate-500 uppercase">Đang thuê</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-yellow-600">{stats.dirty}</p>
                        <p className="text-[10px] text-slate-500 uppercase">Cần VS</p>
                    </div>
                    <div className="text-center">
                        <p className="text-lg font-bold text-red-600">{stats.broken}</p>
                        <p className="text-[10px] text-slate-500 uppercase">Hỏng</p>
                    </div>
                </div>

                {/* Add Serial */}
                <div className="p-4 border-b">
                    <div className="flex gap-2">
                        <div className="flex-1 relative">
                            <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={newSerial}
                                onChange={(e) => setNewSerial(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleAddSerial()}
                                placeholder={t('enter_serial_number') || 'Nhập số Serial...'}
                                className="w-full pl-10 pr-4 py-2.5 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono uppercase"
                            />
                        </div>
                        <button
                            onClick={handleAddSerial}
                            disabled={!newSerial.trim()}
                            className="px-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> {t('add')}
                        </button>
                    </div>
                </div>

                {/* Search & Filter */}
                <div className="p-4 border-b flex gap-2">
                    <div className="flex-1 relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('search') + '...'}
                            className="w-full pl-10 pr-4 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm"
                        />
                    </div>
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="px-3 py-2 border rounded-xl focus:ring-2 focus:ring-indigo-500/20 outline-none text-sm cursor-pointer"
                    >
                        <option value="ALL">{t('all')}</option>
                        <option value="AVAILABLE">Sẵn sàng</option>
                        <option value="RESERVED">Đã đặt</option>
                        <option value="ON_RENT">Đang thuê</option>
                        <option value="DIRTY">Cần vệ sinh</option>
                        <option value="BROKEN">Hỏng</option>
                    </select>
                </div>

                {/* Serial List */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="text-center py-8">
                            <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                            <p className="text-slate-500">{t('loading')}</p>
                        </div>
                    ) : filteredSerials.length === 0 ? (
                        <div className="text-center py-8">
                            <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                            <p className="text-slate-500">{t('no_serials') || 'Chưa có serial nào'}</p>
                            <p className="text-slate-400 text-sm mt-1">Thêm serial để theo dõi từng thiết bị</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {filteredSerials.map(serial => (
                                <div key={serial.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors">
                                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                                        <Scan className="w-5 h-5 text-indigo-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-mono font-bold text-slate-800">{serial.serialNumber}</p>
                                        {serial.orderId && (
                                            <p className="text-xs text-slate-500">Đơn #{serial.orderId}</p>
                                        )}
                                    </div>
                                    <select
                                        value={serial.status}
                                        onChange={(e) => handleStatusChange(serial.id, e.target.value as Serial['status'])}
                                        className={`px-2 py-1 rounded-lg text-xs font-bold ${statusColors[serial.status]} border-none cursor-pointer`}
                                    >
                                        {Object.entries(statusLabels).map(([key, label]) => (
                                            <option key={key} value={key}>{label}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => handleDeleteSerial(serial.id)}
                                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-slate-50">
                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                    >
                        {t('close')}
                    </button>
                </div>
            </div>
        </div>
    );
};
