import React, { useState, useEffect } from 'react';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { Scanner as ScannerEmbed } from './Scanner';
import { Warehouse, Package, Sparkles, Wrench, CheckCircle, Clock, AlertTriangle, ChevronRight, RefreshCw, Scan } from 'lucide-react';

interface Props {
    refreshApp: () => void;
}

interface PrepareTask {
    orderId: number;
    customerName: string;
    rentalStartDate: string;
    productId: number;
    productName: string;
    productCode: string;
    quantity: number;
    location?: string;
}

interface CleanTask {
    productId: number;
    productName: string;
    productCode: string;
    dirtyQty: number;
    location?: string;
}

export const WarehouseDashboard: React.FC<Props> = ({ refreshApp }) => {
    const [activeTab, setActiveTab] = useState<'scanner' | 'prepare' | 'clean'>('scanner');
    const [loading, setLoading] = useState(true);
    const [prepareTasks, setPrepareTasks] = useState<PrepareTask[]>([]);
    const [cleanTasks, setCleanTasks] = useState<CleanTask[]>([]);

    useEffect(() => {
        loadTasks();
    }, []);

    const loadTasks = async () => {
        setLoading(true);
        try {
            // Get orders that need preparation (BOOKED, starting within 3 days)
            const today = new Date();
            const threeDaysLater = new Date(today);
            threeDaysLater.setDate(today.getDate() + 3);

            const prepTasks: PrepareTask[] = [];
            db.orders
                .filter(o => o.status === 'BOOKED')
                .filter(o => {
                    const startDate = new Date(o.rentalStartDate);
                    return startDate >= today && startDate <= threeDaysLater;
                })
                .forEach(order => {
                    const customer = db.customers.find(c => c.id === order.customerId);
                    order.items.forEach(item => {
                        if (!item.isExternal && (item.exportedQuantity || 0) < item.quantity) {
                            const product = db.products.find(p => p.id === item.productId);
                            if (product) {
                                prepTasks.push({
                                    orderId: order.id,
                                    customerName: customer?.name || 'Unknown',
                                    rentalStartDate: order.rentalStartDate,
                                    productId: product.id,
                                    productName: product.name,
                                    productCode: product.code,
                                    quantity: item.quantity - (item.exportedQuantity || 0),
                                    location: product.location
                                });
                            }
                        }
                    });
                });
            setPrepareTasks(prepTasks);

            // For clean tasks, check products with IMPORT logs that don't have a more recent CLEAN log
            const cleanTasksData: CleanTask[] = [];

            // Get all products with recent IMPORT logs
            const recentImports = db.logs
                .filter(l => l.actionType === 'IMPORT')
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

            // Get all CLEAN logs for reference
            const cleanLogs = db.logs.filter(l => l.actionType === 'CLEAN');

            // Build dirty quantity map, only counting IMPORTs that don't have a newer CLEAN
            const productDirtyMap = new Map<number, { qty: number; lastImportTime: Date }>();

            recentImports.forEach(importLog => {
                const lastCleanForProduct = cleanLogs
                    .filter(c => c.productId === importLog.productId)
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

                const importTime = new Date(importLog.timestamp);
                const cleanTime = lastCleanForProduct ? new Date(lastCleanForProduct.timestamp) : null;

                // Only count if no CLEAN log exists, or IMPORT is more recent than CLEAN
                if (!cleanTime || importTime > cleanTime) {
                    const existing = productDirtyMap.get(importLog.productId);
                    if (existing) {
                        existing.qty += importLog.quantity;
                    } else {
                        productDirtyMap.set(importLog.productId, { qty: importLog.quantity, lastImportTime: importTime });
                    }
                }
            });

            productDirtyMap.forEach(({ qty }, productId) => {
                const product = db.products.find(p => p.id === productId);
                if (product && qty > 0) {
                    cleanTasksData.push({
                        productId: product.id,
                        productName: product.name,
                        productCode: product.code,
                        dirtyQty: qty,
                        location: product.location
                    });
                }
            });
            setCleanTasks(cleanTasksData);

        } catch (e) {
            console.error('Error loading tasks:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkPrepared = async (task: PrepareTask) => {
        // This would ideally call a prepare API
        // For now, we just refresh and show feedback
        try {
            await db.exportStock(task.orderId, task.productId, task.quantity, `Chuẩn bị đơn #${task.orderId}`);
            refreshApp();
            loadTasks();
        } catch (e: any) {
            console.error('Error preparing:', e);
        }
    };

    const handleMarkCleaned = async (task: CleanTask) => {
        try {
            // Save clean log to Supabase via db service
            const { supabase } = await import('../services/supabase');
            await supabase.from('inventory_logs').insert({
                product_id: task.productId,
                order_id: null,
                action_type: 'CLEAN',
                quantity: task.dirtyQty,
                staff_id: db.currentUser?.id,
                staff_name: db.currentUser?.name,
                note: '清掃完了 / Đã vệ sinh'
            });

            // Update local logs
            db.logs.push({
                id: Math.floor(Math.random() * 100000),
                productId: task.productId,
                orderId: 0,
                actionType: 'CLEAN',
                quantity: task.dirtyQty,
                timestamp: new Date().toISOString(),
                note: '清掃完了 / Đã vệ sinh',
                staffId: db.currentUser?.id,
                staffName: db.currentUser?.name
            });

            // Remove this task from the list immediately
            setCleanTasks(prev => prev.filter(t => t.productId !== task.productId));

            refreshApp();
        } catch (e) {
            console.error('Error marking cleaned:', e);
        }
    };

    const getDaysUntil = (dateStr: string) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(dateStr);
        target.setHours(0, 0, 0, 0);
        return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    };

    const tabs = [
        { key: 'scanner', label: t('nav_scanner') || 'Quét QR', icon: Scan, count: 0, color: 'purple' },
        { key: 'prepare', label: t('to_prepare') || 'Chuẩn bị', icon: Package, count: prepareTasks.length, color: 'orange' },
        { key: 'clean', label: t('to_clean') || 'Vệ sinh', icon: Sparkles, count: cleanTasks.length, color: 'blue' },
    ];

    return (
        <div className="min-h-screen bg-stone-50">
            {/* Header */}
            <div className="bg-white border-b border-stone-200 px-4 py-5 md:px-8">
                <div className="max-w-5xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-xl font-semibold text-stone-800">{t('warehouse_dashboard') || 'Kho hàng'}</h1>
                            <p className="text-stone-400 text-sm mt-0.5">{t('warehouse_tasks_desc') || 'Quản lý xuất nhập kho'}</p>
                        </div>
                        <button
                            onClick={loadTasks}
                            className="p-2 rounded-lg hover:bg-stone-100 transition-colors text-stone-500"
                        >
                            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="px-4 md:px-8 py-4 pb-24 md:pb-8">
                <div className="max-w-5xl mx-auto space-y-4">

                    {/* Tabs */}
                    <div className="bg-white rounded-lg border border-stone-200 p-1.5 flex gap-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key as any)}
                                className={`flex-1 py-2.5 px-3 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${activeTab === tab.key
                                    ? 'bg-stone-900 text-white'
                                    : 'text-stone-600 hover:bg-stone-100'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                <span className="hidden md:inline">{tab.label}</span>
                                {tab.count > 0 && (
                                    <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${activeTab === tab.key ? 'bg-white/20' : 'bg-stone-200'
                                        }`}>
                                        {tab.count}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Prepare Tab */}
                    {activeTab === 'prepare' && (
                        <div className="space-y-3">
                            {loading ? (
                                <div className="bg-white rounded-lg border border-stone-200 p-8 text-center">
                                    <RefreshCw className="w-6 h-6 text-stone-300 mx-auto mb-2 animate-spin" />
                                    <p className="text-stone-400 text-sm">{t('loading')}</p>
                                </div>
                            ) : prepareTasks.length === 0 ? (
                                <div className="bg-white rounded-lg border border-stone-200 p-8 text-center">
                                    <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
                                    <p className="text-stone-600 font-medium">{t('no_tasks') || 'Không có việc cần làm'}</p>
                                    <p className="text-stone-400 text-sm mt-1">{t('all_prepared')}</p>
                                </div>
                            ) : (
                                prepareTasks.map((task, idx) => {
                                    const daysUntil = getDaysUntil(task.rentalStartDate);
                                    const isUrgent = daysUntil <= 1;

                                    return (
                                        <div key={idx} className={`bg-white rounded-lg border ${isUrgent ? 'border-red-200' : 'border-stone-200'} p-4`}>
                                            <div className="flex items-start gap-3">
                                                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isUrgent ? 'bg-red-50' : 'bg-amber-50'}`}>
                                                    <Package className={`w-5 h-5 ${isUrgent ? 'text-red-500' : 'text-amber-500'}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div>
                                                            <h3 className="font-medium text-stone-800">{task.productName}</h3>
                                                            <p className="text-xs text-stone-400">{task.productCode}</p>
                                                        </div>
                                                        <div className="text-right shrink-0">
                                                            <p className="text-xl font-semibold text-stone-700">x{task.quantity}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        <span className="inline-flex items-center gap-1 text-[11px] bg-stone-100 text-stone-500 px-2 py-1 rounded-md">
                                                            <Clock className="w-3 h-3" />
                                                            {isUrgent ? (
                                                                <span className="text-red-500 font-medium">{t('today')}!</span>
                                                            ) : (
                                                                `${daysUntil} ${t('days_left')}`
                                                            )}
                                                        </span>
                                                        <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg">
                                                            #{task.orderId} - {task.customerName}
                                                        </span>
                                                        {task.location && (
                                                            <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg font-mono">
                                                                📍 {task.location}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleMarkPrepared(task)}
                                                    className="p-3 bg-green-500 text-white rounded-xl hover:bg-green-600 active:scale-95 transition-all"
                                                >
                                                    <CheckCircle className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* Clean Tab */}
                    {activeTab === 'clean' && (
                        <div className="space-y-3">
                            {loading ? (
                                <div className="bg-white rounded-2xl p-8 text-center">
                                    <RefreshCw className="w-8 h-8 text-slate-300 mx-auto mb-2 animate-spin" />
                                    <p className="text-slate-500">{t('loading')}</p>
                                </div>
                            ) : cleanTasks.length === 0 ? (
                                <div className="bg-white rounded-2xl p-8 text-center">
                                    <Sparkles className="w-12 h-12 text-blue-500 mx-auto mb-3" />
                                    <p className="text-slate-600 font-medium">{t('no_dirty_items') || 'Không có thiết bị bẩn'}</p>
                                    <p className="text-slate-400 text-sm mt-1">{t('all_cleaned')}</p>
                                </div>
                            ) : (
                                cleanTasks.map((task, idx) => (
                                    <div key={idx} className="bg-white rounded-2xl shadow-sm border-l-4 border-blue-400 p-4">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                                                <Sparkles className="w-6 h-6 text-blue-600" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-bold text-slate-800">{task.productName}</h3>
                                                <div className="flex gap-2 mt-1">
                                                    <span className="text-xs text-slate-500">{task.productCode}</span>
                                                    {task.location && (
                                                        <span className="text-xs text-indigo-500 font-mono">📍 {task.location}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-slate-400">{t('dirty_qty') || 'SL Bẩn'}</p>
                                                <p className="text-xl font-bold text-blue-600">{task.dirtyQty}</p>
                                            </div>
                                            <button
                                                onClick={() => handleMarkCleaned(task)}
                                                className="p-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 active:scale-95 transition-all"
                                            >
                                                <CheckCircle className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* Scanner Tab - Embedded Scanner */}
                    {activeTab === 'scanner' && (
                        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                            <ScannerEmbed refreshApp={refreshApp} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
