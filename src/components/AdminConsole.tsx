import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  CalendarClock,
  KeyRound,
  Layers,
  LogOut,
  Menu,
  Moon,
  Package,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Store,
  Sun,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { TX } from '../shared/i18n.ts';
import { sanitizeAiMessages } from '../shared/aiHelpers.ts';
import type {
  AdminAiMessage,
  AdminCustomerSummary,
  AdminReviewEntry,
  AuditEntry,
  CategoryItem,
  Lang,
  Order,
  OrderStatus,
  PaymentStatus,
  Product,
  StaffPermission,
  StaffUser,
  SubscriptionRecord,
} from '../shared/types.ts';
import { apiJson, setAdminToken } from '../utils/api.ts';
import {
  AdminCategoriesPanel,
  AdminProductsPanel,
  AdminSettingsPanel,
} from './AdminProductsAndSettings.tsx';
import { AdminAiAssistant } from './AdminAiAssistant.tsx';
import { SlimiLogoMark } from './ServiceArtwork.tsx';
import { AdminOverviewPanel } from './admin/AdminOverviewPanel.tsx';
import { AdminOrdersPanel } from './admin/AdminOrdersPanel.tsx';
import {
  AdminCustomersPanel,
  AdminReviewsPanel,
} from './admin/AdminCustomersAndReviewsPanel.tsx';
import {
  AdminAuditPanel,
  AdminStaffPanel,
  AdminSubscriptionsPanel,
} from './admin/AdminSubscriptionsAndTeamPanel.tsx';
import { AdminQuickPalette } from './admin/AdminQuickPalette.tsx';
import { AdminSalesReportsPanel } from './admin/AdminSalesReportsPanel.tsx';

type AdminTab =
  | 'dashboard'
  | 'assistant'
  | 'orders'
  | 'reports'
  | 'categories'
  | 'products'
  | 'reviews'
  | 'customers'
  | 'subscriptions'
  | 'staff'
  | 'settings'
  | 'audit';

