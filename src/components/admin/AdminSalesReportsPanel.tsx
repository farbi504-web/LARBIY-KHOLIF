import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { DollarSign, Package, TrendingUp } from 'lucide-react';
import { formatPriceDzd } from '../../shared/commerce.ts';
import type { Lang, Order } from '../../shared/types.ts';

export function AdminSalesReportsPanel({
  orders,
  lang,
}: {
  orders: Order[];
  lang: Lang;
}) {
  const [timeframe, setTimeframe] = useState<'30d' | '12m'>('30d');

  // Daily Sales for last 30 days
  const dailyData = useMemo(() => {
    const map = new Map<string, { date: string; revenue: number; count: number }>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, { date: label, revenue: 0, count: 0 });
    }

    for (const ord of orders) {
      if (ord.status === 'cancelled') continue;
      const key = ord.createdAt.slice(0, 10);
      if (map.has(key)) {
        const item = map.get(key)!;
        item.revenue += Number(ord.subtotal || 0);
        item.count += 1;
      }
    }
    return Array.from(map.values());
  }, [orders]);

  // Monthly Sales for last 12 months
  const monthlyData = useMemo(() => {
    const map = new Map<string, { month: string; revenue: number; count: number }>();
    const now = new Date();

    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-DZ', { month: 'short', year: '2-digit' });
      map.set(key, { month: label, revenue: 0, count: 0 });
    }

    for (const ord of orders) {
      if (ord.status === 'cancelled') continue;
      const key = ord.createdAt.slice(0, 7);
      if (map.has(key)) {
        const item = map.get(key)!;
        item.revenue += Number(ord.subtotal || 0);
        item.count += 1;
      }
    }
    return Array.from(map.values());
  }, [orders, lang]);

  const totalRevenue = useMemo(() => orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + Number(o.subtotal || 0), 0), [orders]);
  const totalOrders = useMemo(() => orders.filter(o => o.status !== 'cancelled').length, [orders]);
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg sm:text-xl font-extrabold text-[var(--ink)]">
            {lang === 'fr' ? 'Rapports de ventes' : 'تقارير المبيعات والإيرادات'}
          </h2>
          <p className="text-xs text-[var(--ink-muted)]">
            {lang === 'fr' ? 'Statistiques détaillées et graphiques de performance' : 'تحليلات وإحصائيات تفصيلية لأداء المتجر والمبيعات'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTimeframe('30d')}
            className={`h-9 rounded-lg px-3.5 text-xs font-bold cursor-pointer transition-colors ${
              timeframe === '30d'
                ? 'bg-[#111318] text-white dark:bg-[#D7193F]'
                : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)]'
            }`}
          >
            {lang === 'fr' ? '30 Derniers Jours' : 'آخر 30 يوم'}
          </button>
          <button
            type="button"
            onClick={() => setTimeframe('12m')}
            className={`h-9 rounded-lg px-3.5 text-xs font-bold cursor-pointer transition-colors ${
              timeframe === '12m'
                ? 'bg-[#111318] text-white dark:bg-[#D7193F]'
                : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)]'
            }`}
          >
            {lang === 'fr' ? '12 Derniers Mois' : 'آخر 12 شهر'}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="liquid-glass rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--ink-muted)]">
              {lang === 'fr' ? 'Revenu Total' : 'إجمالي الإيرادات'}
            </span>
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <p className="num text-2xl font-extrabold text-[var(--ink)]">
            {formatPriceDzd(totalRevenue, lang)}
          </p>
        </div>

        <div className="liquid-glass rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--ink-muted)]">
              {lang === 'fr' ? 'Total Commandes' : 'إجمالي الطلبات المؤكدة'}
            </span>
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <p className="num text-2xl font-extrabold text-[var(--ink)]">
            {totalOrders}
          </p>
        </div>

        <div className="liquid-glass rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[var(--ink-muted)]">
              {lang === 'fr' ? 'Panier Moyen' : 'متوسط قيمة السلة'}
            </span>
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <p className="num text-2xl font-extrabold text-[var(--ink)]">
            {formatPriceDzd(avgOrderValue, lang)}
          </p>
        </div>
      </div>

      {/* Recharts Main Chart */}
      <div className="liquid-glass rounded-2xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-extrabold text-[var(--ink)]">
            {timeframe === '30d' ? (lang === 'fr' ? 'Évolution des ventes (30 derniers jours)' : 'مخطط الإيرادات اليومية (آخر 30 يوم)') : (lang === 'fr' ? 'Évolution mensuelle des ventes (12 derniers mois)' : 'مخطط المبيعات الشهرية (آخر 12 شهر)')}
          </h3>
          <span className="text-xs font-bold text-[var(--ink-muted)]">Recharts</span>
        </div>

        <div className="h-[320px] w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            {timeframe === '30d' ? (
              <BarChart data={dailyData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: unknown) => [formatPriceDzd(Number(val) || 0, lang), lang === 'fr' ? 'Revenu' : 'الإيراد']}
                  contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '12px', fontSize: '12px' }}
                />
                <Bar dataKey="revenue" fill="#D7193F" radius={[6, 6, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: unknown) => [formatPriceDzd(Number(val) || 0, lang), lang === 'fr' ? 'Revenu' : 'الإيراد']}
                  contentStyle={{ background: 'var(--surface)', borderColor: 'var(--border)', borderRadius: '12px', fontSize: '12px' }}
                />
                <Line type="monotone" dataKey="revenue" stroke="#0B2D5B" strokeWidth={3} dot={{ r: 5 }} activeDot={{ r: 8 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
