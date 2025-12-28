import React, { useMemo, useState, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { BarChart3, TrendingUp, Package, ShoppingCart, Calendar, DollarSign, AlertTriangle, CheckCircle, Download, FileSpreadsheet, Database, Upload } from 'lucide-react';

interface AnalyticsDashboardProps {
    refreshApp?: () => void;
}

/**
 * Analytics Dashboard - Statistics and charts for management
 */
export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ refreshApp }) => {
    const [exporting, setExporting] = useState(false);
    const [importStatus, setImportStatus] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Export products to CSV
    const exportProductsCSV = () => {
        const headers = ['Code', 'Name', 'Category', 'TotalOwned', 'CurrentStock', 'OnRent', 'PricePerDay'];
        const rows = db.products.map(p => [
            p.code,
            p.name,
            p.category,
            p.totalOwned,
            p.currentPhysicalStock,
            p.totalOwned - p.currentPhysicalStock,
            p.pricePerDay
        ]);
        downloadCSV([headers, ...rows], 'products_inventory.csv');
    };

    // Export logs to CSV
    const exportLogsCSV = () => {
        const headers = ['Date', 'ProductCode', 'ProductName', 'ActionType', 'Quantity', 'Note'];
        const rows = db.logs.slice(-500).map(l => {
            const product = db.products.find(p => p.id === l.productId);
            return [
                new Date(l.timestamp).toLocaleString('vi-VN'),
                product?.code || '',
                product?.name || '',
                l.actionType,
                l.quantity,
                l.note || ''
            ];
        });
        downloadCSV([headers, ...rows], 'inventory_logs.csv');
    };

    // Export full backup JSON
    const exportBackup = () => {
        const backup = {
            exportedAt: new Date().toISOString(),
            products: db.products,
            orders: db.orders,
            customers: db.customers,
            logs: db.logs,
            staff: db.staff.map(s => ({ ...s, password: '***' })) // Don't export real passwords
        };
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `taiyotakamatsu_backup_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Import backup from JSON file
    const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const backup = JSON.parse(e.target?.result as string);

                if (!backup.products || !backup.exportedAt) {
                    setImportStatus('❌ File không hợp lệ');
                    setTimeout(() => setImportStatus(null), 3000);
                    return;
                }

                const confirmed = window.confirm(
                    `Nhập backup từ ${new Date(backup.exportedAt).toLocaleString()}?\n\n` +
                    `Sản phẩm: ${backup.products?.length || 0}\n` +
                    `Khách hàng: ${backup.customers?.length || 0}\n\n` +
                    `⚠️ Dữ liệu mới sẽ được merge.`
                );

                if (!confirmed) return;

                let addedProducts = 0;
                if (backup.products) {
                    for (const p of backup.products) {
                        if (!db.products.find(ep => ep.code === p.code)) {
                            db.products.push(p);
                            addedProducts++;
                        }
                    }
                }

                setImportStatus(`✅ Đã thêm ${addedProducts} sản phẩm mới`);
                setTimeout(() => setImportStatus(null), 3000);
                refreshApp?.();
            } catch {
                setImportStatus('❌ Lỗi đọc file');
                setTimeout(() => setImportStatus(null), 3000);
            }
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Helper to download CSV
    const downloadCSV = (data: (string | number)[][], filename: string) => {
        const csv = data.map(row => row.map(cell =>
            typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
        ).join(',')).join('\\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Calculate statistics
    const stats = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const thisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

        // Orders stats
        const activeOrders = db.orders.filter(o => o.status === 'ACTIVE' ||
            (o.status === 'BOOKED' && new Date(o.rentalStartDate) <= today));
        const overdueOrders = activeOrders.filter(o => new Date(o.expectedReturnDate) < today);
        const completedThisMonth = db.orders.filter(o =>
            o.status === 'COMPLETED' && new Date(o.rentalStartDate) >= thisMonth);

        // Products stats
        const totalProducts = db.products.length;
        const lowStockProducts = db.products.filter(p => p.currentPhysicalStock > 0 && p.currentPhysicalStock <= 2);
        const outOfStockProducts = db.products.filter(p => p.currentPhysicalStock === 0);
        const totalAssets = db.products.reduce((sum, p) => sum + p.totalOwned, 0);
        const onRent = db.products.reduce((sum, p) => sum + (p.totalOwned - p.currentPhysicalStock), 0);

        // Revenue estimate (from completed orders this month)
        const monthlyRevenue = completedThisMonth.reduce((sum, o) => sum + (o.finalAmount || o.totalAmount), 0);

        // Transactions this month
        const transactionsThisMonth = db.logs.filter(l => new Date(l.timestamp) >= thisMonth);
        const exportsThisMonth = transactionsThisMonth.filter(l => l.actionType === 'EXPORT').length;
        const importsThisMonth = transactionsThisMonth.filter(l => l.actionType === 'IMPORT').length;

        // Top products by rental frequency
        const productRentals: Record<number, number> = {};
        db.orders.forEach(order => {
            order.items.forEach(item => {
                productRentals[item.productId] = (productRentals[item.productId] || 0) + item.quantity;
            });
        });
        const topProducts = Object.entries(productRentals)
            .map(([id, count]) => ({
                product: db.products.find(p => p.id === Number(id)),
                count
            }))
            .filter(x => x.product)
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        return {
            activeOrders: activeOrders.length,
            overdueOrders: overdueOrders.length,
            completedThisMonth: completedThisMonth.length,
            totalProducts,
            lowStockProducts: lowStockProducts.length,
            outOfStockProducts: outOfStockProducts.length,
            totalAssets,
            onRent,
            monthlyRevenue,
            exportsThisMonth,
            importsThisMonth,
            topProducts
        };
    }, [db.orders, db.products, db.logs]);

    // Format currency
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('vi-VN').format(amount) + ' đ';
    };

    return (
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <BarChart3 className="w-7 h-7 text-indigo-600" />
                        {t('dashboard_title') || 'Dashboard Thống kê'}
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Tổng quan hoạt động kinh doanh</p>
                </div>
                {/* Export Buttons */}
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={exportProductsCSV}
                        className="flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Xuất SP
                    </button>
                    <button
                        onClick={exportLogsCSV}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Xuất Logs
                    </button>
                    <button
                        onClick={exportBackup}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors"
                    >
                        <Database className="w-4 h-4" />
                        Backup
                    </button>
                    <label className="flex items-center gap-2 px-3 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors cursor-pointer">
                        <Upload className="w-4 h-4" />
                        Import
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".json"
                            onChange={handleImportBackup}
                            className="hidden"
                        />
                    </label>
                </div>
                {importStatus && (
                    <p className="text-sm font-medium mt-2">{importStatus}</p>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Active Orders */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                            <ShoppingCart className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800">{stats.activeOrders}</p>
                            <p className="text-xs text-slate-500">Đang thuê</p>
                        </div>
                    </div>
                </div>

                {/* Overdue */}
                <div className={`rounded-2xl p-4 shadow-sm border ${stats.overdueOrders > 0 ? 'bg-red-50 border-red-100' : 'bg-white border-slate-100'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stats.overdueOrders > 0 ? 'bg-red-100' : 'bg-slate-100'}`}>
                            <AlertTriangle className={`w-5 h-5 ${stats.overdueOrders > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                        </div>
                        <div>
                            <p className={`text-2xl font-bold ${stats.overdueOrders > 0 ? 'text-red-600' : 'text-slate-800'}`}>{stats.overdueOrders}</p>
                            <p className="text-xs text-slate-500">Quá hạn</p>
                        </div>
                    </div>
                </div>

                {/* On Rent */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                            <Package className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-800">{stats.onRent}</p>
                            <p className="text-xs text-slate-500">TB đang cho thuê</p>
                        </div>
                    </div>
                </div>

                {/* Revenue */}
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-4 shadow-lg text-white">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <p className="text-lg font-bold">{formatCurrency(stats.monthlyRevenue)}</p>
                            <p className="text-xs text-white/70">Doanh thu tháng này</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Second Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Inventory Status */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-indigo-500" />
                        Tình trạng kho
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-600">Tổng sản phẩm</span>
                            <span className="font-bold text-slate-800">{stats.totalProducts}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-600">Tổng tài sản</span>
                            <span className="font-bold text-slate-800">{stats.totalAssets} đơn vị</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-amber-600 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" /> Sắp hết
                            </span>
                            <span className="font-bold text-amber-600">{stats.lowStockProducts}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-red-600 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" /> Hết hàng
                            </span>
                            <span className="font-bold text-red-600">{stats.outOfStockProducts}</span>
                        </div>
                    </div>
                </div>

                {/* This Month Activity */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-500" />
                        Hoạt động tháng này
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-emerald-50 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-emerald-600">{stats.completedThisMonth}</p>
                            <p className="text-xs text-emerald-700">Đơn hoàn thành</p>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-blue-600">{stats.exportsThisMonth + stats.importsThisMonth}</p>
                            <p className="text-xs text-blue-700">Giao dịch kho</p>
                        </div>
                    </div>
                    <div className="mt-4 flex gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-red-400 rounded-full"></span>
                            <span className="text-slate-600">Xuất: {stats.exportsThisMonth}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                            <span className="text-slate-600">Nhập: {stats.importsThisMonth}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Products */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-500" />
                    Top sản phẩm cho thuê nhiều nhất
                </h3>
                {stats.topProducts.length > 0 ? (
                    <div className="space-y-3">
                        {stats.topProducts.map((item, index) => (
                            <div key={item.product?.id} className="flex items-center gap-4">
                                <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                    index === 1 ? 'bg-slate-200 text-slate-700' :
                                        index === 2 ? 'bg-orange-100 text-orange-700' :
                                            'bg-slate-100 text-slate-500'
                                    }`}>
                                    #{index + 1}
                                </span>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-800 truncate">{item.product?.name}</p>
                                    <p className="text-xs text-slate-500">{item.product?.code}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-indigo-600">{item.count}</p>
                                    <p className="text-xs text-slate-500">lần thuê</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-slate-500 text-center py-4">Chưa có dữ liệu</p>
                )}
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
