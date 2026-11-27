import React, { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Layers, PieChart as PieChartIcon } from 'lucide-react';
import { TX } from '../shared/i18n.ts';
import { formatPriceDzd } from '../shared/commerce.ts';
import type { Lang, Order, OrderStatus } from '../shared/types.ts';

interface StatusGroupDatum {
  key: 'in_progress' | 'completed' | 'cancelled';
  name: string;
  count: number;
  revenue: number;
  pct: number;
  color: string;
}

interface DetailedStatusDatum {
  status: OrderStatus;
  name: string;
  count: number;
  revenue: number;
  color: string;
}

function CustomPieTooltip({
  active,
  payload,
  lang,
}: {
  active?: boolean;
  payload?: Array<{ payload?: StatusGroupDatum }>;
  lang: Lang;
}) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg bg-[#111318] px-3 py-2 text-white shadow-lg border border-white/15 text-xs space-y-0.5">
      <p className="font-bold text-white/85">{item.name}</p>
      <p className="num font-extrabold">
        {item.count} {lang === 'fr' ? 'commande(s)' : 'طلب'} ({item.pct}%)
      </p>
      <p className="num text-[11px] text-white/75">{formatPriceDzd(item.revenue, lang)}</p>
    </div>
  );
}

function CustomBarTooltip({
  active,
  payload,
  lang,
}: {
  active?: boolean;
  payload?: Array<{ payload?: DetailedStatusDatum }>;
  lang: Lang;
}) {
  if (!active || !payload?.length || !payload[0]?.payload) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg bg-[#111318] px-3 py-2 text-white shadow-lg border border-white/15 text-xs space-y-0.5">
      <p className="font-bold text-white/85">{item.name}</p>
      <p className="num font-extrabold">
        {item.count} {lang === 'fr' ? 'commande(s)' : 'طلب'}
      </p>
      <p className="num text-[11px] text-white/75">{formatPriceDzd(item.revenue, lang)}</p>
    </div>
  );
}

