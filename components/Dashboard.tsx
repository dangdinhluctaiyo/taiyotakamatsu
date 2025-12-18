import React, { useState, useMemo } from 'react';
import { db } from '../services/db';
import { t } from '../services/i18n';
import { Package, AlertTriangle, Search, Box, ArrowDownCircle, ArrowUpCircle, Filter, ChevronRight } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'available' | 'low' | 'out'>('all');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate inventory stats
  const inventoryStats = useMemo(() => {
    let totalItems = 0;
    let totalAvailable = 0;
    let totalRenting = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    db.products.forEach(p => {
      totalItems += p.totalOwned;
      totalAvailable += p.currentPhysicalStock;
      totalRenting += (p.totalOwned - p.currentPhysicalStock);
      if (p.currentPhysicalStock === 0) outOfStockCount++;
      else if (p.currentPhysicalStock <= 2) lowStockCount++;
    });

    return { totalItems, totalAvailable, totalRenting, lowStockCount, outOfStockCount };
  }, [db.products]);

  // Filter and search products
  const filteredProducts = useMemo(() => {
    let products = db.products;
    
    // Apply filter
    if (filter === 'available') {
      products = products.filter(p => p.currentPhysicalStock > 2);
    } else if (filter === 'low') {
      products = products.filter(p => p.currentPhysicalStock > 0 && p.currentPhysicalStock <= 2);
    } else if (filter === 'out') {
      products = products.filter(p => p.currentPhysicalStock === 0);
    }

    // Apply search
    if (search.trim()) {
      const s = search.toLowerCase();
      products = products.filter(p => 
        p.name.toLowerCase().includes(s) || 
        p.code.toLowerCase().includes(s)
      );
    }

    return products;
  }, [search, filter, db.products]);

  // Overdue orders warning
  const overdueOrders = db.orders.filter(o => {
    if (o.status !== 'ACTIVE' && o.status !== 'BOOKED') return false;
    const expectedDate = new Date(o.expectedReturnDate);
    return expectedDate < today;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header with gradient */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white px-4 pt-4 pb-20 md:px-8 md:pt-8 md:pb-24">
        <div className="max-w-6xl mx-auto">
          <p className="text-blue-200 text-sm">{t('dashboard_welcome')}</p>
          <h1 className="text-2xl md:text-3xl font-bold mt-1">{db.currentUser?.name}</h1>
          
          {/* Warning banner */}
          {overdueOrders.length > 0 && (
            <div className="mt-4 bg-red-500/20 backdrop-blur border border-red-400/30 rounded-xl p-3 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-300 shrink-0" />
              <p className="text-sm font-medium">{overdueOrders.length} {t('orders_overdue')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Main content - overlapping header */}
      <div className="px-4 md:px-8 -mt-14 md:-mt-16 pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto space-y-4">
          
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard 
              label={t('total_equipment')} 
              value={db.products.length}
              subValue={`${inventoryStats.totalItems} ${t('total_units')}`}
              icon={<Package className="w-5 h-5" />}
              color="blue"
            />
            <StatCard 
              label={t('on_rent') || 'Đang cho thuê'} 
              value={inventoryStats.totalRenting}
              subValue={`${db.orders.filter(o => o.status === 'ACTIVE').length} ${t('active_orders_count') || 'đơn'}`}
              icon={<ArrowUpCircle className="w-5 h-5" />}
              color="green"
            />
            <StatCard 
              label={t('available')} 
              value={inventoryStats.totalAvailable}
              subValue={t('ready_in_stock') || 'trong kho'}
              icon={<ArrowDownCircle className="w-5 h-5" />}
              color="indigo"
            />
            <StatCard 
              label={t('need_attention') || 'Cần chú ý'} 
              value={inventoryStats.lowStockCount + inventoryStats.outOfStockCount}
              subValue={`${inventoryStats.outOfStockCount} ${t('out_of_stock_count') || 'hết hàng'}`}
              icon={<AlertTriangle className="w-5 h-5" />}
              color="orange"
              alert={inventoryStats.outOfStockCount > 0}
            />
          </div>

          {/* Inventory List */}
          <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
            {/* Search and Filter */}
            <div className="p-4 border-b bg-slate-50/50">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder={t('search_by_name_code') || 'Tìm thiết bị theo tên hoặc mã...'}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-white border rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0">
                  <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')} label={t('filter_all') || 'Tất cả'} count={db.products.length} />
                  <FilterBtn active={filter === 'available'} onClick={() => setFilter('available')} label={t('filter_available') || 'Sẵn sàng'} color="green" />
                  <FilterBtn active={filter === 'low'} onClick={() => setFilter('low')} label={t('filter_low') || 'Sắp hết'} color="orange" />
                  <FilterBtn active={filter === 'out'} onClick={() => setFilter('out')} label={t('filter_out') || 'Hết hàng'} color="red" />
                </div>
              </div>
            </div>

            {/* Product List */}
            <div className="divide-y max-h-[60vh] overflow-y-auto">
              {filteredProducts.length === 0 ? (
                <div className="p-8 text-center">
                  <Box className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500 text-sm">{t('no_equipment_found') || 'Không tìm thấy thiết bị'}</p>
                </div>
              ) : (
                filteredProducts.map(product => {
                  const onRent = product.totalOwned - product.currentPhysicalStock;
                  const availPercent = (product.currentPhysicalStock / product.totalOwned) * 100;
                  const isOut = product.currentPhysicalStock === 0;
                  const isLow = product.currentPhysicalStock > 0 && product.currentPhysicalStock <= 2;
                  
                  return (
                    <div key={product.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        {/* Product Image */}
                        <div className="relative shrink-0">
                          <img 
                            src={product.imageUrl} 
                            alt="" 
                            className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover bg-slate-100"
                          />
                          {(isOut || isLow) && (
                            <div className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${isOut ? 'bg-red-500' : 'bg-orange-500'}`} />
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="font-semibold text-slate-800 truncate">{product.name}</h3>
                              <p className="text-xs text-slate-400 mt-0.5">{product.code}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="flex items-baseline gap-1">
                                <span className={`text-xl font-bold ${isOut ? 'text-red-500' : isLow ? 'text-orange-500' : 'text-green-600'}`}>
                                  {product.currentPhysicalStock}
                                </span>
                                <span className="text-slate-400 text-sm">/{product.totalOwned}</span>
                              </div>
                            </div>
                          </div>

                          {/* Progress Bar */}
                          <div className="mt-2 flex items-center gap-3">
                            <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all ${isOut ? 'bg-red-500' : isLow ? 'bg-orange-500' : 'bg-green-500'}`}
                                style={{ width: `${availPercent}%` }}
                              />
                            </div>
                            <span className="text-xs text-slate-500 whitespace-nowrap">
                              {onRent > 0 ? `${onRent} ${t('renting')}` : t('available')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {filteredProducts.length > 0 && (
              <div className="p-3 bg-slate-50 border-t text-center">
                <p className="text-xs text-slate-500">
                  {t('showing_count')?.replace('{0}', String(filteredProducts.length)).replace('{1}', String(db.products.length)) || `Hiển thị ${filteredProducts.length} / ${db.products.length} thiết bị`}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ label, value, subValue, icon, color, alert }: {
  label: string;
  value: number;
  subValue: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'indigo' | 'orange';
  alert?: boolean;
}) => {
  const colors = {
    blue: 'from-blue-500 to-blue-600',
    green: 'from-green-500 to-green-600',
    indigo: 'from-indigo-500 to-indigo-600',
    orange: 'from-orange-500 to-orange-600'
  };

  return (
    <div className={`bg-white rounded-2xl p-4 shadow-sm border relative overflow-hidden ${alert ? 'ring-2 ring-orange-500/50' : ''}`}>
      <div className={`absolute top-0 right-0 w-20 h-20 bg-gradient-to-br ${colors[color]} opacity-10 rounded-bl-[60px]`} />
      <div className={`inline-flex p-2 rounded-xl bg-gradient-to-br ${colors[color]} text-white mb-3`}>
        {icon}
      </div>
      <p className="text-2xl md:text-3xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
      <p className="text-[10px] text-slate-400">{subValue}</p>
    </div>
  );
};

// Filter Button Component
const FilterBtn = ({ active, onClick, label, count, color }: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
  color?: 'green' | 'orange' | 'red';
}) => {
  const dotColors = {
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500'
  };

  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
        active 
          ? 'bg-blue-600 text-white shadow-sm' 
          : 'bg-white text-slate-600 border hover:bg-slate-50'
      }`}
    >
      {color && <span className={`w-2 h-2 rounded-full ${active ? 'bg-white' : dotColors[color]}`} />}
      {label}
      {count !== undefined && (
        <span className={`text-xs ${active ? 'text-blue-200' : 'text-slate-400'}`}>({count})</span>
      )}
    </button>
  );
};
