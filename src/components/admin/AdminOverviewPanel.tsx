import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Eye,
  FileWarning,
  Layers,
  MessageCircle,
  Package,
  ShoppingBag,
  ShoppingCart,
  Star,
  TrendingUp,
} from 'lucide-react';
import { computeDashboardMetrics, filterOrdersByTimeframe } from '../../shared/adminMetrics.ts';
import { resolveCategoryLabel } from '../../shared/categories.ts';
import { formatPriceDzd, formatWhatsAppDeliveryUrl } from '../../shared/commerce.ts';
import { TX } from '../../shared/i18n.ts';
import type {
  AdminReviewEntry,
  AdminTimeframe,
  CategoryItem,
  Lang,
  Order,
  OrderStatus,
  Product,
  SubscriptionRecord,
} from '../../shared/types.ts';
import { OrderStatsChart } from '../OrderStatsChart.tsx';
import { OrderStatusCharts } from '../OrderStatusCharts.tsx';

const STATUS_BADGE_MAP: Record<OrderStatus, string> = {
  pending: 'bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/25',
  pending_confirmation: 'bg-blue-500/12 text-blue-800 dark:text-blue-300 border-blue-500/25',
  confirmed: 'bg-blue-500/12 text-blue-800 dark:text-blue-300 border-blue-500/25',
  processing: 'bg-slate-500/12 text-slate-800 dark:text-slate-300 border-slate-500/25',
  ready_shipping: 'bg-purple-500/12 text-purple-800 dark:text-purple-300 border-purple-500/25',
  shipped: 'bg-cyan-500/12 text-cyan-800 dark:text-cyan-300 border-cyan-500/25',
  delivered: 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/25',
  cancelled: 'bg-rose-500/12 text-rose-800 dark:text-rose-300 border-rose-500/25',
  returned: 'bg-slate-500/12 text-slate-800 dark:text-slate-300 border-slate-500/25',
  failed_delivery: 'bg-rose-500/12 text-rose-800 dark:text-rose-300 border-rose-500/25',
};

