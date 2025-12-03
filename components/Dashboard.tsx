import React from 'react';
import { db } from '../services/db';
import { t, i18n } from '../services/i18n';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Package, Truck, AlertTriangle, TrendingUp, ShoppingCart, Box } from 'lucide-react';

export const Dashboard: React.FC = () => {
  const totalOrders = db.orders.length;
  const activeOrders = db.orders.filter(o => o.status === 'ACTIVE').length;
  const bookedOrders = db.orders.filter(o => o.status === 'BOOKED').length;
  const revenueEstimate = db.orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueOrders = db.orders.filter(o => {
    if (o.status !== 'ACTIVE') return false;
    const expectedDate = new Date(o.expectedReturnDate);
    expectedDate.setHours(0, 0, 0, 0);
    return expectedDate < today;
  });

  const dueSoonOrders = db.orders.filter(o => {
    if (o.status !== 'ACTIVE') return false;
    const expectedDate = new Date(o.expectedReturnDate);
    expectedDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((expectedDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= 1;
  });

  const getNext7Days = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  };

  const chartData = getNext7Days().map(date => {
    const productsToCheck = db.products.slice(0, 3);
    let totalUsed = 0, totalAvail = 0;
    productsToCheck.forEach(p => {
      const avail = db.checkAvailability(p.id, date, date);
      totalAvail += avail;
      totalUsed += (p.totalOwned - avail);
    });
    return { date: date.slice(5), Used: totalUsed, Available: totalAvail };
  });

  return (
    <div className="p-3 md:p-8 space-y-4 md:space-y-6 max-w-7xl mx-auto">
      {/* Mobile Header */}
      <div className="md:hidden">
        <h1 className="text-xl font-bold text-slate-800">{t('nav_dashboard')}</h1>
        <p className="text-sm text-slate-500">{t('dashboard_welcome')}, {db.currentUser?.name}</p>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">{t('dashboard_title')}</h1>
          <p className="text-slate-500 mt-1">{t('dashboard_welcome')}, {db.currentUser?.name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-500">{t('revenue_estimate')}</p>
          <p className="text-2xl font-bold text-primary">{revenueEstimate.toLocaleString()}{t('vnd')}</p>
        </div>
      </div>

      {/* Warning Banners - Compact on mobile */}
      {overdueOrders.length > 0 && (
        <div className="bg-red-100 border border-red-300 p-3 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-red-500 rounded-lg shrink-0">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-red-700 text-sm">{overdueOrders.length} {t('overdue_warning')}</p>
          </div>
        </div>
      )}

      {dueSoonOrders.length > 0 && (
        <div className="bg-orange-100 border border-orange-300 p-3 rounded-xl flex items-center gap-3">
          <div className="p-2 bg-orange-500 rounded-lg shrink-0">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-orange-700 text-sm">{dueSoonOrders.length} {t('due_soon_warning')}</p>
          </div>
        </div>
      )}

      {/* KPI Cards - 2x2 on mobile, 4 cols on desktop */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <MiniKPI title={t('total_orders')} value={totalOrders} icon={<ShoppingCart />} color="blue" />
        <MiniKPI title={t('active_orders')} value={activeOrders} icon={<Truck />} color="green" />
        <MiniKPI title={t('booked_orders')} value={bookedOrders} icon={<Package />} color="orange" />
        <MiniKPI title={t('overdue_orders')} value={overdueOrders.length} icon={<AlertTriangle />} color="red" />
      </div>

      {/* Mobile Revenue Card */}
      <div className="md:hidden bg-gradient-to-r from-blue-500 to-indigo-600 p-4 rounded-xl text-white">
        <p className="text-blue-100 text-sm">{t('revenue_estimate')}</p>
        <p className="text-2xl font-bold">{revenueEstimate.toLocaleString()}{t('vnd')}</p>
      </div>

      {/* Chart - Scrollable on mobile */}
      <div className="bg-white p-4 md:p-6 rounded-xl shadow-sm border overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-slate-800">{t('capacity_forecast')}</h3>
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-full">{t('top_equipment')}</span>
        </div>
        <div className="h-48 md:h-64 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0">
          <div className="min-w-[500px] h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barSize={16}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={30} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', fontSize: '12px' }} />
                <Bar dataKey="Used" stackId="a" fill="#3b82f6" name={t('booked')} radius={[0, 0, 4, 4]} />
                <Bar dataKey="Available" stackId="a" fill="#e2e8f0" name={t('available')} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Orders - Compact list */}
      <div className="bg-white p-4 rounded-xl shadow-sm border">
        <h3 className="font-bold text-slate-800 mb-3">{t('recent_orders')}</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {db.orders.length === 0 ? (
            <p className="text-slate-400 text-center py-6 text-sm">{t('no_orders')}</p>
          ) : (
            db.orders.slice().reverse().slice(0, 5).map(order => {
              const customer = db.customers.find(c => c.id === order.customerId);
              return (
                <div key={order.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${order.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                    order.status === 'BOOKED' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                    #{order.id}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 text-sm truncate">{customer?.name}</p>
                    <p className="text-xs text-slate-400">{new Date(order.rentalStartDate).toLocaleDateString(i18n.getLanguage() === 'vi' ? 'vi-VN' : 'ja-JP')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-700">{order.totalAmount.toLocaleString()}</p>
                    <p className={`text-[10px] font-medium ${order.status === 'ACTIVE' ? 'text-green-600' :
                      order.status === 'BOOKED' ? 'text-orange-600' : 'text-slate-400'
                      }`}>{order.status}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Quick Stats for Mobile */}
      <div className="md:hidden grid grid-cols-2 gap-3">
        <div className="bg-white p-3 rounded-xl border">
          <div className="flex items-center gap-2 mb-1">
            <Box className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500">{t('equipment')}</span>
          </div>
          <p className="text-xl font-bold text-slate-800">{db.products.length}</p>
        </div>
        <div className="bg-white p-3 rounded-xl border">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-slate-400" />
            <span className="text-xs text-slate-500">{t('transactions')}</span>
          </div>
          <p className="text-xl font-bold text-slate-800">{db.logs.length}</p>
        </div>
      </div>
    </div>
  );
};

const MiniKPI = ({ title, value, icon, color }: { title: string; value: number; icon: React.ReactNode; color: string }) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500'
  };

  return (
    <div className="bg-white p-3 md:p-4 rounded-xl shadow-sm border">
      <div className="flex items-center gap-2 mb-2">
        <div className={`p-1.5 md:p-2 rounded-lg ${colors[color]} text-white`}>
          {React.cloneElement(icon as React.ReactElement, { className: 'w-4 h-4 md:w-5 md:h-5' })}
        </div>
      </div>
      <p className="text-2xl md:text-3xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{title}</p>
    </div>
  );
};
