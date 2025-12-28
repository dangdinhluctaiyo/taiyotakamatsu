import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../services/db';
import { supabase } from '../services/supabase';
import { t } from '../services/i18n';
import { Scanner as ScannerEmbed } from './Scanner';
import { InventoryHistory } from './InventoryHistory';
import { Package, Sparkles, CheckCircle, Clock, RefreshCw, Scan, MapPin, User, QrCode, History, AlertTriangle, Bell, X } from 'lucide-react';

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
    isSerialized?: boolean;
}

export const WarehouseDashboard: React.FC<Props> = ({ refreshApp }) => {
    const [activeTab, setActiveTab] = useState<'scanner' | 'prepare' | 'clean' | 'history'>('scanner');
    const [loading, setLoading] = useState(true);
    const [prepareTasks, setPrepareTasks] = useState<PrepareTask[]>([]);
    const [cleanTasks, setCleanTasks] = useState<CleanTask[]>([]);
    const [cleanQty, setCleanQty] = useState<{ [productId: number]: number }>({});
    const [showAlerts, setShowAlerts] = useState(true);

    // Compute alerts
    const alerts = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Overdue orders
        const overdueOrders = db.orders.filter(o => {
            if (o.status !== 'ACTIVE' && o.status !== 'BOOKED') return false;
            const startDate = new Date(o.rentalStartDate);
            startDate.setHours(0, 0, 0, 0);
            if (o.status === 'BOOKED' && startDate > today) return false;
            return new Date(o.expectedReturnDate) < today;
        });

        // Low stock products (stock ≤ 2 but > 0)
        const lowStock = db.products.filter(p => p.currentPhysicalStock > 0 && p.currentPhysicalStock <= 2);

        // Out of stock
        const outOfStock = db.products.filter(p => p.currentPhysicalStock === 0 && p.totalOwned > 0);

        return { overdueOrders, lowStock, outOfStock };
    }, [db.orders, db.products]);

    const totalAlerts = alerts.overdueOrders.length + alerts.lowStock.length + alerts.outOfStock.length;

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

            // Clean tasks from two sources:
            // 1. IMPORT logs without newer CLEAN logs (for quantity-based products)
            // 2. device_serials with status = DIRTY (for serialized products)

            const cleanTasksMap = new Map<number, CleanTask>();

            // Source 1: IMPORT logs (for non-serialized products)
            const recentImports = db.logs
                .filter(l => l.actionType === 'IMPORT')
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
            const cleanLogs = db.logs.filter(l => l.actionType === 'CLEAN');

            recentImports.forEach(importLog => {
                const product = db.products.find(p => p.id === importLog.productId);
                if (!product) return;

                const lastCleanForProduct = cleanLogs
                    .filter(c => c.productId === importLog.productId)
                    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];

                const importTime = new Date(importLog.timestamp);
                const cleanTime = lastCleanForProduct ? new Date(lastCleanForProduct.timestamp) : null;

                if (!cleanTime || importTime > cleanTime) {
                    const existing = cleanTasksMap.get(importLog.productId);
                    if (existing) {
                        existing.dirtyQty += importLog.quantity;
                    } else if (product) {
                        cleanTasksMap.set(importLog.productId, {
                            productId: product.id,
                            productName: product.name,
                            productCode: product.code,
                            dirtyQty: importLog.quantity,
                            location: product.location,
                            isSerialized: false
                        });
                    }
                }
            });

            setCleanTasks(Array.from(cleanTasksMap.values()).filter(t => t.dirtyQty > 0));

        } catch (e) {
            console.error('Error loading tasks:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleMarkPrepared = async (task: PrepareTask) => {
        try {
            await db.exportStock(task.orderId, task.productId, task.quantity, `Chuẩn bị đơn #${task.orderId}`);
            refreshApp();
            loadTasks();
        } catch (e: any) {
            console.error('Error preparing:', e);
        }
    };

    const handleMarkCleaned = async (task: CleanTask, quantity: number) => {
        try {
            // Create CLEAN log with the specified quantity
            await supabase.from('inventory_logs').insert({
                product_id: task.productId,
                order_id: null,
                action_type: 'CLEAN',
                quantity: quantity,
                staff_id: db.currentUser?.id,
                staff_name: db.currentUser?.name,
                note: `清掃完了 ${quantity}個 / Đã vệ sinh ${quantity} cái`
            });

            db.logs.push({
                id: Math.floor(Math.random() * 100000),
                productId: task.productId,
                orderId: 0,
                actionType: 'CLEAN',
                quantity: quantity,
                timestamp: new Date().toISOString(),
                note: `清掃完了 ${quantity}個 / Đã vệ sinh ${quantity} cái`,
                staffId: db.currentUser?.id,
                staffName: db.currentUser?.name
            });

            // Update task: if cleaned all, remove from list; otherwise reduce count
            if (quantity >= task.dirtyQty) {
                setCleanTasks(prev => prev.filter(t => t.productId !== task.productId));
            } else {
                setCleanTasks(prev => prev.map(t =>
                    t.productId === task.productId
                        ? { ...t, dirtyQty: t.dirtyQty - quantity }
                        : t
                ));
            }
            // Reset quantity selector
            setCleanQty(prev => ({ ...prev, [task.productId]: undefined as any }));
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
        { key: 'scanner', label: t('nav_scanner') || 'Quét QR', icon: QrCode, count: 0 },
        { key: 'prepare', label: t('to_prepare') || 'Chuẩn bị', icon: Package, count: prepareTasks.length },
        { key: 'clean', label: t('to_clean') || 'Vệ sinh', icon: Sparkles, count: cleanTasks.length },
        { key: 'history', label: t('nav_history') || 'Lịch sử', icon: History, count: 0 },
    ];

    return (
        <div className="h-screen flex flex-col bg-gray-50 md:block md:h-auto md:min-h-screen">
            {/* Fixed Header - Compact */}
            <div className="flex-shrink-0 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 pt-4 pb-16">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-lg font-bold">{t('warehouse_dashboard') || 'Quản lý Kho'}</h1>
                        <p className="text-indigo-200 text-xs mt-0.5">{t('warehouse_tasks_desc') || 'Xuất nhập & vệ sinh thiết bị'}</p>
                    </div>
                    <button
                        onClick={loadTasks}
                        className="p-2.5 bg-white/20 rounded-xl hover:bg-white/30 transition-colors"
                    >
                        <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Alerts Banner */}
            {showAlerts && totalAlerts > 0 && (
                <div className="mx-4 -mt-8 mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 relative z-10 shadow-sm">
                    <button
                        onClick={() => setShowAlerts(false)}
                        className="absolute top-2 right-2 p-1 text-amber-600 hover:text-amber-800"
                    >
                        <X className="w-4 h-4" />
                    </button>
                    <div className="flex items-start gap-3">
                        <Bell className="w-5 h-5 text-amber-600 mt-0.5" />
                        <div className="text-sm space-y-1">
                            {alerts.overdueOrders.length > 0 && (
                                <p className="text-red-700">
                                    ⚠️ <b>{alerts.overdueOrders.length}</b> đơn quá hạn
                                </p>
                            )}
                            {alerts.outOfStock.length > 0 && (
                                <p className="text-red-600">
                                    🚫 <b>{alerts.outOfStock.length}</b> SP hết hàng
                                </p>
                            )}
                            {alerts.lowStock.length > 0 && (
                                <p className="text-amber-700">
                                    📦 <b>{alerts.lowStock.length}</b> SP sắp hết
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Fixed Tabs and Content */}
            <div className="flex-1 flex flex-col -mt-10 overflow-hidden md:overflow-visible">
                <div className="px-4 flex-shrink-0">
                    <div className="max-w-2xl mx-auto">
                        {/* Tabs - Modern Segmented Control */}
                        <div className="bg-white rounded-2xl shadow-lg p-1.5 flex gap-1">
                            {tabs.map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key as any)}
                                    className={`flex-1 py-3 px-2 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${activeTab === tab.key
                                        ? 'bg-indigo-600 text-white shadow-md'
                                        : 'text-gray-500 hover:bg-gray-100'
                                        }`}
                                >
                                    <tab.icon className="w-5 h-5" />
                                    <span className="hidden sm:inline">{tab.label}</span>
                                    {tab.count > 0 && (
                                        <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center ${activeTab === tab.key
                                            ? 'bg-white text-indigo-600'
                                            : 'bg-red-500 text-white'
                                            }`}>
                                            {tab.count}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Scrollable Content Area */}
                <div className="flex-1 overflow-y-auto px-4 pt-4 pb-28 md:pb-8">
                    <div className="max-w-2xl mx-auto space-y-4">

                        {/* Scanner Tab */}
                        {activeTab === 'scanner' && (
                            <div className="bg-white rounded-2xl shadow-lg">
                                <ScannerEmbed refreshApp={refreshApp} />
                            </div>
                        )}

                        {/* Prepare Tab */}
                        {activeTab === 'prepare' && (
                            <div className="space-y-3">
                                {loading ? (
                                    <LoadingCard />
                                ) : prepareTasks.length === 0 ? (
                                    <EmptyCard
                                        icon={<CheckCircle className="w-12 h-12 text-green-500" />}
                                        title={t('no_tasks') || 'Không có việc cần làm'}
                                        subtitle={t('all_prepared') || 'Tất cả đơn hàng đã được chuẩn bị'}
                                    />
                                ) : (
                                    prepareTasks.map((task, idx) => {
                                        const daysUntil = getDaysUntil(task.rentalStartDate);
                                        const isUrgent = daysUntil <= 1;

                                        return (
                                            <div key={idx} className={`bg-white rounded-2xl shadow-sm overflow-hidden ${isUrgent ? 'ring-2 ring-red-400' : ''}`}>
                                                {/* Urgency Bar */}
                                                <div className={`h-1 ${isUrgent ? 'bg-red-500' : daysUntil <= 2 ? 'bg-amber-400' : 'bg-green-400'}`} />

                                                <div className="p-4">
                                                    <div className="flex items-start gap-3">
                                                        {/* Icon */}
                                                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isUrgent ? 'bg-red-100' : 'bg-amber-100'}`}>
                                                            <Package className={`w-6 h-6 ${isUrgent ? 'text-red-600' : 'text-amber-600'}`} />
                                                        </div>

                                                        {/* Content */}
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-start justify-between">
                                                                <div>
                                                                    <h3 className="font-bold text-gray-900 text-base">{task.productName}</h3>
                                                                    <p className="text-xs text-gray-400 font-mono">{task.productCode}</p>
                                                                </div>
                                                                <div className="text-right ml-2">
                                                                    <p className="text-2xl font-bold text-indigo-600">×{task.quantity}</p>
                                                                </div>
                                                            </div>

                                                            {/* Tags */}
                                                            <div className="flex flex-wrap gap-2 mt-3">
                                                                <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg font-medium ${isUrgent
                                                                    ? 'bg-red-100 text-red-700'
                                                                    : 'bg-gray-100 text-gray-600'
                                                                    }`}>
                                                                    <Clock className="w-3.5 h-3.5" />
                                                                    {isUrgent ? (t('today') + '!') : `${daysUntil} ${t('days_left') || 'ngày'}`}
                                                                </span>
                                                                <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2.5 py-1 rounded-lg font-medium">
                                                                    <User className="w-3.5 h-3.5" />
                                                                    {task.customerName}
                                                                </span>
                                                                {task.location && (
                                                                    <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-lg font-medium font-mono">
                                                                        <MapPin className="w-3.5 h-3.5" />
                                                                        {task.location}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Action Button */}
                                                    <button
                                                        onClick={() => handleMarkPrepared(task)}
                                                        className="w-full mt-4 py-3 bg-green-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-green-600 active:scale-[0.98] transition-all shadow-sm"
                                                    >
                                                        <CheckCircle className="w-5 h-5" />
                                                        {t('prepare') || 'Đã chuẩn bị xong'}
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
                                    <LoadingCard />
                                ) : cleanTasks.length === 0 ? (
                                    <EmptyCard
                                        icon={<Sparkles className="w-12 h-12 text-blue-500" />}
                                        title={t('no_dirty_items') || 'Không có thiết bị bẩn'}
                                        subtitle={t('all_cleaned') || 'Tất cả đã được vệ sinh sạch sẽ'}
                                    />
                                ) : (
                                    cleanTasks.map((task, idx) => (
                                        <div key={idx} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                                            {/* Blue accent bar */}
                                            <div className="h-1 bg-blue-500" />

                                            <div className="p-4">
                                                <div className="flex items-start gap-3">
                                                    {/* Icon */}
                                                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                                                        <Sparkles className="w-6 h-6 text-blue-600" />
                                                    </div>

                                                    {/* Content */}
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between">
                                                            <div>
                                                                <h3 className="font-bold text-gray-900 text-base">{task.productName}</h3>
                                                                <p className="text-xs text-gray-400 font-mono">{task.productCode}</p>
                                                            </div>
                                                            <div className="text-right ml-2">
                                                                <p className="text-xs text-gray-400">{t('dirty_qty') || 'Cần VS'}</p>
                                                                <p className="text-2xl font-bold text-blue-600">×{task.dirtyQty}</p>
                                                            </div>
                                                        </div>

                                                        {/* Location tag */}
                                                        {task.location && (
                                                            <div className="mt-3">
                                                                <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2.5 py-1 rounded-lg font-medium font-mono">
                                                                    <MapPin className="w-3.5 h-3.5" />
                                                                    {task.location}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Quantity Selector and Actions */}
                                                <div className="mt-4 space-y-3">
                                                    {/* Quantity stepper */}
                                                    <div className="flex items-center justify-center gap-3">
                                                        <button
                                                            onClick={() => setCleanQty(prev => ({ ...prev, [task.productId]: Math.max(1, (prev[task.productId] || task.dirtyQty) - 1) }))}
                                                            className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-lg font-bold hover:bg-gray-200"
                                                        >
                                                            −
                                                        </button>
                                                        <div className="text-center">
                                                            <p className="text-2xl font-bold text-blue-600">{cleanQty[task.productId] || task.dirtyQty}</p>
                                                            <p className="text-[10px] text-gray-400">/ {task.dirtyQty}</p>
                                                        </div>
                                                        <button
                                                            onClick={() => setCleanQty(prev => ({ ...prev, [task.productId]: Math.min(task.dirtyQty, (prev[task.productId] || task.dirtyQty) + 1) }))}
                                                            className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-lg font-bold hover:bg-gray-200"
                                                        >
                                                            +
                                                        </button>
                                                    </div>

                                                    {/* Clean buttons */}
                                                    <div className="flex gap-2">
                                                        <button
                                                            onClick={() => handleMarkCleaned(task, cleanQty[task.productId] || task.dirtyQty)}
                                                            className="flex-1 py-3 bg-blue-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-600 active:scale-[0.98] transition-all"
                                                        >
                                                            <Sparkles className="w-4 h-4" />
                                                            {t('clean_all') || 'Vệ sinh'} ({cleanQty[task.productId] || task.dirtyQty})
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* History Tab */}
                        {activeTab === 'history' && (
                            <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
                                <InventoryHistory refreshApp={refreshApp} embedded />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Helper Components
const LoadingCard = () => (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <RefreshCw className="w-8 h-8 text-gray-300 mx-auto mb-3 animate-spin" />
        <p className="text-gray-400 text-sm">{t('loading') || 'Đang tải...'}</p>
    </div>
);

const EmptyCard: React.FC<{ icon: React.ReactNode; title: string; subtitle: string }> = ({ icon, title, subtitle }) => (
    <div className="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div className="mb-4">{icon}</div>
        <p className="text-gray-700 font-semibold">{title}</p>
        <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
    </div>
);