export function AdminOverviewPanel({
  lang,
  orders,
  products,
  categories,
  subscriptions,
  reviews,
  canOrders,
  canProducts,
  canSubs,
  onNavigateTab,
  onInspectOrder,
  onUpdateOrderStatus,
  onFilterOrdersPreset,
  onFilterProductsUnavail,
}: {
  lang: Lang;
  orders: Order[];
  products: Product[];
  categories: CategoryItem[];
  subscriptions: SubscriptionRecord[];
  reviews: AdminReviewEntry[];
  canOrders: boolean;
  canProducts: boolean;
  canSubs: boolean;
  onNavigateTab: (
    tab: 'orders' | 'products' | 'categories' | 'subscriptions' | 'reviews' | 'settings' | 'assistant',
  ) => void;
  onInspectOrder: (order: Order) => void;
  onUpdateOrderStatus: (order: Order, status: OrderStatus) => Promise<void>;
  onFilterOrdersPreset: (preset: { status?: OrderStatus | 'all'; payStatus?: 'all' | 'pending_review' }) => void;
  onFilterProductsUnavail: () => void;
}) {
  const t = TX[lang];
  const [timeframe, setTimeframe] = useState<AdminTimeframe>('30d');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const metrics = useMemo(
    () =>
      computeDashboardMetrics({
        orders,
        products,
        categories,
        subscriptions,
        reviews,
        timeframe,
      }),
    [orders, products, categories, subscriptions, reviews, timeframe],
  );

  const scopedOrders = useMemo(
    () => filterOrdersByTimeframe(orders, timeframe),
    [orders, timeframe],
  );

  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 6),
    [orders],
  );

  const topProducts = useMemo(
    () =>
      [...products]
        .sort(
          (a, b) =>
            (b.salesCount || 0) - (a.salesCount || 0) || Number(b.featured) - Number(a.featured),
        )
        .slice(0, 4),
    [products],
  );

  const actionItems = useMemo(() => {
    const list: {
      id: string;
      count: number;
      label: string;
      icon: React.ReactNode;
      tone: string;
      onClick: () => void;
    }[] = [];

    if (canOrders && metrics.pendingOrders > 0) {
      list.push({
        id: 'pending-orders',
        count: metrics.pendingOrders,
        label: t.admin.workspace.pendingOrdersItem,
        icon: <ShoppingCart className="h-4 w-4" />,
        tone: 'text-amber-700 dark:text-amber-300 bg-amber-500/12',
        onClick: () => {
          onFilterOrdersPreset({ status: 'pending', payStatus: 'all' });
          onNavigateTab('orders');
        },
      });
    }

    if (canOrders && metrics.pendingReviewProofs > 0) {
      list.push({
        id: 'pending-proofs',
        count: metrics.pendingReviewProofs,
        label: t.admin.workspace.pendingProofsItem,
        icon: <CreditCard className="h-4 w-4" />,
        tone: 'text-[#D7193F] dark:text-[#FF6B86] bg-[#D7193F]/10',
        onClick: () => {
          onFilterOrdersPreset({ status: 'all', payStatus: 'pending_review' });
          onNavigateTab('orders');
        },
      });
    }

    if (canProducts && metrics.lowStockProducts.length > 0) {
      list.push({
        id: 'out-of-stock',
        count: metrics.lowStockProducts.length,
        label: t.admin.workspace.outOfStockItem,
        icon: <FileWarning className="h-4 w-4" />,
        tone: 'text-rose-700 dark:text-rose-300 bg-rose-500/12',
        onClick: () => {
          onFilterProductsUnavail();
          onNavigateTab('products');
        },
      });
    }

    if (canSubs && metrics.expiringSubscriptions.length > 0) {
      list.push({
        id: 'expiring-subs',
        count: metrics.expiringSubscriptions.length,
        label: t.admin.workspace.expiringSubsItem,
        icon: <CalendarClock className="h-4 w-4" />,
        tone: 'text-amber-700 dark:text-amber-300 bg-amber-500/12',
        onClick: () => onNavigateTab('subscriptions'),
      });
    }

    return list;
  }, [
    canOrders,
    canProducts,
    canSubs,
    metrics,
    t.admin.workspace,
    onFilterOrdersPreset,
    onFilterProductsUnavail,
    onNavigateTab,
  ]);

  function copyCode(code: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(code).catch(() => {});
    }
    setCopiedCode(code);
    setTimeout(() => setCopiedCode((prev) => (prev === code ? null : prev)), 1800);
  }

  const maxCatRevenue = Math.max(
    1,
    ...metrics.categoryPerformance.map((c) => c.revenue || 0),
    ...metrics.categoryPerformance.map((c) => c.productsCount),
  );

  const DirArrow = lang === 'ar' ? ArrowLeft : ArrowRight;

  return (
    <div className="space-y-5">
      {/* Header + Timeframe Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-extrabold text-[var(--ink)]">
            {t.admin.workspace.executiveTitle}
          </h2>
        </div>

        <div
          role="group"
          aria-label="Timeframe"
          className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-1 text-xs font-bold"
        >
          {(['today', '7d', '30d', 'all'] as AdminTimeframe[]).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setTimeframe(tf)}
              className={`rounded-md px-3 py-1.5 transition-colors cursor-pointer ${
                timeframe === tf
                  ? 'bg-[#111318] text-white dark:bg-[#D7193F]'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              {t.admin.timeframes[tf]}
            </button>
          ))}
        </div>
      </div>

      {/* 4 Primary KPI Cards — Strict single elevation, tabular-nums */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--ink-muted)]">
              {t.admin.kpi.totalRevenue}
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
              <TrendingUp className="h-4 w-4" />
            </span>
          </div>
          <p className="num text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
            {formatPriceDzd(metrics.confirmedRevenue, lang)}
          </p>
          <div className="pt-2.5 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
            <span>{t.admin.kpi.grossValue}</span>
            <span className="num font-bold text-[var(--ink)]">
              {formatPriceDzd(metrics.grossOrderValue, lang)}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--ink-muted)]">
              {t.admin.kpi.totalOrders}
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/12 text-blue-700 dark:text-blue-300">
              <ShoppingBag className="h-4 w-4" />
            </span>
          </div>
          <p className="num text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
            {metrics.totalOrders}
          </p>
          <div className="pt-2.5 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
            <span>{t.admin.kpi.fulfillmentRate}</span>
            <span className="num font-bold text-emerald-700 dark:text-emerald-300">
              {metrics.fulfillmentRate}% ({metrics.deliveredOrders}/{metrics.totalOrders})
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            if (!canOrders) return;
            onFilterOrdersPreset({ status: 'pending', payStatus: 'all' });
            onNavigateTab('orders');
          }}
          className={`text-start rounded-xl border p-4 sm:p-5 space-y-3 transition-colors ${
            metrics.pendingOrders > 0 || metrics.pendingReviewProofs > 0
              ? 'border-[#D7193F]/35 bg-[#D7193F]/[0.03] hover:border-[#D7193F]/60'
              : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--ink)]/25'
          } ${canOrders ? 'cursor-pointer' : ''}`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--ink-muted)]">
              {t.admin.kpi.pendingOrders}
            </span>
            <span
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ${
                metrics.pendingOrders > 0
                  ? 'bg-[#D7193F]/15 text-[#D7193F]'
                  : 'bg-[var(--surface-alt)] text-[var(--ink-muted)]'
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
            </span>
          </div>
          <p
            className={`num text-2xl sm:text-3xl font-extrabold ${
              metrics.pendingOrders > 0 ? 'text-[#D7193F]' : 'text-[var(--ink)]'
            }`}
          >
            {metrics.pendingOrders}
          </p>
          <div className="pt-2.5 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
            <span>CCP</span>
            <span className="num font-bold text-[var(--ink)]">
              {metrics.pendingReviewProofs} {lang === 'fr' ? 'à vérifier' : 'للمراجعة'}
            </span>
          </div>
        </button>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--ink-muted)]">
              {t.admin.kpi.activeProducts}
            </span>
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-alt)] text-[var(--ink)] border border-[var(--border)]">
              <Package className="h-4 w-4" />
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="num text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
              {products.length}
            </p>
            <button
              type="button"
              onClick={() => canProducts && onNavigateTab('reviews')}
              className="inline-flex items-center gap-1 rounded-md bg-amber-500/12 px-2 py-0.5 text-xs font-bold text-amber-800 dark:text-amber-300 cursor-pointer"
            >
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              <span className="num">{metrics.averageRating.toFixed(1)}</span>
              <span className="num opacity-75">({metrics.totalReviews})</span>
            </button>
          </div>
          <div className="pt-2.5 border-t border-[var(--border)] flex items-center justify-between text-[11px] text-[var(--ink-muted)]">
            <span>{t.admin.nav.subscriptions}</span>
            <span className="num font-bold text-[var(--ink)]">
              {metrics.activeSubscriptions} {lang === 'fr' ? 'actifs' : 'نشط'}
            </span>
          </div>
        </div>
      </div>

      {/* Operational Action Queue */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm font-extrabold text-[var(--ink)]">
            {t.admin.workspace.actionQueue}
          </h3>
          {actionItems.length === 0 && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              <span>{t.admin.workspace.allClear}</span>
            </span>
          )}
        </div>

        {actionItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {actionItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]/55 px-3.5 py-3 text-start hover:border-[#D7193F]/50 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.tone}`}
                  >
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="num text-base font-extrabold text-[var(--ink)]">{item.count}</p>
                    <p className="text-[11px] font-semibold text-[var(--ink-muted)] truncate">
                      {item.label}
                    </p>
                  </div>
                </div>
                <DirArrow className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Charts Section: Daily Volume / Revenue + Order Status Breakdown */}
      <OrderStatsChart orders={orders} lang={lang} daysWindow={timeframe === '30d' ? 30 : 7} />

      <OrderStatusCharts
        orders={scopedOrders}
        lang={lang}
        onSelectStatus={
          canOrders
            ? (status) => {
                onFilterOrdersPreset({ status, payStatus: 'all' });
                onNavigateTab('orders');
              }
            : undefined
        }
      />

      {/* Channel Mix & Category Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Physical vs Digital + Payment Methods */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-alt)] text-[#D7193F] border border-[var(--border)]">
              <CreditCard className="h-4.5 w-4.5" />
            </span>
            <h3 className="font-display text-sm sm:text-base font-extrabold text-[var(--ink)]">
              {t.admin.workspace.channelMix}
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]/50 p-3.5 space-y-1">
              <p className="text-xs font-bold text-[var(--ink-muted)]">
                {t.admin.workspace.physicalLabel}
              </p>
              <p className="num text-lg font-extrabold text-[var(--ink)]">
                {formatPriceDzd(metrics.physicalRevenue, lang)}
              </p>
              <p className="num text-[11px] text-[var(--ink-muted)]">
                {metrics.physicalOrders} {lang === 'fr' ? 'commande(s)' : 'طلب'}
              </p>
            </div>
            <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]/50 p-3.5 space-y-1">
              <p className="text-xs font-bold text-[var(--ink-muted)]">
                {t.admin.workspace.digitalLabel}
              </p>
              <p className="num text-lg font-extrabold text-[#D7193F]">
                {formatPriceDzd(metrics.digitalRevenue, lang)}
              </p>
              <p className="num text-[11px] text-[var(--ink-muted)]">
                {metrics.digitalOrders} {lang === 'fr' ? 'commande(s)' : 'طلب'}
              </p>
            </div>
          </div>

          <div className="space-y-2.5 pt-1">
            {metrics.paymentBreakdown.map((ch) => (
              <div key={ch.method} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-[var(--ink)]">{t.payLabels[ch.method]}</span>
                  <span className="num text-[var(--ink-muted)]">
                    {ch.ordersCount} ({ch.sharePct}%) · {formatPriceDzd(ch.revenue, lang)}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-alt)]">
                  <div
                    className={`h-full rounded-full transition-all ${
                      ch.method === 'chargily'
                        ? 'bg-emerald-600'
                        : ch.method === 'ccp'
                          ? 'bg-[#D7193F]'
                          : 'bg-[#111318] dark:bg-slate-400'
                    }`}
                    style={{ width: `${ch.sharePct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Category Performance across all 7 active categories */}
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-alt)] text-[#D7193F] border border-[var(--border)]">
                <Layers className="h-4.5 w-4.5" />
              </span>
              <h3 className="font-display text-sm sm:text-base font-extrabold text-[var(--ink)]">
                {t.admin.workspace.categoryPerf}
              </h3>
            </div>
            {canProducts && (
              <button
                type="button"
                onClick={() => onNavigateTab('categories')}
                className="text-xs font-bold text-[#D7193F] hover:underline cursor-pointer"
              >
                {t.admin.nav.categories}
              </button>
            )}
          </div>

          <div className="space-y-2.5">
            {metrics.categoryPerformance.map((catStat) => {
              const barPct =
                catStat.revenue > 0
                  ? Math.max(8, Math.round((catStat.revenue / maxCatRevenue) * 100))
                  : catStat.productsCount > 0
                    ? Math.max(8, Math.round((catStat.productsCount / maxCatRevenue) * 40))
                    : 0;

              return (
                <div key={catStat.categoryId} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-bold text-[var(--ink)] truncate">
                      {catStat.category.name[lang] ||
                        catStat.category.name.ar ||
                        resolveCategoryLabel(categories, catStat.categoryId, lang, t.services.items)}
                    </span>
                    <span className="num shrink-0 text-[11px] font-bold text-[var(--ink-muted)]">
                      {catStat.productsCount} {t.admin.categories.productsCount} ·{' '}
                      {catStat.unitsSold} {t.admin.workspace.unitsSold} ·{' '}
                      <span className="text-[var(--ink)]">{formatPriceDzd(catStat.revenue, lang)}</span>
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--surface-alt)]">
                    <div
                      className="h-full rounded-full bg-[#D7193F]"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Orders Table */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <h3 className="font-display text-sm sm:text-base font-extrabold text-[var(--ink)]">
              {t.admin.workspace.recentOrders}
            </h3>
            <span className="num rounded-md bg-[var(--surface-alt)] px-2 py-0.5 text-xs font-bold text-[var(--ink-muted)] border border-[var(--border)]">
              {orders.length}
            </span>
          </div>
          {canOrders && (
            <button
              type="button"
              onClick={() => onNavigateTab('orders')}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#D7193F] hover:underline cursor-pointer"
            >
              <span>{t.admin.workspace.viewAllOrders}</span>
              <DirArrow className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <ShoppingCart className="mx-auto h-7 w-7 text-[var(--ink-muted)]/50" />
            <p className="text-sm font-bold text-[var(--ink)]">{t.admin.orders.empty}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]/55 text-[var(--ink-muted)] text-[11px]">
                  <th className="px-4 py-3 text-start font-bold">
                    {lang === 'fr' ? 'Code' : 'الرمز'}
                  </th>
                  <th className="px-4 py-3 text-start font-bold">
                    {lang === 'fr' ? 'Client' : 'الزبون'}
                  </th>
                  <th className="px-4 py-3 text-start font-bold">
                    {lang === 'fr' ? 'Paiement' : 'الدفع'}
                  </th>
                  <th className="px-4 py-3 text-start font-bold">
                    {lang === 'fr' ? 'Statut' : 'الحالة'}
                  </th>
                  <th className="px-4 py-3 text-start font-bold">
                    {lang === 'fr' ? 'Total' : 'المبلغ'}
                  </th>
                  <th className="px-4 py-3 text-end font-bold">
                    {lang === 'fr' ? 'Actions' : 'إجراءات'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {recentOrders.map((ord) => {
                  const waHref = formatWhatsAppDeliveryUrl(ord, lang);
                  const isCopied = copiedCode === ord.code;
                  return (
                    <tr
                      key={ord.id}
                      className="hover:bg-[var(--surface-alt)]/45 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono font-bold whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => copyCode(ord.code)}
                          className="inline-flex items-center gap-1.5 text-[var(--ink)] hover:text-[#D7193F] cursor-pointer"
                        >
                          {isCopied ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3 opacity-55" />
                          )}
                          <span className="num">{ord.code}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="font-bold text-[var(--ink)]">{ord.customerName}</p>
                        <p className="num text-[11px] text-[var(--ink-muted)]">
                          {ord.customerPhone} · {ord.wilaya || 'Tipaza'}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="inline-flex rounded-md border border-[var(--border)] bg-[var(--surface-alt)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink)]">
                          {t.payLabels[ord.paymentMethod]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE_MAP[ord.status]}`}
                        >
                          {t.statuses[ord.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="num font-extrabold text-[var(--ink)]">
                          {formatPriceDzd(ord.subtotal, lang)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <select
                            value={ord.status}
                            aria-label={ord.code}
                            onChange={(e) =>
                              void onUpdateOrderStatus(ord, e.target.value as OrderStatus)
                            }
                            className="h-8 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-[11px] font-bold text-[var(--ink)] cursor-pointer"
                          >
                            {(
                              ['pending', 'confirmed', 'processing', 'delivered', 'cancelled'] as OrderStatus[]
                            ).map((s) => (
                              <option key={s} value={s}>
                                {t.statuses[s]}
                              </option>
                            ))}
                          </select>
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="WhatsApp"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => onInspectOrder(ord)}
                            aria-label={t.admin.orders.inspect}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-[11px] font-bold text-[var(--ink)] hover:border-[#D7193F] cursor-pointer"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>{t.admin.orders.inspect}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Products Snapshot */}
      {topProducts.length > 0 && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-3.5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm sm:text-base font-extrabold text-[var(--ink)]">
              {t.admin.workspace.topProducts}
            </h3>
            {canProducts && (
              <button
                type="button"
                onClick={() => onNavigateTab('products')}
                className="inline-flex items-center gap-1 text-xs font-bold text-[#D7193F] hover:underline cursor-pointer"
              >
                <span>{t.admin.workspace.manageCatalog}</span>
                <DirArrow className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {topProducts.map((p) => (
              <div
                key={p.id}
                className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]/45 p-3"
              >
                {p.img ? (
                  <img
                    src={p.img}
                    alt=""
                    referrerPolicy="no-referrer"
                    className="h-12 w-12 rounded-lg object-cover shrink-0 border border-[var(--border)]"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--ink-muted)] shrink-0">
                    <Package className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="font-display text-xs font-extrabold text-[var(--ink)] truncate">
                    {p.name[lang] || p.name.ar}
                  </p>
                  <p className="num text-xs font-extrabold text-[#D7193F]">
                    {formatPriceDzd(p.price, lang)}
                  </p>
                  <p className="num text-[10px] text-[var(--ink-muted)]">
                    {p.salesCount} {lang === 'fr' ? 'ventes' : 'مبيعة'} ·{' '}
                    {p.avail ? t.catalog.available : t.catalog.unavailable}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
