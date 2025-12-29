import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { CreateOrder } from './components/CreateOrder';
import { ProductManager } from './components/ProductManager';
import { OrderDetail } from './components/OrderDetail';
import { Login } from './components/Login';
import { StaffManager } from './components/StaffManager';
import { InventoryForecast } from './components/InventoryForecast';
import { CustomerManager } from './components/CustomerManager';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { Scanner } from './components/Scanner';
import { CategoryManager } from './components/CategoryManager';
import { InventoryHistory } from './components/InventoryHistory';
import { QRGenerator } from './components/QRGenerator';
import { WarehouseDashboard } from './components/WarehouseDashboard';
import { AIChat } from './components/AiChat';
import { EquipmentSetManager } from './components/EquipmentSetManager';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';

import { LayoutDashboard, ShoppingCart, Box, RotateCcw, ChevronRight, Package, Truck, Users, LogOut, User, TrendingUp, UserCircle, ArrowUp, ScanLine, History, FolderOpen, QrCode, Warehouse } from 'lucide-react';
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
  const [view, setView] = useState<'DASHBOARD' | 'ORDERS' | 'INVENTORY' | 'STAFF' | 'FORECAST' | 'CUSTOMERS' | 'SCANNER' | 'HISTORY' | 'CATEGORIES' | 'QR_GENERATOR' | 'WAREHOUSE' | 'EQUIPMENT_SETS' | 'ANALYTICS'>('WAREHOUSE');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const mainRef = React.useRef<HTMLElement>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [tick, setTick] = useState(0);
  const [orderFilter, setOrderFilter] = useState<'ALL' | 'BOOKED' | 'ACTIVE' | 'COMPLETED' | 'OVERDUE'>('ALL');
  const [orderSearch, setOrderSearch] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(!!db.currentUser);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Deep linking: pending scan code from URL
  const [pendingScanCode, setPendingScanCode] = useState<string | null>(null);

  // Load data from cloud on mount
  React.useEffect(() => {
    const loadData = async () => {
      try {
        await db.init();

        // Check for deep link URL params
        const urlParams = new URLSearchParams(window.location.search);
        const scanCode = urlParams.get('code');
        if (scanCode) {
          // Store pending scan code - will be processed after login
          setPendingScanCode(scanCode);
          // Clean URL without refreshing page
          window.history.replaceState({}, '', window.location.pathname);
        }
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

  // Handle pending scan code after login
  React.useEffect(() => {
    if (isLoggedIn && pendingScanCode) {
      // Navigate to Scanner view with the pending code
      setView('SCANNER');
      // The Scanner component will read pendingScanCode
    }
  }, [isLoggedIn, pendingScanCode]);

  const handleLogout = () => {
    db.logout();
    setIsLoggedIn(false);
  };

  // Show loading screen
  if (isLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="text-center">
          <img
            src="/icons/icon.png"
            alt="高松大洋工芸"
            className="w-14 h-14 mx-auto rounded-xl object-contain bg-white p-2 mb-4 shadow-sm border border-stone-200 animate-pulse"
          />
          <p className="text-stone-500 font-medium text-sm">{t('loading')}</p>
        </div>
      </div>
    );
  }

  // Show passcode entry if deep link pending and not logged in
  if (!isLoggedIn && pendingScanCode) {
    const PasscodeEntry = React.lazy(() => import('./components/PasscodeEntry').then(m => ({ default: m.PasscodeEntry })));
    return (
      <React.Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center"><div className="text-white">{t('loading')}</div></div>}>
        <PasscodeEntry
          setCode={pendingScanCode}
          onSuccess={() => { setIsLoggedIn(true); setTick(t => t + 1); }}
          onCancel={() => { setPendingScanCode(null); }}
        />
      </React.Suspense>
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
    <div className="flex h-screen bg-[#F2F2F7] text-slate-800 font-sans overflow-hidden" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", sans-serif' }}>
      {/* Sidebar - iOS Style */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-[#E5E5EA] z-20">
        {/* Logo */}
        <div className="p-5 border-b border-[#E5E5EA]">
          <div className="flex items-center gap-3">
            <img
              src="/icons/icon.png"
              alt="高松大洋工芸"
              className="w-9 h-9 rounded-lg object-contain bg-white p-1 shadow-sm border border-stone-200"
            />
            <div>
              <h1 className="text-base font-semibold text-stone-800 leading-tight">高松大洋工芸</h1>
              <span className="text-[10px] font-medium text-stone-500 uppercase tracking-wider">Rental System</span>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4">
          {/* Main Section */}
          <div className="mb-4">
            <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-3 mb-2">メイン</p>
            <nav className="space-y-0.5">
              <NavButton active={view === 'ORDERS'} onClick={() => setView('ORDERS')} icon={<ShoppingCart />} label={t('nav_orders')} count={db.orders.filter(o => o.status === 'ACTIVE').length} />
              <NavButton active={view === 'INVENTORY'} onClick={() => setView('INVENTORY')} icon={<Box />} label={t('nav_inventory')} />
              <NavButton active={view === 'WAREHOUSE' || view === 'SCANNER'} onClick={() => setView('WAREHOUSE')} icon={<Warehouse />} label={t('warehouse_dashboard') || '倉庫'} isSpecial />
            </nav>
          </div>

          {/* Tools Section */}
          {db.currentUser?.role === 'admin' && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-3 mb-2">ツール</p>
              <nav className="space-y-0.5">
                <NavButton active={view === 'QR_GENERATOR'} onClick={() => setView('QR_GENERATOR')} icon={<QrCode />} label={t('nav_qr_generator')} />
                <NavButton active={view === 'EQUIPMENT_SETS'} onClick={() => setView('EQUIPMENT_SETS')} icon={<Package />} label={t('nav_equipment_sets')} />
                <NavButton active={view === 'ANALYTICS'} onClick={() => setView('ANALYTICS')} icon={<TrendingUp />} label={t('nav_analytics')} />
              </nav>
            </div>
          )}

          {/* Management Section */}
          {db.currentUser?.role === 'admin' && (
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-stone-400 uppercase tracking-wider px-3 mb-2">管理</p>
              <nav className="space-y-0.5">
                <NavButton active={view === 'CUSTOMERS'} onClick={() => setView('CUSTOMERS')} icon={<UserCircle />} label={t('nav_customers')} />
                <NavButton active={view === 'CATEGORIES'} onClick={() => setView('CATEGORIES')} icon={<FolderOpen />} label={t('nav_categories')} />
                <NavButton active={view === 'STAFF'} onClick={() => setView('STAFF')} icon={<Users />} label={t('nav_staff')} />
              </nav>
            </div>
          )}
        </div>

        {/* User Section */}
        <div className="p-3 border-t border-stone-200 bg-white">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-stone-100 transition-colors"
          >
            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center shrink-0 shadow-sm">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium text-stone-800 truncate">{db.currentUser?.name}</p>
              <p className="text-[11px] text-stone-400">{db.currentUser?.role === 'admin' ? t('role_admin') : t('role_staff')}</p>
            </div>
            <ChevronRight className={`w-4 h-4 text-stone-400 transition-transform ${showUserMenu ? 'rotate-90' : ''}`} />
          </button>

          {showUserMenu && (
            <div className="mt-2 pt-2 border-t border-stone-100 space-y-1">
              <button onClick={handleLogout} className="flex items-center text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 w-full px-3 py-2 rounded-md transition-colors gap-2">
                <LogOut className="w-3.5 h-3.5" /> {t('logout')}
              </button>
              {isAdmin && (
                <button onClick={() => { setShowResetModal(true); setResetPassword(''); setResetError(''); }} className="flex items-center text-xs text-stone-500 hover:text-red-600 hover:bg-red-50 w-full px-3 py-2 rounded-md transition-colors gap-2">
                  <RotateCcw className="w-3 h-3" /> {t('reset_data')}
                </button>
              )}
              <div className="flex justify-center py-2">
                <LanguageSwitcher />
              </div>
              <p className="text-[10px] text-center text-stone-400 pt-1">{t('version')} 2.4.0</p>
            </div>
          )}
        </div>
      </aside>

      {/* iOS-Style Tab Bar - Clear Labels */}
      <div className="md:hidden ios-tab-bar">
        <button
          onClick={() => setView('ORDERS')}
          className={`ios-tab-item ${view === 'ORDERS' ? 'active' : ''}`}
        >
          <ShoppingCart className="ios-tab-icon" />
          <span className="ios-tab-label">{t('nav_orders_short')}</span>
        </button>

        <button
          onClick={() => setView('WAREHOUSE')}
          className={`ios-tab-item ${view === 'WAREHOUSE' || view === 'SCANNER' ? 'active' : ''}`}
        >
          <Warehouse className="ios-tab-icon" />
          <span className="ios-tab-label">{t('nav_warehouse_short')}</span>
        </button>

        <button
          onClick={() => setView('INVENTORY')}
          className={`ios-tab-item ${view === 'INVENTORY' ? 'active' : ''}`}
        >
          <Box className="ios-tab-icon" />
          <span className="ios-tab-label">{t('nav_equipment_short')}</span>
        </button>
      </div>

      <main
        ref={mainRef}
        className="flex-1 overflow-auto relative scroll-smooth"
        onScroll={(e) => {
          const target = e.target as HTMLElement;
          setShowScrollTop(target.scrollTop > 300);
        }}
      >
        <div className="md:hidden p-4 ios-glass sticky top-0 z-30 border-b border-[#E5E5EA]/50 flex justify-between items-center pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="flex items-center gap-2">
            <img
              src="/icons/icon.png"
              alt="高松大洋工芸"
              className="w-8 h-8 rounded-lg object-contain bg-white p-0.5 shadow-lg border"
            />
            <div>
              <h1 className="font-bold text-slate-800 text-sm leading-tight">高松大洋工芸</h1>
              <p className="text-[10px] text-slate-500 font-medium">{db.currentUser?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === 'ORDERS' && (
              <button onClick={() => setShowCreateModal(true)} className="bg-[--ios-blue] text-white p-2.5 rounded-xl shadow-lg active:scale-95 transition-transform"><PlusIcon /></button>
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
            <div className="p-4 md:p-8 max-w-5xl mx-auto">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h1 className="text-xl md:text-2xl font-semibold text-stone-800">{t('orders_title')}</h1>
                  <p className="text-stone-400 text-sm hidden md:block">{t('track_transactions')}</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="hidden md:flex ios-button px-6 py-3 rounded-xl text-sm items-center gap-2"
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
                    className={`px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all ${orderFilter === tab.key
                      ? 'bg-[--ios-blue] text-white shadow-sm'
                      : 'bg-white text-slate-600 hover:bg-slate-50 border border-[#E5E5EA]'
                      }`}
                  >
                    {tab.label} {tab.count > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${orderFilter === tab.key ? 'bg-white/20' : 'bg-slate-100'}`}>{tab.count}</span>}
                  </button>
                ))}
              </div>

              {/* Search Input */}
              <div className="mb-4">
                <input
                  type="text"
                  value={orderSearch}
                  onChange={e => setOrderSearch(e.target.value)}
                  placeholder={t('search_order_placeholder') || 'Tìm theo khách hàng, ID đơn...'}
                  className="w-full md:w-80 px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
                />
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
                }).filter(o => {
                  if (!orderSearch.trim()) return true;
                  const search = orderSearch.toLowerCase();
                  const customer = db.customers.find(c => c.id === o.customerId);
                  return (
                    o.id.toString().includes(search) ||
                    customer?.name?.toLowerCase().includes(search) ||
                    customer?.phone?.includes(search)
                  );
                }).length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                    <ShoppingCart className="w-16 h-16 text-slate-200 mx-auto mb-4" />
                    <p className="text-slate-500 font-medium">{t('no_orders')}</p>
                    <button onClick={() => setShowCreateModal(true)} className="text-[--ios-blue] font-semibold mt-2 hover:underline">{t('create_now')}</button>
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
                }).filter(o => {
                  if (!orderSearch.trim()) return true;
                  const search = orderSearch.toLowerCase();
                  const customer = db.customers.find(c => c.id === o.customerId);
                  return (
                    o.id.toString().includes(search) ||
                    customer?.name?.toLowerCase().includes(search) ||
                    customer?.phone?.includes(search)
                  );
                }).slice().reverse().map(order => (
                  <div key={order.id} onClick={() => setSelectedOrder(order)} className="ios-card p-4 hover:shadow-md transition-all cursor-pointer group active:scale-[0.99]">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-semibold text-sm shrink-0 ${order.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-600' : order.status === 'COMPLETED' ? 'bg-blue-50 text-blue-600' : 'bg-stone-100 text-stone-500'
                          }`}>
                          #{order.id}
                        </div>
                        <div>
                          <h3 className="font-medium text-stone-800 group-hover:text-stone-900">{db.customers.find(c => c.id === order.customerId)?.name}</h3>
                          <div className="flex items-center gap-2 text-xs text-stone-400 mt-0.5">
                            <span>{order.items.length} {t('items_count')}</span>
                            <span>•</span>
                            <span>{new Date(order.rentalStartDate).toLocaleDateString('vi-VN')} → {new Date(order.expectedReturnDate).toLocaleDateString('vi-VN')}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 md:pl-0 pl-13">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-medium ${(() => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const startDate = new Date(order.rentalStartDate);
                          startDate.setHours(0, 0, 0, 0);
                          const isStarted = startDate <= today;
                          const isOverdue = new Date(order.expectedReturnDate) < new Date();

                          if ((order.status === 'ACTIVE' || (order.status === 'BOOKED' && isStarted)) && isOverdue) return 'bg-red-50 text-red-600';
                          if (order.status === 'ACTIVE' || (order.status === 'BOOKED' && isStarted)) return 'bg-emerald-50 text-emerald-600';
                          if (order.status === 'COMPLETED') return 'bg-blue-50 text-blue-600';
                          return 'bg-amber-50 text-amber-600';
                        })()
                          }`}>
                          {(() => {
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            const startDate = new Date(order.rentalStartDate);
                            startDate.setHours(0, 0, 0, 0);
                            const isStarted = startDate <= today;
                            const isOverdue = new Date(order.expectedReturnDate) < new Date();

                            if ((order.status === 'ACTIVE' || (order.status === 'BOOKED' && isStarted)) && isOverdue) return t('order_status_overdue');
                            if (order.status === 'ACTIVE' || (order.status === 'BOOKED' && isStarted)) return t('order_status_active');
                            if (order.status === 'COMPLETED') return t('order_status_completed');
                            return t('order_status_booked');
                          })()}
                        </span>
                        <ChevronRight className="w-4 h-4 text-stone-300 group-hover:text-stone-500 transition-colors" />
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

          {view === 'FORECAST' && <InventoryForecast refreshApp={refreshApp} />}

          {view === 'STAFF' && <StaffManager refreshApp={refreshApp} />}

          {view === 'CUSTOMERS' && <CustomerManager refreshApp={refreshApp} />}

          {view === 'SCANNER' && <Scanner refreshApp={refreshApp} pendingScanCode={pendingScanCode} onClearPendingCode={() => setPendingScanCode(null)} />}

          {view === 'HISTORY' && <InventoryHistory refreshApp={refreshApp} />}

          {view === 'CATEGORIES' && <CategoryManager refreshApp={refreshApp} />}

          {view === 'QR_GENERATOR' && <QRGenerator refreshApp={refreshApp} />}
          {view === 'EQUIPMENT_SETS' && <EquipmentSetManager refreshApp={refreshApp} />}

          {view === 'WAREHOUSE' && <WarehouseDashboard refreshApp={refreshApp} />}

          {view === 'ANALYTICS' && <AnalyticsDashboard refreshApp={refreshApp} />}
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

      {/* AI Chat Assistant - Admin Only */}
      {isAdmin && <AIChat refreshApp={refreshApp} />}

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
    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-150 group ${active
      ? 'bg-stone-200/80 text-stone-900 font-medium'
      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
      } ${isSpecial && !active ? 'text-indigo-600 hover:bg-indigo-50' : ''}`}
  >
    <div className="flex items-center gap-2.5">
      <span className={`${active ? 'text-stone-700' : isSpecial ? 'text-indigo-500' : 'text-stone-400 group-hover:text-stone-600'}`}>{React.cloneElement(icon, { size: 18 })}</span>
      <span className="text-[13px]">{label}</span>
    </div>
    {count > 0 && (
      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${active ? 'bg-stone-300 text-stone-700' : 'bg-stone-200 text-stone-600'}`}>
        {count}
      </span>
    )}
  </button>
);

const MobileNavBtn = ({ active, onClick, icon, isMain, label }: any) => (
  <button
    onClick={onClick}
    className={`relative flex flex-col items-center justify-center transition-all duration-200 ${isMain
      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white -mt-5 w-12 h-12 rounded-xl shadow-lg shadow-blue-500/30'
      : 'p-1 rounded-lg min-w-[52px]'
      }`}
  >
    <div>
      {React.cloneElement(icon, {
        size: isMain ? 22 : 20,
        strokeWidth: isMain || active ? 2.5 : 2,
        className: isMain ? 'text-white' : active ? 'text-blue-600' : 'text-stone-400'
      })}
    </div>
    {!isMain && label && (
      <span className={`text-[10px] mt-0.5 font-medium ${active ? 'text-blue-600' : 'text-stone-400'}`}>{label}</span>
    )}
  </button>
);