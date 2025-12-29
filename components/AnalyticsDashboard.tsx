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

    // Export products to HTML
    const exportProductsHTML = () => {
        const now = new Date();
        const html = `<!DOCTYPE html>
<html><head>
    <meta charset="UTF-8">
    <title>Danh sách sản phẩm - ${now.toLocaleDateString('ja-JP')}</title>
    <style>
        body { font-family: -apple-system, sans-serif; padding: 20px; background: #f8fafc; }
        h1 { font-size: 20px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th { background: #4f46e5; color: white; padding: 12px; text-align: left; font-size: 12px; }
        td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
        tr:hover { background: #f1f5f9; }
        .code { font-family: monospace; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
        .stock-ok { color: #16a34a; font-weight: 600; }
        .stock-low { color: #ea580c; font-weight: 600; }
        .stock-out { color: #dc2626; font-weight: 600; }
        .total { font-size: 14px; color: #64748b; margin-bottom: 16px; }
    </style>
</head><body>
    <h1>📦 Danh sách sản phẩm</h1>
    <p class="total">Tổng: ${db.products.length} sản phẩm | Xuất: ${now.toLocaleString('ja-JP')}</p>
    <table>
        <thead><tr><th>Mã SP</th><th>Tên sản phẩm</th><th>Danh mục</th><th>Tổng SL</th><th>Tồn kho</th><th>Đang thuê</th><th>Vị trí</th></tr></thead>
        <tbody>${db.products.map(p => `<tr>
            <td><span class="code">${p.code}</span></td>
            <td>${p.name}</td>
            <td>${p.category || '-'}</td>
            <td>${p.totalOwned}</td>
            <td class="${p.currentPhysicalStock === 0 ? 'stock-out' : p.currentPhysicalStock <= 2 ? 'stock-low' : 'stock-ok'}">${p.currentPhysicalStock}</td>
            <td>${p.totalOwned - p.currentPhysicalStock}</td>
            <td>${p.location || '-'}</td>
        </tr>`).join('')}</tbody>
    </table>
</body></html>`;
        downloadHTML(html, `products_${now.toISOString().split('T')[0]}.html`);
    };

    // Export logs to HTML
    const exportLogsHTML = () => {
        const now = new Date();
        const recentLogs = db.logs.slice(-500).reverse();
        const html = `<!DOCTYPE html>
<html><head>
    <meta charset="UTF-8">
    <title>Lịch sử hoạt động - ${now.toLocaleDateString('ja-JP')}</title>
    <style>
        body { font-family: -apple-system, sans-serif; padding: 20px; background: #f8fafc; }
        h1 { font-size: 20px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        th { background: #4f46e5; color: white; padding: 12px; text-align: left; font-size: 12px; }
        td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; }
        tr:hover { background: #f1f5f9; }
        .export { background: #fef3c7; color: #b45309; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .import { background: #dcfce7; color: #16a34a; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .clean { background: #dbeafe; color: #2563eb; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
        .total { font-size: 14px; color: #64748b; margin-bottom: 16px; }
        .qty { font-weight: 600; color: #1e293b; }
    </style>
</head><body>
    <h1>📋 Lịch sử hoạt động</h1>
    <p class="total">500 hoạt động gần nhất | Xuất: ${now.toLocaleString('ja-JP')}</p>
    <table>
        <thead><tr><th>Thời gian</th><th>Loại</th><th>Mã SP</th><th>Tên sản phẩm</th><th>SL</th><th>Nhân viên</th><th>Ghi chú</th></tr></thead>
        <tbody>${recentLogs.map(l => {
            const product = db.products.find(p => p.id === l.productId);
            const typeClass = l.actionType === 'EXPORT' ? 'export' : l.actionType === 'IMPORT' ? 'import' : 'clean';
            const typeLabel = l.actionType === 'EXPORT' ? '📤 Xuất' : l.actionType === 'IMPORT' ? '📥 Nhập' : '🧹 VS';
            return `<tr>
                <td>${new Date(l.timestamp).toLocaleString('ja-JP')}</td>
                <td><span class="${typeClass}">${typeLabel}</span></td>
                <td>${product?.code || '-'}</td>
                <td>${product?.name || '-'}</td>
                <td class="qty">×${l.quantity}</td>
                <td>${l.staffName || '-'}</td>
                <td>${l.note || '-'}</td>
            </tr>`;
        }).join('')}</tbody>
    </table>
</body></html>`;
        downloadHTML(html, `logs_${now.toISOString().split('T')[0]}.html`);
    };

    // Helper to download HTML
    const downloadHTML = (html: string, filename: string) => {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Export products to CSV (editable in Excel)
    const exportProductsCSV = () => {
        const BOM = '\uFEFF'; // UTF-8 BOM for Excel
        const headers = ['code', 'name', 'category', 'totalOwned', 'currentPhysicalStock', 'location', 'pricePerDay'];
        const rows = db.products.map(p => [
            p.code,
            `"${p.name.replace(/"/g, '""')}"`,
            `"${(p.category || '').replace(/"/g, '""')}"`,
            p.totalOwned,
            p.currentPhysicalStock,
            `"${(p.location || '').replace(/"/g, '""')}"`,
            p.pricePerDay
        ].join(','));
        const csv = BOM + [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `products_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Import products from CSV
    const productCsvInputRef = useRef<HTMLInputElement>(null);
    const handleImportProductsCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                const lines = text.split('\n').filter(l => l.trim());
                if (lines.length < 2) {
                    setImportStatus('❌ File rỗng hoặc không hợp lệ');
                    setTimeout(() => setImportStatus(null), 3000);
                    return;
                }

                // Parse header
                const headerLine = lines[0].toLowerCase();
                const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
                const codeIdx = headers.findIndex(h => h === 'code');
                const nameIdx = headers.findIndex(h => h === 'name');
                const categoryIdx = headers.findIndex(h => h === 'category');
                const totalOwnedIdx = headers.findIndex(h => h === 'totalowned');
                const stockIdx = headers.findIndex(h => h === 'currentphysicalstock');
                const locationIdx = headers.findIndex(h => h === 'location');

                if (codeIdx === -1 || nameIdx === -1) {
                    setImportStatus('❌ Thiếu cột code hoặc name');
                    setTimeout(() => setImportStatus(null), 3000);
                    return;
                }

                // Parse CSV with quotes handling
                const parseCSVLine = (line: string): string[] => {
                    const result: string[] = [];
                    let current = '';
                    let inQuotes = false;
                    for (let i = 0; i < line.length; i++) {
                        const char = line[i];
                        if (char === '"') {
                            if (inQuotes && line[i + 1] === '"') {
                                current += '"';
                                i++;
                            } else {
                                inQuotes = !inQuotes;
                            }
                        } else if (char === ',' && !inQuotes) {
                            result.push(current.trim());
                            current = '';
                        } else {
                            current += char;
                        }
                    }
                    result.push(current.trim());
                    return result;
                };

                let updated = 0;
                let added = 0;

                for (let i = 1; i < lines.length; i++) {
                    const values = parseCSVLine(lines[i]);
                    const code = values[codeIdx]?.replace(/"/g, '').trim();
                    const name = values[nameIdx]?.replace(/"/g, '').trim();
                    if (!code || !name) continue;

                    const existing = db.products.find(p => p.code === code);
                    if (existing) {
                        // Update existing
                        if (categoryIdx !== -1 && values[categoryIdx]) existing.category = values[categoryIdx].replace(/"/g, '');
                        if (totalOwnedIdx !== -1 && values[totalOwnedIdx]) existing.totalOwned = parseInt(values[totalOwnedIdx]) || existing.totalOwned;
                        if (stockIdx !== -1 && values[stockIdx]) existing.currentPhysicalStock = parseInt(values[stockIdx]) || existing.currentPhysicalStock;
                        if (locationIdx !== -1 && values[locationIdx]) existing.location = values[locationIdx].replace(/"/g, '');
                        await db.saveProduct(existing);
                        updated++;
                    } else {
                        // Add new
                        const newProduct = {
                            id: 0,
                            code,
                            name,
                            category: categoryIdx !== -1 ? values[categoryIdx]?.replace(/"/g, '') || '' : '',
                            totalOwned: totalOwnedIdx !== -1 ? parseInt(values[totalOwnedIdx]) || 1 : 1,
                            currentPhysicalStock: stockIdx !== -1 ? parseInt(values[stockIdx]) || 1 : 1,
                            location: locationIdx !== -1 ? values[locationIdx]?.replace(/"/g, '') || '' : '',
                            pricePerDay: 0,
                            imageUrl: '',
                            images: [],
                            specs: ''
                        };
                        await db.saveProduct(newProduct as any);
                        added++;
                    }
                }

                await db.refreshProducts();
                setImportStatus(`✅ Đã cập nhật ${updated}, thêm mới ${added} sản phẩm`);
                setTimeout(() => setImportStatus(null), 4000);
                refreshApp?.();
            } catch (err) {
                console.error(err);
                setImportStatus('❌ Lỗi đọc file CSV');
                setTimeout(() => setImportStatus(null), 3000);
            }
        };
        reader.readAsText(file);
        if (productCsvInputRef.current) productCsvInputRef.current.value = '';
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

    // Export readable HTML report
    const exportReadableReport = () => {
        const now = new Date();
        const html = `
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>TaiyoTakamatsu - Báo cáo ${now.toLocaleDateString('ja-JP')}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 24px; color: #1e293b; }
        .container { max-width: 1000px; margin: 0 auto; }
        h1 { font-size: 24px; margin-bottom: 8px; }
        .date { color: #64748b; font-size: 14px; margin-bottom: 24px; }
        .section { background: white; border-radius: 12px; padding: 20px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
        .section h2 { font-size: 16px; margin-bottom: 16px; color: #4f46e5; display: flex; align-items: center; gap: 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #f1f5f9; padding: 10px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
        td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
        tr:hover { background: #f8fafc; }
        .stock-ok { color: #16a34a; font-weight: 600; }
        .stock-low { color: #ea580c; font-weight: 600; }
        .stock-out { color: #dc2626; font-weight: 600; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
        .stat { background: #f8fafc; padding: 16px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 28px; font-weight: 700; color: #4f46e5; }
        .stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
        @media print { body { padding: 0; } .section { box-shadow: none; border: 1px solid #e2e8f0; } }
    </style>
</head>
<body>
    <div class="container">
        <h1>📊 TaiyoTakamatsu - Báo cáo dữ liệu</h1>
        <p class="date">Xuất lúc: ${now.toLocaleString('ja-JP')}</p>
        
        <div class="stats">
            <div class="stat">
                <div class="stat-value">${db.products.length}</div>
                <div class="stat-label">Sản phẩm</div>
            </div>
            <div class="stat">
                <div class="stat-value">${db.customers.length}</div>
                <div class="stat-label">Khách hàng</div>
            </div>
            <div class="stat">
                <div class="stat-value">${db.orders.length}</div>
                <div class="stat-label">Đơn hàng</div>
            </div>
            <div class="stat">
                <div class="stat-value">${db.logs.length}</div>
                <div class="stat-label">Logs</div>
            </div>
        </div>

        <div class="section">
            <h2>📦 Danh sách sản phẩm (${db.products.length})</h2>
            <table>
                <thead>
                    <tr>
                        <th>Mã</th>
                        <th>Tên sản phẩm</th>
                        <th>Danh mục</th>
                        <th>Tổng SL</th>
                        <th>Tồn kho</th>
                        <th>Vị trí</th>
                    </tr>
                </thead>
                <tbody>
                    ${db.products.map(p => `
                        <tr>
                            <td><code>${p.code}</code></td>
                            <td>${p.name}</td>
                            <td>${p.category || '-'}</td>
                            <td>${p.totalOwned}</td>
                            <td class="${p.currentPhysicalStock === 0 ? 'stock-out' : p.currentPhysicalStock <= 2 ? 'stock-low' : 'stock-ok'}">${p.currentPhysicalStock}</td>
                            <td>${p.location || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>👥 Danh sách khách hàng (${db.customers.length})</h2>
            <table>
                <thead>
                    <tr>
                        <th>Tên</th>
                        <th>Điện thoại</th>
                        <th>Địa chỉ</th>
                    </tr>
                </thead>
                <tbody>
                    ${db.customers.map(c => `
                        <tr>
                            <td>${c.name}</td>
                            <td>${c.phone || '-'}</td>
                            <td>${(c as any).address || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <div class="section">
            <h2>📋 Hoạt động gần đây (50 mới nhất)</h2>
            <table>
                <thead>
                    <tr>
                        <th>Thời gian</th>
                        <th>Loại</th>
                        <th>Sản phẩm</th>
                        <th>SL</th>
                        <th>Ghi chú</th>
                    </tr>
                </thead>
                <tbody>
                    ${db.logs.slice(-50).reverse().map(l => {
            const product = db.products.find(p => p.id === l.productId);
            return `
                            <tr>
                                <td>${new Date(l.timestamp).toLocaleString('ja-JP')}</td>
                                <td>${l.actionType === 'EXPORT' ? '📤 Xuất' : l.actionType === 'IMPORT' ? '📥 Nhập' : '🧹 VS'}</td>
                                <td>${product?.name || '-'}</td>
                                <td>${l.quantity}</td>
                                <td>${l.note || '-'}</td>
                            </tr>
                        `;
        }).join('')}
                </tbody>
            </table>
        </div>
    </div>
</body>
</html>`;
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `taiyotakamatsu_report_${now.toISOString().split('T')[0]}.html`;
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
                    <p className="text-slate-500 text-sm mt-1">{t('dashboard_overview')}</p>
                </div>
                {/* Export Buttons */}
                <div className="flex gap-2 flex-wrap">
                    <button
                        onClick={exportProductsCSV}
                        className="flex items-center gap-2 px-3 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        CSV SP
                    </button>
                    <label className="flex items-center gap-2 px-3 py-2 bg-teal-500 text-white rounded-lg text-sm font-medium hover:bg-teal-600 transition-colors cursor-pointer">
                        <Upload className="w-4 h-4" />
                        Import CSV
                        <input
                            ref={productCsvInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleImportProductsCSV}
                            className="hidden"
                        />
                    </label>
                    <button
                        onClick={exportLogsHTML}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                    >
                        <Download className="w-4 h-4" />
                        Logs
                    </button>
                    <button
                        onClick={exportBackup}
                        className="flex items-center gap-2 px-3 py-2 bg-purple-500 text-white rounded-lg text-sm font-medium hover:bg-purple-600 transition-colors"
                    >
                        <Database className="w-4 h-4" />
                        Backup
                    </button>
                    <button
                        onClick={exportReadableReport}
                        className="flex items-center gap-2 px-3 py-2 bg-indigo-500 text-white rounded-lg text-sm font-medium hover:bg-indigo-600 transition-colors"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        Report
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
                            <p className="text-xs text-slate-500">{t('on_rent_label')}</p>
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
                            <p className="text-xs text-slate-500">{t('overdue_label')}</p>
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
                            <p className="text-xs text-slate-500">{t('tb_on_rent')}</p>
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
                            <p className="text-xs text-white/70">{t('revenue_this_month')}</p>
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
                        {t('inventory_status')}
                    </h3>
                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <span className="text-slate-600">{t('total_products_label')}</span>
                            <span className="font-bold text-slate-800">{stats.totalProducts}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-slate-600">{t('total_assets_label')}</span>
                            <span className="font-bold text-slate-800">{stats.totalAssets} {t('units_label')}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-amber-600 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" /> {t('running_low')}
                            </span>
                            <span className="font-bold text-amber-600">{stats.lowStockProducts}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-red-600 flex items-center gap-1">
                                <AlertTriangle className="w-4 h-4" /> {t('out_of_stock_label')}
                            </span>
                            <span className="font-bold text-red-600">{stats.outOfStockProducts}</span>
                        </div>
                    </div>
                </div>

                {/* This Month Activity */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-indigo-500" />
                        {t('this_month_activity')}
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-emerald-50 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-emerald-600">{stats.completedThisMonth}</p>
                            <p className="text-xs text-emerald-700">{t('orders_completed')}</p>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-blue-600">{stats.exportsThisMonth + stats.importsThisMonth}</p>
                            <p className="text-xs text-blue-700">{t('warehouse_transactions')}</p>
                        </div>
                    </div>
                    <div className="mt-4 flex gap-4 text-sm">
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-red-400 rounded-full"></span>
                            <span className="text-slate-600">{t('export_label')}: {stats.exportsThisMonth}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-3 h-3 bg-green-400 rounded-full"></span>
                            <span className="text-slate-600">{t('import_label')}: {stats.importsThisMonth}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Top Products */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
                <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-500" />
                    {t('top_rental_products')}
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
                                    <p className="text-xs text-slate-500">{t('times_rented')}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-slate-500 text-center py-4">{t('no_data_yet')}</p>
                )}
            </div>
        </div>
    );
};

export default AnalyticsDashboard;
