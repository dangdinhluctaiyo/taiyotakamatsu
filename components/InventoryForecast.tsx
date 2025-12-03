import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { Calendar, Package, ArrowUpRight, ArrowDownLeft, ChevronLeft, ChevronRight, TrendingUp, AlertTriangle, Box, Search } from 'lucide-react';

interface Props {
  refreshApp: () => void;
}

export const InventoryForecast: React.FC<Props> = ({ refreshApp }) => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [selectedProduct, setSelectedProduct] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'overview' | 'detail'>('overview');

  // Lấy dự báo cho tất cả sản phẩm vào ngày đã chọn
  const allProductsForecast = useMemo(() => {
    return db.getAllProductsForecast(selectedDate);
  }, [selectedDate, db.products, db.orders]);

  // Lọc theo search
  const filteredForecast = useMemo(() => {
    if (!searchTerm) return allProductsForecast;
    return allProductsForecast.filter(
      (p) =>
        p.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.productCode.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [allProductsForecast, searchTerm]);

  // Lấy chi tiết dự báo cho sản phẩm đã chọn (7 ngày)
  const productForecastRange = useMemo(() => {
    if (!selectedProduct) return [];
    return db.getForecastStockRange(selectedProduct, selectedDate, 14);
  }, [selectedProduct, selectedDate]);

  // Lấy chi tiết đơn hàng cho ngày đã chọn
  const selectedProductDetail = useMemo(() => {
    if (!selectedProduct) return null;
    return db.getForecastStockForDate(selectedProduct, selectedDate);
  }, [selectedProduct, selectedDate]);

  const changeDate = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' });
  };

  const isToday = (dateStr: string) => {
    const today = new Date().toISOString().split('T')[0];
    return dateStr === today;
  };

  // Thống kê tổng quan
  const stats = useMemo(() => {
    const lowStock = filteredForecast.filter((p) => p.forecastStock < 5).length;
    const outOfStock = filteredForecast.filter((p) => p.forecastStock === 0).length;
    const totalReturns = filteredForecast.reduce((sum, p) => sum + p.expectedReturns, 0);
    const totalExports = filteredForecast.reduce((sum, p) => sum + p.expectedExports, 0);
    return { lowStock, outOfStock, totalReturns, totalExports };
  }, [filteredForecast]);

  return (
    <div className="p-4 md:p-8 min-h-full max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight flex items-center gap-3">
            <TrendingUp className="w-8 h-8 text-blue-500" />
            {t('inventory_forecast') || 'Dự báo tồn kho'}
          </h1>
          <p className="text-slate-500 mt-1">{t('forecast_desc') || 'Xem tồn kho dự kiến theo ngày dựa trên đơn hàng'}</p>
        </div>
      </div>

      {/* Date Selector */}
      <div className="bg-white p-4 rounded-2xl shadow-soft border border-slate-100">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => changeDate(-1)}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-blue-500" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 font-medium text-slate-700"
              />
            </div>
            <button
              onClick={() => changeDate(1)}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setSelectedDate(new Date().toISOString().split('T')[0])}
              className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-lg"
            >
              {t('today') || 'Hôm nay'}
            </button>
          </div>

          <div className="relative w-full md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder={t('search_product') || 'Tìm sản phẩm...'}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border-none rounded-lg focus:ring-2 focus:ring-primary/20 text-sm outline-none"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-green-100 rounded-lg">
              <ArrowDownLeft className="w-4 h-4 text-green-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-green-600">{stats.totalReturns}</p>
          <p className="text-xs text-slate-500">{t('expected_returns') || 'Dự kiến nhập'}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-orange-100 rounded-lg">
              <ArrowUpRight className="w-4 h-4 text-orange-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-orange-600">{stats.totalExports}</p>
          <p className="text-xs text-slate-500">{t('expected_exports') || 'Dự kiến xuất'}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{stats.lowStock}</p>
          <p className="text-xs text-slate-500">{t('low_stock_items') || 'Sắp hết hàng'}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-2 bg-red-100 rounded-lg">
              <Box className="w-4 h-4 text-red-600" />
            </div>
          </div>
          <p className="text-2xl font-bold text-red-600">{stats.outOfStock}</p>
          <p className="text-xs text-slate-500">{t('out_of_stock') || 'Hết hàng'}</p>
        </div>
      </div>


      {/* Product List */}
      <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
        <div className="p-4 border-b bg-slate-50">
          <h3 className="font-bold text-slate-800">
            {t('forecast_for_date') || 'Tồn kho dự kiến ngày'} {formatDate(selectedDate)}
            {isToday(selectedDate) && (
              <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                {t('today') || 'Hôm nay'}
              </span>
            )}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-bold">
              <tr>
                <th className="p-4">{t('product') || 'Sản phẩm'}</th>
                <th className="p-4 text-center">{t('current_stock') || 'Tồn hiện tại'}</th>
                <th className="p-4 text-center text-green-600">{t('expected_in') || 'Dự kiến nhập'}</th>
                <th className="p-4 text-center text-orange-600">{t('expected_out') || 'Dự kiến xuất'}</th>
                <th className="p-4 text-center">{t('forecast_stock') || 'Tồn dự kiến'}</th>
                <th className="p-4 text-center">{t('actions') || 'Chi tiết'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredForecast.map((item) => {
                const isLow = item.forecastStock < 5;
                const isOut = item.forecastStock === 0;
                return (
                  <tr
                    key={item.productId}
                    className={`hover:bg-slate-50 transition-colors ${
                      selectedProduct === item.productId ? 'bg-blue-50' : ''
                    }`}
                  >
                    <td className="p-4">
                      <div className="font-bold text-slate-800">{item.productName}</div>
                      <div className="text-xs font-mono text-slate-400">{item.productCode}</div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="font-bold text-slate-700">{item.currentStock}</span>
                    </td>
                    <td className="p-4 text-center">
                      {item.expectedReturns > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-lg font-bold text-sm">
                          <ArrowDownLeft className="w-3 h-3" /> +{item.expectedReturns}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {item.expectedExports > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-lg font-bold text-sm">
                          <ArrowUpRight className="w-3 h-3" /> -{item.expectedExports}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span
                        className={`font-bold text-lg ${
                          isOut ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-green-600'
                        }`}
                      >
                        {item.forecastStock}
                      </span>
                      {isOut && (
                        <span className="ml-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">
                          {t('out') || 'Hết'}
                        </span>
                      )}
                      {isLow && !isOut && (
                        <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">
                          {t('low') || 'Thấp'}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => setSelectedProduct(selectedProduct === item.productId ? null : item.productId)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                          selectedProduct === item.productId
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {selectedProduct === item.productId ? t('hide') || 'Ẩn' : t('view') || 'Xem'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Product Detail Panel */}
      {selectedProduct && selectedProductDetail && (
        <div className="bg-white rounded-2xl shadow-soft border border-slate-100 overflow-hidden">
          <div className="p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
            <h3 className="font-bold text-slate-800 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-500" />
              {db.products.find((p) => p.id === selectedProduct)?.name} - {t('forecast_detail') || 'Chi tiết dự báo'}
            </h3>
          </div>

          {/* 14-day forecast chart */}
          <div className="p-4 border-b">
            <h4 className="font-medium text-slate-700 mb-3">{t('14_day_forecast') || 'Dự báo 14 ngày tới'}</h4>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {productForecastRange.map((day, idx) => {
                const isLow = day.forecastStock < 5;
                const isOut = day.forecastStock === 0;
                const isTodayDate = isToday(day.date);
                return (
                  <div
                    key={day.date}
                    className={`flex-shrink-0 w-20 p-3 rounded-xl text-center border ${
                      isTodayDate ? 'border-blue-500 bg-blue-50' : 'border-slate-200'
                    }`}
                  >
                    <p className={`text-xs font-medium ${isTodayDate ? 'text-blue-600' : 'text-slate-500'}`}>
                      {formatDate(day.date)}
                    </p>
                    <p
                      className={`text-xl font-bold mt-1 ${
                        isOut ? 'text-red-600' : isLow ? 'text-yellow-600' : 'text-green-600'
                      }`}
                    >
                      {day.forecastStock}
                    </p>
                    <div className="flex justify-center gap-1 mt-1">
                      {day.expectedReturns > 0 && (
                        <span className="text-[10px] text-green-600">+{day.expectedReturns}</span>
                      )}
                      {day.expectedExports > 0 && (
                        <span className="text-[10px] text-orange-600">-{day.expectedExports}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order details */}
          <div className="p-4">
            <h4 className="font-medium text-slate-700 mb-3">
              {t('related_orders') || 'Đơn hàng liên quan đến ngày'} {formatDate(selectedDate)}
            </h4>
            {selectedProductDetail.orders.length === 0 ? (
              <p className="text-slate-400 text-center py-6 bg-slate-50 rounded-lg">
                {t('no_orders_for_date') || 'Không có đơn hàng nào ảnh hưởng đến ngày này'}
              </p>
            ) : (
              <div className="space-y-2">
                {selectedProductDetail.orders.map((order, idx) => (
                  <div
                    key={`${order.orderId}-${order.type}-${idx}`}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      order.type === 'return' ? 'bg-green-50' : 'bg-orange-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`p-2 rounded-lg ${
                          order.type === 'return' ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                        }`}
                      >
                        {order.type === 'return' ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </span>
                      <div>
                        <p className="font-medium text-slate-800">{order.customerName}</p>
                        <p className="text-xs text-slate-500">
                          {t('order') || 'Đơn'} #{order.orderId} •{' '}
                          {order.type === 'return'
                            ? t('expected_return_date') || 'Ngày trả dự kiến'
                            : t('rental_start_date') || 'Ngày bắt đầu thuê'}
                          : {formatDate(order.date)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`font-bold ${order.type === 'return' ? 'text-green-600' : 'text-orange-600'}`}
                      >
                        {order.type === 'return' ? '+' : '-'}
                        {order.quantity}
                      </span>
                      <p className="text-xs text-slate-500">
                        {order.type === 'return' ? t('return') || 'Nhập kho' : t('export') || 'Xuất kho'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
