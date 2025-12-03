import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { CreateOrder } from './components/CreateOrder';
import { Scanner } from './components/Scanner';
import { ProductManager } from './components/ProductManager';
import { OrderDetail } from './components/OrderDetail';
import { InventoryHistory } from './components/InventoryHistory';
import { Login } from './components/Login';
import { StaffManager } from './components/StaffManager';
import { InventoryForecast } from './components/InventoryForecast';
import { CustomerManager } from './components/CustomerManager';
import { CategoryManager } from './components/CategoryManager';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { LayoutDashboard, ShoppingCart, Box, ScanLine, RotateCcw, ChevronRight, Package, Truck, History, Users, LogOut, User, TrendingUp, UserCircle, FolderOpen, ArrowUp } from 'lucide-react';
import { db } from './services/db';
import { Order, OrderStatus } from './types';
import { t } from './services/i18n';

import { ToastProvider } from './components/Toast';

// Simple Router Component
export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

function AppContent() {
  const [view, setView] = useState<'DASHBOARD' | 'ORDERS' | 'INVENTORY' | 'SCANNER' | 'HISTORY' | 'STAFF' | 'FORECAST' | 'CUSTOMERS' | 'CATEGORIES'>('DASHBOARD');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const mainRef = React.useRef<HTMLElement>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [tick, setTick] = useState(0);
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'BOOKED' | 'ACTIVE' | 'COMPLETED' | 'OVERDUE'>('ALL');
  const [isLoggedIn, setIsLoggedIn] = useState(!!db.currentUser);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Load data from cloud on mount
  React.useEffect(() => {
    const loadData = async () => {
      try {
        await db.init();
      } catch (e) {
        console.error('Failed to load data:', e);
      } finally {
        setIsLoading(false);
        setTick(t => t + 1);
      }
    };
    loadData();
  }, []);

  const refreshApp = async () => {
    try {
      await db.refresh();
    } catch (e) {
      console.error('Refresh failed:', e);
    }
    setTick(t => t + 1);
  };
  const isAdmin = db.currentUser?.role === 'admin';

  const handleLogout = () => {
    db.logout();
    setIsLoggedIn(false);
  };

  // Show loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Package className="w-8 h-8 text-white" />
          </div>
          <p className="text-white font-medium">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  // Show login if not logged in
  if (!isLoggedIn) {
    return <Login onLogin={() => { setIsLoggedIn(true); setTick(t => t + 1); }} />;
  }

  const handleReset = () => {
    if (!isAdmin) return;
    // Verify password
    if (resetPassword !== db.currentUser?.password) {
      setResetError(t('wrong_password'));
      return;
    }
    db.reset();
  };



  return (
    <div className="flex h-screen bg-background text-slate-800 font-sans overflow-hidden">
      {/* Sidebar - Modern Dark Glassmorphism style */}
      <aside className="hidden md:flex flex-col w-72 bg-slate-900 text-white shadow-2xl z-20 relative">
        {/* Abstract shape for visuals */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600 rounded-full blur-[80px] opacity-20 pointer-events-none"></div>

        <div className="p-8 pb-4 relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Package className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white leading-none">LucRental</h1>
              <span className="text-[10px] font-bold tracking-widest text-blue-400 uppercase bg-blue-900/30 px-1.5 py-0.5 rounded mt-1 inline-block">Pro System</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-2">
          <p className="text-xs font-bold text-slate-500 uppercase px-4 mb-2 tracking-wider">Menu</p>
          <nav className="space-y-1 relative z-10">
            <NavButton active={view === 'DASHBOARD'} onClick={() => setView('DASHBOARD')} icon={<LayoutDashboard />} label={t('nav_dashboard')} />
            <NavButton active={view === 'ORDERS'} onClick={() => setView('ORDERS')} icon={<ShoppingCart />} label={t('nav_orders')} count={db.orders.filter(o => o.status === 'ACTIVE').length} />
            <NavButton active={view === 'INVENTORY'} onClick={() => setView('INVENTORY')} icon={<Box />} label={t('nav_inventory')} />
            <NavButton active={view === 'FORECAST'} onClick={() => setView('FORECAST')} icon={<TrendingUp />} label={t('nav_forecast')} />
            <NavButton active={view === 'HISTORY'} onClick={() => setView('HISTORY')} icon={<History />} label={t('nav_history')} />
            <NavButton active={view === 'SCANNER'} onClick={() => setView('SCANNER')} icon={<ScanLine />} label={t('nav_scanner')} isSpecial />
          </nav>

          {/* Admin Menu */}
          {db.currentUser?.role === 'admin' && (
            <div className="mt-6">
              <p className="text-xs font-bold text-slate-500 uppercase px-4 mb-2 tracking-wider">Admin</p>
              <nav className="space-y-1 relative z-10">
                <NavButton active={view === 'CUSTOMERS'} onClick={() => setView('CUSTOMERS')} icon={<UserCircle />} label={t('nav_customers') || 'Khách hàng'} />
                <NavButton active={view === 'CATEGORIES'} onClick={() => setView('CATEGORIES')} icon={<FolderOpen />} label={t('nav_categories') || 'Danh mục'} />
                <NavButton active={view === 'STAFF'} onClick={() => setView('STAFF')} icon={<Users />} label={t('nav_staff')} />
              </nav>
            </div>
          )}
        </div>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-slate-800 relative z-10 bg-slate-900">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{db.currentUser?.name}</p>
              <p className="text-xs text-slate-400">{db.currentUser?.role === 'admin' ? t('role_admin') : t('role_staff')}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="flex items-center justify-center text-xs font-bold text-slate-400 hover:text-white w-full px-4 py-2.5 rounded-lg hover:bg-slate-800 transition-colors gap-2">
            <LogOut className="w-4 h-4" /> {t('logout')}
          </button>
          {isAdmin && (
            <button onClick={() => { setShowResetModal(true); setResetPassword(''); setResetError(''); }} className="flex items-center justify-center text-xs font-bold text-slate-500 hover:text-red-400 w-full px-4 py-2 rounded-lg hover:bg-slate-800 transition-colors gap-2 group mt-1">
              <RotateCcw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" /> {t('reset_data')}
            </button>
          )}
          <div className="mt-2 flex justify-center">
            <LanguageSwitcher />
          </div>
          <p className="text-[10px] text-center text-slate-600 mt-2">{t('version')} 2.3.0</p>
        </div>
      </aside>

      {/* Mobile Bottom Nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-md border-t flex justify-around p-2 z-50 pb-[env(safe-area-inset-bottom)] shadow-[0_-5px_15px_rgba(0,0,0,0.05)]">
        <MobileNavBtn active={view === 'DASHBOARD'} onClick={() => setView('DASHBOARD')} icon={<LayoutDashboard />} label={t('nav_dashboard')} />
        <MobileNavBtn active={view === 'ORDERS'} onClick={() => setView('ORDERS')} icon={<ShoppingCart />} label={t('nav_orders')} />
        <MobileNavBtn active={view === 'SCANNER'} onClick={() => setView('SCANNER')} icon={<ScanLine />} isMain label={t('nav_scanner')} />
        <MobileNavBtn active={view === 'INVENTORY'} onClick={() => setView('INVENTORY')} icon={<Box />} label={t('nav_inventory')} />
        <MobileNavBtn active={view === 'HISTORY'} onClick={() => setView('HISTORY')} icon={<History />} label={t('nav_history')} />
      </div>

      <main
        ref={mainRef}
        className="flex-1 overflow-auto relative scroll-smooth"
        onScroll={(e) => {
          const target = e.target as HTMLElement;
          setShowScrollTop(target.scrollTop > 300);
        }}
      >
        <div className="md:hidden p-4 bg-white/80 backdrop-blur-md sticky top-0 z-30 shadow-sm border-b flex justify-between items-center pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Package className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-800 text-sm leading-tight">LucRental</h1>
              <p className="text-[10px] text-slate-500 font-medium">{db.currentUser?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === 'ORDERS' && (
              <button onClick={() => setShowCreateModal(true)} className="bg-primary text-white p-2 rounded-lg shadow-lg shadow-blue-500/30 active:scale-95 transition-transform"><PlusIcon /></button>
            )}
            <LanguageSwitcher compact />
            <button onClick={handleLogout} className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title={t('logout')}>
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="pb-24 md:pb-0 min-h-full">
          {view === 'DASHBOARD' && <Dashboard />}

          {view === 'ORDERS' && (
            <div className="p-4 md:p-8 max-w-6xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-xl md:text-3xl font-bold text-slate-800 tracking-tight">{t('orders_title')}</h1>
                  <p className="text-slate-500 text-sm hidden md:block">{t('track_transactions')}</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="hidden md:flex bg-primary hover:bg-primaryDark text-white px-5 py-3 rounded-xl shadow-glow hover:shadow-lg transition-all font-semibold items-center gap-2"
                >
                  <PlusIcon /> {t('create_order')}
                </button>
              </div>

              {/* Filter Tabs */}
              <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                {(() => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  // Helper: Check if order is effectively active (started or past start date)
                  const isEffectivelyActive = (o: Order) => {
                    if (o.status === 'ACTIVE') return true;
                    if (o.status === 'BOOKED') {
                      const startDate = new Date(o.rentalStartDate);
                      startDate.setHours(0, 0, 0, 0);
                      return startDate <= today;
                    }
                    return false;
                  };

                  // Helper: Check if order is future booked (not yet started)
                  const isFutureBooked = (o: Order) => {
                    if (o.status !== 'BOOKED') return false;
                    const startDate = new Date(o.rentalStartDate);
                    startDate.setHours(0, 0, 0, 0);
                    return startDate > today;
                  };

                  return [
                    { key: 'ALL', label: t('all'), count: db.orders.length },
                    { key: 'BOOKED', label: t('booked_orders'), count: db.orders.filter(o => isFutureBooked(o)).length },
                    { key: 'ACTIVE', label: t('active_orders'), count: db.orders.filter(o => isEffectivelyActive(o)).length },
                    { key: 'OVERDUE', label: t('overdue_orders'), count: db.orders.filter(o => isEffectivelyActive(o) && new Date(o.expectedReturnDate) < new Date()).length },
                    { key: 'COMPLETED', label: t('order_status_completed'), count: db.orders.filter(o => o.status === 'COMPLETED').length },
                  ];
                })().map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setOrderFilter(tab.key as any)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${orderFilter === tab.key
                      ? 'bg-primary text-white shadow'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                      }`}
                  >
                    {tab.label} {tab.count > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${orderFilter === tab.key ? 'bg-white/20' : 'bg-slate-100'}`}>{tab.count}</span>}
                  </button>
                ))}
              </div>

              <div className="grid gap-4">
                {db.orders.filter(o => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  const isEffectivelyActive = () => {
                    if (o.status === 'ACTIVE') return true;
                    if (o.status === 'BOOKED') {
                      const startDate = new Date(o.rentalStartDate);
                      startDate.setHours(0, 0, 0, 0);
                      return startDate <= today;
                    }
                    return false;
                  };

                  const isFutureBooked = () => {
                    if (o.status !== 'BOOKED') return false;
                    const startDate = new Date(o.rentalStartDate);
                    startDate.setHours(0, 0, 0, 0);
                    return startDate > today;
                  };

                  if (orderFilter === 'ALL') return true;
                  if (orderFilter === 'BOOKED') return isFutureBooked();
                  if (orderFilter === 'ACTIVE') return isEffectivelyActive();
                  if (orderFilter === 'OVERDUE') return isEffectivelyActive() && new Date(o.expectedReturnDate) < new Date();
                  return o.status === orderFilter;
                }).length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                    <ShoppingCart className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">{t('no_orders')}</p>
                    <button onClick={() => setShowCreateModal(true)} className="text-primary font-bold mt-2 hover:underline">{t('create_now')}</button>
                  </div>
                ) : db.orders.filter(o => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  const isEffectivelyActive = () => {
                    if (o.status === 'ACTIVE') return true;
                    if (o.status === 'BOOKED') {
                      const startDate = new Date(o.rentalStartDate);
                      startDate.setHours(0, 0, 0, 0);
                      return startDate <= today;
                    }
                    return false;
                  };

                  const isFutureBooked = () => {
                    if (o.status !== 'BOOKED') return false;
                    const startDate = new Date(o.rentalStartDate);
                    startDate.setHours(0, 0, 0, 0);
                    return startDate > today;
                  };

                  if (orderFilter === 'ALL') return true;
                  if (orderFilter === 'BOOKED') return isFutureBooked();
                  if (orderFilter === 'ACTIVE') return isEffectivelyActive();
                  if (orderFilter === 'OVERDUE') return isEffectivelyActive() && new Date(o.expectedReturnDate) < new Date();
                  return o.status === orderFilter;
                }).slice().reverse().map(order => (
                  <div key={order.id} onClick={() => setSelectedOrder(order)} className="bg-white p-5 rounded-xl shadow-soft border border-slate-100 hover:shadow-lg hover:border-blue-100 transition-all cursor-pointer group relative overflow-hidden">
                    {/* Status Strip */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const startDate = new Date(order.rentalStartDate);
                      startDate.setHours(0, 0, 0, 0);
                      const isStarted = startDate <= today;

                      if (order.status === 'ACTIVE' || (order.status === 'BOOKED' && isStarted)) return 'bg-green-500';
                      if (order.status === 'COMPLETED') return 'bg-blue-500';
                      if (order.status === 'CANCELLED') return 'bg-slate-300';
                      return 'bg-orange-400';
                    })()
                      }`}></div>

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pl-3">
                      <div className="flex items-start gap-4">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ${order.status === 'ACTIVE' ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-500'
                          }`}>
                          #{order.id}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-slate-800 group-hover:text-primary transition-colors">{db.customers.find(c => c.id === order.customerId)?.name}</h3>
                          <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                            <span className="flex items-center gap-1"><Box className="w-3 h-3" /> {order.items.length} mục</span>
                            <span>•</span>
                            <span>{new Date(order.rentalStartDate).toLocaleDateString('vi-VN')} → {new Date(order.expectedReturnDate).toLocaleDateString('vi-VN')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between md:justify-end gap-6 w-full md:w-auto mt-2 md:mt-0 pl-16 md:pl-0">
                        <div className="text-right">
                          <p className="text-xs text-slate-400 uppercase font-bold">{t('total_amount')}</p>
                          <p className="text-lg font-bold text-slate-700">{order.totalAmount.toLocaleString()}{t('vnd')}</p>
                        </div>
                        <div className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide flex items-center gap-2 ${(() => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const startDate = new Date(order.rentalStartDate);
                          startDate.setHours(0, 0, 0, 0);
                          const isStarted = startDate <= today;
                          const isOverdue = new Date(order.expectedReturnDate) < new Date();

                          if ((order.status === 'ACTIVE' || (order.status === 'BOOKED' && isStarted)) && isOverdue) return 'bg-red-100 text-red-700 animate-pulse';
                          if (order.status === 'ACTIVE' || (order.status === 'BOOKED' && isStarted)) return 'bg-green-100 text-green-700';
                          if (order.status === 'COMPLETED') return 'bg-blue-100 text-blue-700';
                          return 'bg-orange-100 text-orange-700';
                        })()
                          }`}>
                          {(() => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const startDate = new Date(order.rentalStartDate);
                            startDate.setHours(0, 0, 0, 0);
                            const isStarted = startDate <= today;
                            const isOverdue = new Date(order.expectedReturnDate) < new Date();

                            if ((order.status === 'ACTIVE' || (order.status === 'BOOKED' && isStarted)) && isOverdue) return t('order_status_overdue').toUpperCase();
                            if (order.status === 'ACTIVE' || (order.status === 'BOOKED' && isStarted)) return <><Truck className="w-3 h-3" /> {t('order_status_active').toUpperCase()}</>;
                            if (order.status === 'COMPLETED') return t('order_status_completed').toUpperCase();
                            return t('order_status_booked').toUpperCase();
                          })()}
                        </div>
                        <ChevronRight className="text-slate-300 group-hover:text-primary transition-colors" />
                      </div>
                    </div>

                    {/* Sub-rent tag */}
                    {order.items.some(i => i.isExternal) && (
                      <div className="absolute top-0 right-0 bg-purple-100 text-purple-700 text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                        SUB-RENT
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Use ProductManager here */}
          {view === 'INVENTORY' && <ProductManager refreshApp={refreshApp} />}

          {view === 'HISTORY' && <InventoryHistory refreshApp={refreshApp} />}

          {view === 'FORECAST' && <InventoryForecast refreshApp={refreshApp} />}

          {view === 'STAFF' && <StaffManager refreshApp={refreshApp} />}

          {view === 'CUSTOMERS' && <CustomerManager refreshApp={refreshApp} />}

          {view === 'CATEGORIES' && <CategoryManager refreshApp={refreshApp} />}

          {view === 'SCANNER' && <Scanner refreshApp={refreshApp} />}
        </div>
      </main>

      {/* Create Order Modal */}
      {showCreateModal && <CreateOrder onClose={() => setShowCreateModal(false)} refreshApp={refreshApp} />}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <OrderDetail
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          refreshApp={() => { refreshApp(); setSelectedOrder(db.orders.find(o => o.id === selectedOrder.id) || null); }}
        />
      )}

      {/* Scroll to Top Button */}
      {showScrollTop && (
        <button
          onClick={() => mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-24 md:bottom-8 right-4 md:right-8 w-12 h-12 bg-primary text-white rounded-full shadow-lg hover:bg-primaryDark transition-all flex items-center justify-center z-40"
          title="Về đầu trang"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      {/* Reset Data Modal - Admin Only */}
      {showResetModal && isAdmin && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100]">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="font-bold text-lg text-red-600 mb-4">⚠️ {t('reset_all_data')}</h3>
            <p className="text-sm text-slate-600 mb-4">
              {t('reset_warning')}
            </p>
            {resetError && (
              <div className="bg-red-50 text-red-600 p-2 rounded-lg mb-3 text-sm">{resetError}</div>
            )}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">{t('confirm_password')}</label>
              <input
                type="password"
                value={resetPassword}
                onChange={e => setResetPassword(e.target.value)}
                className="w-full border p-2 rounded-lg"
                placeholder={t('enter_your_password')}
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 py-2 border rounded-lg font-medium hover:bg-slate-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleReset}
                className="flex-1 py-2 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600"
              >
                {t('confirm_reset')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;

const NavButton = ({ active, onClick, icon, label, count, isSpecial }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-200 group relative overflow-hidden ${active
      ? 'bg-blue-600 text-white shadow-glow font-semibold'
      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
      } ${isSpecial ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg mt-4 border border-white/10' : ''}`}
  >
    {active && !isSpecial && <div className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full"></div>}
    <div className="flex items-center gap-3 relative z-10">
      <span className={`${active ? 'text-white' : isSpecial ? 'text-white' : 'text-slate-500 group-hover:text-white'}`}>{React.cloneElement(icon, { size: 20 })}</span>
      <span>{label}</span>
    </div>
    {count > 0 && (
      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${active ? 'bg-white text-blue-600' : 'bg-slate-700 text-white'}`}>
        {count}
      </span>
    )}
  </button>
);

const MobileNavBtn = ({ active, onClick, icon, isMain, label }: any) => (
  <button
    onClick={onClick}
    className={`relative flex flex-col items-center justify-center transition-all duration-300 ${isMain
      ? 'bg-blue-600 text-white -mt-6 w-14 h-14 rounded-2xl shadow-glow'
      : 'p-1 rounded-xl min-w-[50px]'
      }`}
  >
    <div>
      {React.cloneElement(icon, {
        size: isMain ? 24 : 20,
        className: isMain ? 'text-white' : active ? 'text-blue-600' : 'text-slate-400'
      })}
    </div>
    {!isMain && label && (
      <span className={`text-[10px] mt-0.5 ${active ? 'text-blue-600 font-medium' : 'text-slate-400'}`}>{label}</span>
    )}
  </button>
);