export function AdminConsole({
  lang,
  dark,
  logoUrl,
  onToggleLang,
  onToggleTheme,
  onBackToStore,
  onNavigateStore,
  onStoreDataChanged,
}: {
  lang: Lang;
  dark: boolean;
  logoUrl?: string;
  onToggleLang: () => void;
  onToggleTheme: () => void;
  onBackToStore: () => void;
  onNavigateStore?: (view: 'home' | 'shop') => void;
  onStoreDataChanged: () => void;
}) {
  const t = TX[lang];

  const [authChecked, setAuthChecked] = useState(false);
  const [needsClaim, setNeedsClaim] = useState(false);
  const [user, setUser] = useState<StaffUser | null>(null);

  // Login / Claim state
  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Navigation & Overlays
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Admin Data
  const [kpis, setKpis] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    pendingOrders: 0,
    expiringSubs: 0,
  });
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<AdminReviewEntry[]>([]);
  const [customers, setCustomers] = useState<AdminCustomerSummary[]>([]);
  const [subs, setSubs] = useState<SubscriptionRecord[]>([]);
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);

  // Cross-panel Filter & Inspector State
  const [orderStatusFilter, setOrderStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [orderPayStatusFilter, setOrderPayStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [productAvailPreset, setProductAvailPreset] = useState<'all' | 'avail' | 'unavail'>('all');
  const [subPrefill, setSubPrefill] = useState<{
    orderId?: string | null;
    orderCode?: string;
    customerName: string;
    customerPhone: string;
    serviceName: string;
    planLabel: string;
    accountInfo: string;
  } | null>(null);

  // AI Assistant state
  const [aiMessages, setAiMessages] = useState<AdminAiMessage[]>([]);
  const [aiSending, setAiSending] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLastFailedPrompt, setAiLastFailedPrompt] = useState<string | null>(null);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);

  // UI helpers
  const [proofPreview, setProofPreview] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkStatus = useCallback(async () => {
    const res = await apiJson<{
      authenticated: boolean;
      needsClaim: boolean;
      user: StaffUser | null;
      token?: string | null;
    }>('/api/admin/status');
    setNeedsClaim(res.needsClaim);
    if (res.token) {
      setAdminToken(res.token);
    }
    setUser(res.user);
    setAuthChecked(true);
  }, []);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  // Keyboard Ctrl+K / Cmd+K for Command Palette
  useEffect(() => {
    if (!user) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [user]);

  const loadTabData = useCallback(async (activeTab: AdminTab, activeUser: StaffUser) => {
    const can = (perm: StaffPermission) =>
      activeUser.role === 'owner' || activeUser.permissions.includes(perm);

    if (activeTab === 'dashboard') {
      const dash = await apiJson<{
        kpis: typeof kpis;
        recentOrders: Order[];
      }>('/api/admin/dashboard');
      setKpis(dash.kpis);

      const tasks: Promise<void>[] = [];
      if (can('orders')) {
        tasks.push(
          apiJson<{ orders: Order[] }>('/api/admin/orders')
            .then((r) => setOrders(r.orders || []))
            .catch(() => setOrders(dash.recentOrders || [])),
        );
      } else {
        setOrders(dash.recentOrders || []);
      }

      if (can('products')) {
        tasks.push(
          apiJson<{ categories: CategoryItem[] }>('/api/admin/categories')
            .then((r) => setCategories(r.categories || []))
            .catch(() => {}),
        );
        tasks.push(
          apiJson<{ products: Product[] }>('/api/admin/products')
            .then((r) => setProducts(r.products || []))
            .catch(() => {}),
        );
        tasks.push(
          apiJson<{ reviews: AdminReviewEntry[] }>('/api/admin/reviews')
            .then((r) => setReviews(r.reviews || []))
            .catch(() => {}),
        );
      }

      if (can('subscriptions')) {
        tasks.push(
          apiJson<{ subscriptions: SubscriptionRecord[] }>('/api/admin/subscriptions')
            .then((r) => setSubs(r.subscriptions || []))
            .catch(() => {}),
        );
      }
      await Promise.all(tasks);
    } else if (activeTab === 'orders' && can('orders')) {
      const ordRes = await apiJson<{ orders: Order[] }>('/api/admin/orders');
      setOrders(ordRes.orders || []);
    } else if (activeTab === 'categories' && can('products')) {
      const catRes = await apiJson<{ categories: CategoryItem[] }>('/api/admin/categories');
      setCategories(catRes.categories || []);
    } else if (activeTab === 'products' && can('products')) {
      const [catRes, prdRes] = await Promise.all([
        apiJson<{ categories: CategoryItem[] }>('/api/admin/categories'),
        apiJson<{ products: Product[] }>('/api/admin/products'),
      ]);
      setCategories(catRes.categories || []);
      setProducts(prdRes.products || []);
    } else if (activeTab === 'reviews' && can('products')) {
      const [catRes, revRes] = await Promise.all([
        apiJson<{ categories: CategoryItem[] }>('/api/admin/categories'),
        apiJson<{ reviews: AdminReviewEntry[] }>('/api/admin/reviews'),
      ]);
      setCategories(catRes.categories || []);
      setReviews(revRes.reviews || []);
    } else if (activeTab === 'customers' && can('orders')) {
      const custRes = await apiJson<{ customers: AdminCustomerSummary[] }>('/api/admin/customers');
      setCustomers(custRes.customers || []);
    } else if (activeTab === 'subscriptions' && can('subscriptions')) {
      const subRes = await apiJson<{ subscriptions: SubscriptionRecord[] }>(
        '/api/admin/subscriptions',
      );
      setSubs(subRes.subscriptions || []);
    } else if (activeTab === 'staff' && can('staff')) {
      const stfRes = await apiJson<{ staff: StaffUser[] }>('/api/admin/staff');
      setStaff(stfRes.staff || []);
    } else if (activeTab === 'audit' && can('audit')) {
      const audRes = await apiJson<{ logs: AuditEntry[] }>('/api/admin/audit');
      setAuditLogs(audRes.logs || []);
    }
  }, []);

  useEffect(() => {
    if (user) {
      void loadTabData(tab, user);
    }
  }, [user, tab, loadTabData]);

  useEffect(() => {
    if (!user) {
      setAiMessages([]);
      setAiLastFailedPrompt(null);
      return;
    }
    apiJson<{ messages?: AdminAiMessage[] }>('/api/admin/ai/history')
      .then((res) => setAiMessages(sanitizeAiMessages(res?.messages)))
      .catch(() => {});
  }, [user]);

  async function handleSendAi(text: string) {
    if (!user) return;
    const cleanText = text.trim();
    if (!cleanText) return;
    setAiError(null);
    setAiLastFailedPrompt(null);
    const tempId = 'tmp_' + Date.now();
    const optimistic: AdminAiMessage = {
      id: tempId,
      role: 'user',
      content: cleanText,
      createdAt: new Date().toISOString(),
    };
    setAiMessages((prev) => [...sanitizeAiMessages(prev), optimistic]);
    setAiSending(true);
    try {
      const res = await apiJson<{
        userMessage?: AdminAiMessage;
        assistantMessage?: AdminAiMessage;
        dataChanged?: boolean;
        navigateTab?: string;
        openStoreView?: 'home' | 'shop';
      }>('/api/admin/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: cleanText, lang, activeTab: tab }),
      });

      const returnedMsgs = sanitizeAiMessages([res?.userMessage, res?.assistantMessage]);
      if (returnedMsgs.length === 0) {
        throw new Error(
          lang === 'fr'
            ? 'Réponse invalide reçue de l’assistant IA.'
            : 'تم استلام استجابة غير مكتملة من المساعد الذكي.',
        );
      }

      setAiMessages((prev) => [
        ...sanitizeAiMessages(prev).filter((m) => m.id !== tempId),
        ...returnedMsgs,
      ]);

      const targetTab = (res?.navigateTab as AdminTab | undefined) || tab;
      if (res?.navigateTab && res.navigateTab !== tab) {
        setTab(targetTab);
      }
      if (res?.dataChanged) {
        void loadTabData(targetTab, user);
        onStoreDataChanged();
      }
      if (res?.openStoreView && onNavigateStore) {
        onNavigateStore(res.openStoreView);
      }
    } catch (err) {
      setAiMessages((prev) => sanitizeAiMessages(prev).filter((m) => m.id !== tempId));
      setAiLastFailedPrompt(cleanText);
      setAiError(err instanceof Error ? err.message : 'AI request failed');
    } finally {
      setAiSending(false);
    }
  }

  async function handleRetryAi() {
    if (!aiLastFailedPrompt || aiSending) return;
    const retryText = aiLastFailedPrompt;
    setAiLastFailedPrompt(null);
    await handleSendAi(retryText);
  }

  async function handleClearAi() {
    setAiError(null);
    setAiLastFailedPrompt(null);
    await apiJson('/api/admin/ai/history', { method: 'DELETE' });
    setAiMessages([]);
  }

  async function handleClaim(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    if (password.length < 8) {
      setAuthError(
        lang === 'fr' ? '8 caractères minimum.' : 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.',
      );
      return;
    }
    if (password !== confirmPassword) {
      setAuthError(
        lang === 'fr' ? 'Les mots de passe ne correspondent pas.' : 'كلمتا المرور غير متطابقتين.',
      );
      return;
    }
    try {
      const res = await apiJson<{ user: StaffUser; token?: string }>('/api/admin/claim', {
        method: 'POST',
        body: JSON.stringify({ password }),
      });
      if (res.token) setAdminToken(res.token);
      setNeedsClaim(false);
      setUser(res.user);
      setPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Error');
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await apiJson<{ user: StaffUser; token?: string }>('/api/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      if (res.token) setAdminToken(res.token);
      setUser(res.user);
      setPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Login failed');
    }
  }

  async function handleLogout() {
    await apiJson('/api/logout', { method: 'POST' });
    setAdminToken(null);
    setUser(null);
  }

  async function handleUpdateOrder(
    order: Order,
    patch: {
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      deliveryData?: string;
      notes?: string;
    },
  ): Promise<Order | null> {
    const res = await apiJson<{ order: Order }>(`/api/admin/orders/${order.id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (res.order) {
      setOrders((prev) => prev.map((o) => (o.id === res.order.id ? res.order : o)));
      if (user) {
        apiJson<{ kpis: typeof kpis }>('/api/admin/dashboard')
          .then((d) => setKpis(d.kpis))
          .catch(() => {});
      }
      return res.order;
    }
    return null;
  }

  async function handleBulkOrderStatus(ids: string[], status: OrderStatus) {
    await apiJson('/api/admin/orders/bulk-status', {
      method: 'PATCH',
      body: JSON.stringify({ ids, status }),
    });
    if (user) {
      await loadTabData('orders', user);
      apiJson<{ kpis: typeof kpis }>('/api/admin/dashboard')
        .then((d) => setKpis(d.kpis))
        .catch(() => {});
    }
  }

  async function handleRefresh() {
    if (!user) return;
    setIsRefreshing(true);
    try {
      await loadTabData(tab, user);
    } finally {
      setTimeout(() => setIsRefreshing(false), 350);
    }
  }

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-sm font-bold text-[var(--ink-muted)]">
        ...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col justify-center bg-[var(--bg)] px-4 py-12">
        <div className="mx-auto w-full max-w-md space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <SlimiLogoMark logoUrl={logoUrl} size={36} variant={dark ? 'dark' : 'light'} />
              <span className="font-display text-base font-extrabold text-[var(--ink)]">
                {t.brand}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleLang}
                className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-bold text-[var(--ink)] cursor-pointer"
              >
                {lang === 'ar' ? 'FR' : 'عربي'}
              </button>
              <button
                type="button"
                onClick={onToggleTheme}
                aria-label="Toggle theme"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] cursor-pointer"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8 space-y-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <KeyRound className="h-5 w-5 text-[#D7193F]" />
                <h1 className="font-display text-lg font-extrabold text-[var(--ink)]">
                  {needsClaim ? t.admin.claimTitle : t.admin.loginTitle}
                </h1>
              </div>
              <button
                type="button"
                onClick={onBackToStore}
                className="text-xs font-bold text-[#D7193F] hover:underline cursor-pointer"
              >
                {t.admin.backToStore}
              </button>
            </div>

            {needsClaim ? (
              <form onSubmit={handleClaim} className="space-y-4">
                <p className="text-xs leading-relaxed text-[var(--ink-muted)]">{t.admin.claimDesc}</p>
                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.admin.password}</span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.admin.confirmPassword}</span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm"
                  />
                </label>
                {authError && (
                  <p className="rounded-lg bg-rose-500/10 p-3 text-xs font-bold text-rose-600">
                    {authError}
                  </p>
                )}
                <button
                  type="submit"
                  className="h-11 w-full rounded-lg bg-[#D7193F] text-sm font-extrabold text-white hover:bg-[#B81434] transition-colors cursor-pointer"
                >
                  {t.admin.claimBtn}
                </button>
              </form>
            ) : (
              <form onSubmit={handleLogin} className="space-y-4">
                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.admin.username}</span>
                  <input
                    type="text"
                    required
                    dir="ltr"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-bold">{t.admin.password}</span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 text-sm"
                  />
                </label>
                {authError && (
                  <p className="rounded-lg bg-rose-500/10 p-3 text-xs font-bold text-rose-600">
                    {authError}
                  </p>
                )}
                <button
                  type="submit"
                  className="h-11 w-full rounded-lg bg-[#D7193F] text-sm font-extrabold text-white hover:bg-[#B81434] transition-colors cursor-pointer"
                >
                  {t.admin.loginBtn}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  const can = (perm: StaffPermission) => user.role === 'owner' || user.permissions.includes(perm);

  const navItems: {
    id: AdminTab;
    label: string;
    icon: React.ReactNode;
    show: boolean;
    badge?: number;
    badgeTone?: string;
  }[] = [
    {
      id: 'dashboard',
      label: t.admin.nav.dashboard,
      icon: <Activity className="h-4 w-4" />,
      show: true,
    },
    {
      id: 'assistant',
      label: t.admin.nav.assistant,
      icon: <Sparkles className="h-4 w-4 text-[#D7193F]" />,
      show: true,
    },
    {
      id: 'orders',
      label: t.admin.nav.orders,
      icon: <ShoppingCart className="h-4 w-4" />,
      show: can('orders'),
      badge: kpis.pendingOrders > 0 ? kpis.pendingOrders : undefined,
      badgeTone: 'bg-[#D7193F] text-white',
    },
    {
      id: 'products',
      label: t.admin.nav.products,
      icon: <Package className="h-4 w-4" />,
      show: can('products'),
    },
    {
      id: 'categories',
      label: t.admin.nav.categories,
      icon: <Layers className="h-4 w-4" />,
      show: can('products'),
    },
    {
      id: 'reviews',
      label: t.admin.nav.reviews,
      icon: <Star className="h-4 w-4" />,
      show: can('products'),
    },
    {
      id: 'customers',
      label: t.admin.nav.customers,
      icon: <UserCheck className="h-4 w-4" />,
      show: can('orders'),
    },
    {
      id: 'subscriptions',
      label: t.admin.nav.subscriptions,
      icon: <CalendarClock className="h-4 w-4" />,
      show: can('subscriptions'),
      badge: kpis.expiringSubs > 0 ? kpis.expiringSubs : undefined,
      badgeTone: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
    },
    {
      id: 'staff',
      label: t.admin.nav.staff,
      icon: <Users className="h-4 w-4" />,
      show: can('staff'),
    },
    {
      id: 'reports',
      label: lang === 'fr' ? 'Rapports de ventes' : 'تقارير المبيعات',
      icon: <BarChart3 className="h-4 w-4" />,
      show: can('orders'),
    },
    {
      id: 'settings',
      label: t.admin.nav.settings,
      icon: <Settings className="h-4 w-4" />,
      show: can('settings'),
    },
    {
      id: 'audit',
      label: t.admin.nav.audit,
      icon: <ShieldCheck className="h-4 w-4" />,
      show: can('audit'),
    },
  ];

  const visibleNavItems = navItems.filter((item) => item.show);
  const activeNavItem = visibleNavItems.find((item) => item.id === tab);

  function selectTab(next: AdminTab) {
    setTab(next);
    setMobileMenuOpen(false);
  }

  function SidebarBody() {
    return (
      <div className="flex h-full flex-col justify-between p-4 space-y-5">
        <div className="space-y-5">
          {/* Brand */}
          <div className="flex items-center gap-3 pb-4 border-b border-[var(--border)]">
            <SlimiLogoMark logoUrl={logoUrl} size={36} variant={dark ? 'dark' : 'light'} />
            <div className="min-w-0 flex-1">
              <p className="font-display text-sm font-extrabold text-[var(--ink)] truncate">
                {t.brand}
              </p>
              <p className="text-[11px] font-bold text-[var(--ink-muted)] truncate">
                {user?.displayName} ·{' '}
                <span className="text-[#D7193F]">
                  {user?.role === 'owner'
                    ? lang === 'fr'
                      ? 'Propriétaire'
                      : 'المالك'
                    : lang === 'fr'
                      ? 'Équipe'
                      : 'مشرف'}
                </span>
              </p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {visibleNavItems.map((item) => {
              const isActive = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectTab(item.id)}
                  className={`w-full flex items-center justify-between gap-2.5 rounded-lg px-3 py-2.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#D7193F] text-white'
                      : 'text-[var(--ink-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className={isActive ? 'text-white' : ''}>{item.icon}</span>
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`num inline-flex h-5 min-w-5 items-center justify-center rounded px-1.5 text-[10px] font-extrabold ${
                        isActive ? 'bg-white/20 text-white' : item.badgeTone
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Storefront + Logout */}
        <div className="space-y-2 pt-4 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={onBackToStore}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]/60 text-xs font-bold text-[var(--ink)] hover:border-[#D7193F] cursor-pointer"
          >
            <Store className="h-3.5 w-3.5 text-[#D7193F]" />
            <span>{t.admin.backToStore}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleLogout()}
            className="w-full flex items-center justify-center gap-2 h-9 rounded-lg text-xs font-bold text-rose-600 hover:bg-rose-500/10 cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{t.admin.logout}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[var(--bg)] text-[var(--ink)]">
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 border-e border-[var(--border)] bg-[var(--surface)] sticky top-0 h-screen overflow-y-auto no-print">
        <SidebarBody />
      </aside>

      {/* Mobile Sidebar Drawer */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden bg-black/55 no-print"
          onClick={() => setMobileMenuOpen(false)}
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="h-full w-72 bg-[var(--surface)] border-e border-[var(--border)] overflow-y-auto relative"
          >
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label={t.gallery.close}
              className="absolute top-3 end-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--ink)] cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarBody />
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Sticky Top Command Bar */}
        <header className="sticky top-0 z-30 h-16 border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-6 flex items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label={lang === 'fr' ? 'Menu de navigation' : 'قائمة الإدارة'}
              className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--ink)] cursor-pointer"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-[var(--ink-muted)]">
                <span className="hidden sm:inline">{t.admin.title}</span>
                <span className="hidden sm:inline">/</span>
                <h1 className="font-display text-sm sm:text-base font-extrabold text-[var(--ink)] truncate">
                  {activeNavItem?.label || t.admin.nav.dashboard}
                </h1>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Ctrl+K Command Trigger */}
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label={t.admin.workspace.searchShortcut}
              title={t.admin.workspace.searchShortcut}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]/60 px-3 text-xs font-bold text-[var(--ink-muted)] hover:border-[#D7193F] hover:text-[var(--ink)] cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{t.admin.workspace.searchShortcut}</span>
              <kbd
                dir="ltr"
                className="hidden md:inline-block rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[10px] font-bold"
              >
                Ctrl+K
              </kbd>
            </button>

            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              title={t.admin.workspace.refresh}
              aria-label={t.admin.workspace.refresh}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 sm:px-3 text-xs font-bold text-[var(--ink)] hover:border-[#D7193F] cursor-pointer"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#D7193F]' : ''}`}
              />
              <span className="hidden xl:inline">{t.admin.workspace.refresh}</span>
            </button>

            <button
              type="button"
              onClick={onToggleLang}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-bold text-[var(--ink)] hover:border-[#D7193F] cursor-pointer"
            >
              {lang === 'ar' ? 'FR' : 'عربي'}
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Toggle theme"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:border-[#D7193F] cursor-pointer"
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {onNavigateStore && (
              <button
                type="button"
                onClick={() => onNavigateStore('home')}
                className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[#D7193F] cursor-pointer"
              >
                <Store className="h-3.5 w-3.5 text-[#D7193F]" />
                <span className="hidden md:inline">{t.admin.workspace.storefront}</span>
                <ArrowUpRight className="h-3 w-3 opacity-60" />
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (tab === 'assistant') return;
                setAiDrawerOpen((v) => !v);
              }}
              aria-label={t.admin.ai.floatingBtn}
              title={t.admin.ai.floatingBtn}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-extrabold text-white hover:opacity-95 cursor-pointer ${
                aiDrawerOpen || tab === 'assistant'
                  ? 'bg-[#D7193F]'
                  : 'bg-[#111318] dark:bg-[#D7193F]'
              }`}
            >
              <Sparkles
                className={`h-3.5 w-3.5 ${
                  aiDrawerOpen || tab === 'assistant'
                    ? 'text-white'
                    : 'text-[#FF6B86] dark:text-white'
                }`}
              />
              <span className="hidden sm:inline">{t.admin.nav.assistant}</span>
            </button>
          </div>
        </header>

        {/* Active Workspace Container */}
        <main className="flex-1 mx-auto w-full max-w-[1440px] px-4 sm:px-6 py-5 sm:py-6 pb-10">
          {tab === 'dashboard' && (
            <AdminOverviewPanel
              lang={lang}
              orders={orders}
              products={products}
              categories={categories}
              subscriptions={subs}
              reviews={reviews}
              canOrders={can('orders')}
              canProducts={can('products')}
              canSubs={can('subscriptions')}
              onNavigateTab={(target) => selectTab(target)}
              onInspectOrder={(ord) => {
                setSelectedOrderId(ord.id);
                selectTab('orders');
              }}
              onUpdateOrderStatus={async (ord, status) => {
                await handleUpdateOrder(ord, { status });
              }}
              onFilterOrdersPreset={(preset) => {
                if (preset.status) setOrderStatusFilter(preset.status);
                if (preset.payStatus) setOrderPayStatusFilter(preset.payStatus);
              }}
              onFilterProductsUnavail={() => setProductAvailPreset('unavail')}
            />
          )}

          {tab === 'assistant' && (
            <AdminAiAssistant
              lang={lang}
              messages={aiMessages}
              sending={aiSending}
              error={aiError}
              lastFailedPrompt={aiLastFailedPrompt}
              variant="full"
              onSend={handleSendAi}
              onRetry={handleRetryAi}
              onClear={handleClearAi}
            />
          )}

          {tab === 'orders' && (
            <AdminOrdersPanel
              lang={lang}
              orders={orders}
              statusFilter={orderStatusFilter}
              payStatusFilter={orderPayStatusFilter}
              selectedOrderId={selectedOrderId}
              onStatusFilterChange={setOrderStatusFilter}
              onPayStatusFilterChange={setOrderPayStatusFilter}
              onSelectOrder={setSelectedOrderId}
              onUpdateOrder={handleUpdateOrder}
              onBulkUpdateStatus={handleBulkOrderStatus}
              onCreateSubscriptionFromOrder={(ord) => {
                const firstDigital =
                  ord.items.find((it) => it.type === 'digital' || it.cat === 'subs') ||
                  ord.items[0];
                setSubPrefill({
                  orderId: ord.id,
                  orderCode: ord.code,
                  customerName: ord.customerName,
                  customerPhone: ord.customerPhone,
                  serviceName: firstDigital
                    ? firstDigital.name[lang] || firstDigital.name.ar
                    : '',
                  planLabel: firstDigital?.planLabel
                    ? firstDigital.planLabel[lang] || firstDigital.planLabel.ar
                    : '',
                  accountInfo: ord.billRef || ord.deliveryData || '',
                });
                selectTab('subscriptions');
              }}
              onOpenProof={setProofPreview}
            />
          )}

          {tab === 'categories' && (
            <AdminCategoriesPanel
              lang={lang}
              categories={categories}
              onReload={() => {
                void loadTabData('categories', user);
                onStoreDataChanged();
              }}
            />
          )}

          {tab === 'products' && (
            <AdminProductsPanel
              lang={lang}
              products={products}
              categories={categories}
              availPreset={productAvailPreset}
              onClearAvailPreset={() => setProductAvailPreset('all')}
              onReload={() => {
                void loadTabData('products', user);
                onStoreDataChanged();
              }}
            />
          )}

          {tab === 'reviews' && (
            <AdminReviewsPanel
              lang={lang}
              reviews={reviews}
              categories={categories}
              onDeleteReview={async (id) => {
                await apiJson(`/api/admin/reviews/${id}`, { method: 'DELETE' });
                await loadTabData('reviews', user);
                onStoreDataChanged();
              }}
            />
          )}

          {tab === 'customers' && <AdminCustomersPanel lang={lang} customers={customers} />}

          {tab === 'subscriptions' && (
            <AdminSubscriptionsPanel
              lang={lang}
              subs={subs}
              prefill={subPrefill}
              onClearPrefill={() => setSubPrefill(null)}
              onCreateSub={async (payload) => {
                await apiJson('/api/admin/subscriptions', {
                  method: 'POST',
                  body: JSON.stringify(payload),
                });
                await loadTabData('subscriptions', user);
              }}
              onUpdateSub={async (id, patch) => {
                await apiJson(`/api/admin/subscriptions/${id}`, {
                  method: 'PATCH',
                  body: JSON.stringify(patch),
                });
                await loadTabData('subscriptions', user);
              }}
              onDeleteSub={async (id) => {
                await apiJson(`/api/admin/subscriptions/${id}`, { method: 'DELETE' });
                await loadTabData('subscriptions', user);
              }}
            />
          )}

          {tab === 'staff' && (
            <AdminStaffPanel
              lang={lang}
              staff={staff}
              onCreateStaff={async (payload) => {
                await apiJson('/api/admin/staff', {
                  method: 'POST',
                  body: JSON.stringify(payload),
                });
                await loadTabData('staff', user);
              }}
              onUpdateStaff={async (id, patch) => {
                await apiJson(`/api/admin/staff/${id}`, {
                  method: 'PATCH',
                  body: JSON.stringify(patch),
                });
                await loadTabData('staff', user);
              }}
              onDeleteStaff={async (id) => {
                await apiJson(`/api/admin/staff/${id}`, { method: 'DELETE' });
                await loadTabData('staff', user);
              }}
            />
          )}

          {tab === 'reports' && (
            <AdminSalesReportsPanel orders={orders} lang={lang} />
          )}

          {tab === 'settings' && (
            <AdminSettingsPanel
              lang={lang}
              onSettingsUpdated={onStoreDataChanged}
              onOpenCategories={can('products') ? () => selectTab('categories') : undefined}
            />
          )}

          {tab === 'audit' && <AdminAuditPanel lang={lang} auditLogs={auditLogs} />}
        </main>
      </div>

      {/* Quick Command Palette (Ctrl+K) */}
      <AdminQuickPalette
        open={paletteOpen}
        lang={lang}
        navItems={visibleNavItems.map((n) => ({ id: n.id, label: n.label, icon: n.icon }))}
        orders={orders}
        products={products}
        canOrders={can('orders')}
        canProducts={can('products')}
        onClose={() => setPaletteOpen(false)}
        onNavigateTab={(id) => selectTab(id as AdminTab)}
        onInspectOrder={(ord) => {
          setSelectedOrderId(ord.id);
          selectTab('orders');
        }}
        onFilterPendingProofs={() => {
          setOrderStatusFilter('all');
          setOrderPayStatusFilter('pending_review');
          selectTab('orders');
        }}
        onFilterOutOfStock={() => {
          setProductAvailPreset('unavail');
          selectTab('products');
        }}
      />

      {/* Payment Proof Lightbox */}
      {proofPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 no-print"
          onClick={() => setProofPreview(null)}
        >
          <img
            src={proofPreview}
            alt="Payment proof"
            className="max-h-[85vh] rounded-xl object-contain shadow-2xl"
          />
        </div>
      )}

      {/* Quick AI Copilot Drawer (toggled from sticky command bar; full workspace stays in sidebar) */}
      {aiDrawerOpen && tab !== 'assistant' && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:w-[460px] z-50 shadow-2xl no-print">
          <AdminAiAssistant
            lang={lang}
            messages={aiMessages}
            sending={aiSending}
            error={aiError}
            lastFailedPrompt={aiLastFailedPrompt}
            variant="drawer"
            onSend={handleSendAi}
            onRetry={handleRetryAi}
            onClear={handleClearAi}
            onClose={() => setAiDrawerOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