export function OrderStatusCharts({
  orders,
  lang,
  onSelectStatus,
}: {
  orders: Order[];
  lang: Lang;
  onSelectStatus?: (status: OrderStatus) => void;
}) {
  const t = TX[lang];
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIsDark(root.classList.contains('dark'));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);

  const totalOrders = orders.length;

  const groupData = useMemo<StatusGroupDatum[]>(() => {
    let inProgressCount = 0;
    let inProgressRev = 0;
    let completedCount = 0;
    let completedRev = 0;
    let cancelledCount = 0;
    let cancelledRev = 0;

    for (const o of orders) {
      const amt = Number(o.subtotal || 0);
      if (o.status === 'delivered') {
        completedCount += 1;
        completedRev += amt;
      } else if (o.status === 'cancelled') {
        cancelledCount += 1;
        cancelledRev += amt;
      } else {
        inProgressCount += 1;
        inProgressRev += amt;
      }
    }

    const pct = (n: number) => (totalOrders > 0 ? Math.round((n / totalOrders) * 100) : 0);

    return [
      {
        key: 'in_progress',
        name: lang === 'fr' ? 'En cours' : 'قيد المعالجة',
        count: inProgressCount,
        revenue: inProgressRev,
        pct: pct(inProgressCount),
        color: '#D97706',
      },
      {
        key: 'completed',
        name: lang === 'fr' ? 'Complétées' : 'مكتملة',
        count: completedCount,
        revenue: completedRev,
        pct: pct(completedCount),
        color: '#059669',
      },
      {
        key: 'cancelled',
        name: lang === 'fr' ? 'Annulées' : 'ملغاة',
        count: cancelledCount,
        revenue: cancelledRev,
        pct: pct(cancelledCount),
        color: '#D7193F',
      },
    ];
  }, [orders, lang, totalOrders]);

  const activePieSlices = useMemo(
    () => groupData.filter((d) => d.count > 0),
    [groupData],
  );

  const detailedData = useMemo<DetailedStatusDatum[]>(() => {
    const statuses: OrderStatus[] = [
      'pending',
      'pending_confirmation',
      'confirmed',
      'processing',
      'ready_shipping',
      'shipped',
      'delivered',
      'cancelled',
      'returned',
      'failed_delivery',
    ];

    const counts: Record<OrderStatus, { count: number; revenue: number }> = {
      pending: { count: 0, revenue: 0 },
      pending_confirmation: { count: 0, revenue: 0 },
      confirmed: { count: 0, revenue: 0 },
      processing: { count: 0, revenue: 0 },
      ready_shipping: { count: 0, revenue: 0 },
      shipped: { count: 0, revenue: 0 },
      delivered: { count: 0, revenue: 0 },
      cancelled: { count: 0, revenue: 0 },
      returned: { count: 0, revenue: 0 },
      failed_delivery: { count: 0, revenue: 0 },
    };

    for (const o of orders) {
      if (counts[o.status]) {
        counts[o.status].count += 1;
        counts[o.status].revenue += Number(o.subtotal || 0);
      }
    }

    const colors: Record<OrderStatus, string> = {
      pending: '#D97706',
      pending_confirmation: '#3B82F6',
      confirmed: '#2563EB',
      processing: isDark ? '#94A3B8' : '#111318',
      ready_shipping: '#8B5CF6',
      shipped: '#0EA5E9',
      delivered: '#059669',
      cancelled: '#D7193F',
      returned: '#64748B',
      failed_delivery: '#E11D48',
    };

    return statuses
      .filter((status) => counts[status].count > 0)
      .map((status) => ({
        status,
        name: t.statuses[status],
        count: counts[status].count,
        revenue: counts[status].revenue,
        color: colors[status],
      }));
  }, [orders, isDark, t.statuses]);

  const completionRate = useMemo(() => {
    const completed = groupData.find((g) => g.key === 'completed')?.count || 0;
    return totalOrders > 0 ? Math.round((completed / totalOrders) * 100) : 0;
  }, [groupData, totalOrders]);

  const axisTickColor = isDark ? 'rgba(247,247,249,0.72)' : 'rgba(17,19,24,0.72)';
  const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(17,19,24,0.08)';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-alt)] text-[#D7193F] border border-[var(--border)]">
              <PieChartIcon className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="font-display text-sm sm:text-base font-extrabold text-[var(--ink)]">
                {lang === 'fr' ? 'Répartition des commandes par statut' : 'توزيع الطلبات حسب الحالة'}
              </h2>
              <p className="text-xs text-[var(--ink-muted)]">
                {lang === 'fr'
                  ? 'En cours, complétées et annulées'
                  : 'قيد المعالجة، مكتملة، وملغاة'}
              </p>
            </div>
          </div>

          <span className="num rounded-lg bg-emerald-500/12 px-2.5 py-1 text-xs font-extrabold text-emerald-700 dark:text-emerald-300">
            {lang === 'fr' ? `Taux : ${completionRate}%` : `الإكمال: ${completionRate}%`}
          </span>
        </div>

        {totalOrders === 0 ? (
          <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-alt)]/50 text-xs font-semibold text-[var(--ink-muted)]">
            {lang === 'fr'
              ? 'Aucune commande enregistrée pour afficher la répartition.'
              : 'لا توجد طلبات مسجلة لعرض التوزيع بعد.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-12 items-center gap-4">
            <div dir="ltr" className="sm:col-span-6 relative h-52 min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={activePieSlices}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={activePieSlices.length > 1 ? 3 : 0}
                    stroke="none"
                  >
                    {activePieSlices.map((entry) => (
                      <Cell key={entry.key} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip lang={lang} />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="num text-2xl font-extrabold text-[var(--ink)]">{totalOrders}</span>
                <span className="text-[11px] font-semibold text-[var(--ink-muted)]">
                  {lang === 'fr' ? 'Total' : 'الإجمالي'}
                </span>
              </div>
            </div>

            <div className="sm:col-span-6 space-y-2">
              {groupData.map((g) => (
                <div
                  key={g.key}
                  className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]/50 px-3 py-2.5"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: g.color }}
                    />
                    <span className="text-xs font-bold text-[var(--ink)] truncate">{g.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="num text-xs font-extrabold text-[var(--ink)]">{g.count}</span>
                    <span className="num rounded bg-[var(--surface)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--ink-muted)] border border-[var(--border)]">
                      {g.pct}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-alt)] text-[#D7193F] border border-[var(--border)]">
              <Layers className="h-4.5 w-4.5" />
            </span>
            <div>
              <h2 className="font-display text-sm sm:text-base font-extrabold text-[var(--ink)]">
                {lang === 'fr' ? 'Détail des étapes de commande' : 'تفصيل مراحل وحالات الطلبات'}
              </h2>
              <p className="text-xs text-[var(--ink-muted)]">
                {lang === 'fr'
                  ? 'Volume par statut détaillé du flux'
                  : 'توزّع الطلبات عبر جميع المراحل الخمس'}
              </p>
            </div>
          </div>
        </div>

        {totalOrders === 0 ? (
          <div className="flex h-52 items-center justify-center rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-alt)]/50 text-xs font-semibold text-[var(--ink-muted)]">
            {lang === 'fr'
              ? 'Aucune commande enregistrée pour afficher les étapes.'
              : 'لا توجد طلبات مسجلة لعرض المراحل بعد.'}
          </div>
        ) : (
          <div dir="ltr" className="h-52 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={detailedData}
                margin={{ top: 12, right: 12, left: -16, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: axisTickColor, fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: axisTickColor, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(17,19,24,0.04)' }}
                  content={<CustomBarTooltip lang={lang} />}
                />
                <Bar
                  dataKey="count"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={42}
                  onClick={(entry) => {
                    const st = (entry as unknown as DetailedStatusDatum)?.status;
                    if (st && onSelectStatus) onSelectStatus(st);
                  }}
                  style={{ cursor: onSelectStatus ? 'pointer' : 'default' }}
                >
                  {detailedData.map((entry) => (
                    <Cell key={entry.status} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
