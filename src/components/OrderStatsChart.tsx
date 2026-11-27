import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { BarChart3 } from 'lucide-react';
import { formatPriceDzd } from '../shared/commerce.ts';
import type { Lang, Order } from '../shared/types.ts';

interface DayBucket {
  dateKey: string;
  shortLabel: string;
  fullLabel: string;
  count: number;
  revenue: number;
}

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function OrderStatsChart({
  orders,
  lang,
  daysWindow = 7,
}: {
  orders: Order[];
  lang: Lang;
  daysWindow?: 7 | 30;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [width, setWidth] = useState(640);
  const [metric, setMetric] = useState<'count' | 'revenue'>('count');
  const [windowDays, setWindowDays] = useState<7 | 30>(daysWindow);
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  );
  const [hovered, setHovered] = useState<{
    day: DayBucket;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    setWindowDays(daysWindow);
  }, [daysWindow]);

  const buckets = useMemo<DayBucket[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const locale = lang === 'fr' ? 'fr-FR' : 'ar-DZ';
    const dayMap = new Map<string, { count: number; revenue: number }>();

    for (const order of orders) {
      const parsed = new Date(order.createdAt);
      if (Number.isNaN(parsed.getTime())) continue;
      const key = toLocalDateKey(parsed);
      const prev = dayMap.get(key) || { count: 0, revenue: 0 };
      prev.count += 1;
      if (order.status !== 'cancelled') {
        prev.revenue += Number(order.subtotal || 0);
      }
      dayMap.set(key, prev);
    }

    const result: DayBucket[] = [];
    for (let offset = windowDays - 1; offset >= 0; offset--) {
      const d = new Date(today);
      d.setDate(today.getDate() - offset);
      const key = toLocalDateKey(d);
      const stats = dayMap.get(key) || { count: 0, revenue: 0 };
      const shortLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      const fullLabel = d.toLocaleDateString(locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      });
      result.push({
        dateKey: key,
        shortLabel,
        fullLabel,
        count: stats.count,
        revenue: stats.revenue,
      });
    }
    return result;
  }, [orders, lang, windowDays]);

  const totalCount = useMemo(
    () => buckets.reduce((sum, b) => sum + b.count, 0),
    [buckets],
  );
  const totalRevenue = useMemo(
    () => buckets.reduce((sum, b) => sum + b.revenue, 0),
    [buckets],
  );
  const peakDayCount = useMemo(
    () => Math.max(0, ...buckets.map((b) => b.count)),
    [buckets],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const next = Math.max(280, Math.floor(el.getBoundingClientRect().width));
      setWidth(next);
    };
    updateWidth();
    const ro = new ResizeObserver(updateWidth);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.classList.contains('dark'));
    syncTheme();
    const mo = new MutationObserver(syncTheme);
    mo.observe(root, { attributes: true, attributeFilter: ['class'] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const getVal = (b: DayBucket) => (metric === 'revenue' ? b.revenue : b.count);
    const height = 240;
    const margin = { top: 20, right: 16, bottom: 32, left: metric === 'revenue' ? 54 : 36 };
    const innerW = Math.max(120, width - margin.left - margin.right);
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3
      .scaleBand<string>()
      .domain(buckets.map((b) => b.shortLabel))
      .range([0, innerW])
      .padding(windowDays === 30 ? 0.24 : 0.34);

    const maxVal = d3.max(buckets, getVal) || 0;
    const yUpper = metric === 'revenue' ? Math.max(1000, Math.ceil(maxVal * 1.18)) : Math.max(4, Math.ceil(maxVal * 1.2));
    const y = d3.scaleLinear().domain([0, yUpper]).nice().range([innerH, 0]);

    const rawTicks = y.ticks(4);
    const yTicks = metric === 'revenue' ? rawTicks : rawTicks.filter((v) => Number.isInteger(v));

    g.append('g')
      .attr('class', 'grid-lines')
      .selectAll('line')
      .data(yTicks)
      .join('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', (d) => y(d))
      .attr('y2', (d) => y(d))
      .attr('stroke', 'currentColor')
      .attr('stroke-opacity', 0.1)
      .attr('stroke-dasharray', '3 3');

    const yAxis = d3
      .axisLeft(y)
      .tickValues(yTicks)
      .tickFormat((d) => {
        const n = Number(d);
        if (metric === 'revenue' && n >= 1000) return `${Math.round(n / 1000)}k`;
        return String(n);
      })
      .tickSize(0)
      .tickPadding(8);

    const yAxisG = g.append('g').call(yAxis);
    yAxisG.select('.domain').remove();
    yAxisG
      .selectAll('text')
      .attr('fill', 'currentColor')
      .attr('opacity', 0.6)
      .style('font-size', '11px')
      .style('font-variant-numeric', 'tabular-nums')
      .style('font-family', 'Plus Jakarta Sans, system-ui, sans-serif');

    const xTickValues =
      windowDays === 30
        ? buckets.filter((_, i) => i % 5 === 0 || i === buckets.length - 1).map((b) => b.shortLabel)
        : buckets.map((b) => b.shortLabel);

    const xAxis = d3.axisBottom(x).tickValues(xTickValues).tickSize(0).tickPadding(10);
    const xAxisG = g
      .append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(xAxis);
    xAxisG.select('.domain').attr('stroke', 'currentColor').attr('stroke-opacity', 0.16);
    xAxisG
      .selectAll('text')
      .attr('fill', 'currentColor')
      .attr('opacity', 0.75)
      .style('font-size', '11px')
      .style('font-weight', '600')
      .style('font-variant-numeric', 'tabular-nums')
      .style('font-family', 'Plus Jakarta Sans, system-ui, sans-serif');

    const barBaseFill = isDark ? '#475569' : '#111318';
    const barTodayFill = '#D7193F';
    const barHoverFill = '#D7193F';

    const bars = g
      .selectAll<SVGRectElement, DayBucket>('rect.order-bar')
      .data(buckets, (d) => d.dateKey)
      .join('rect')
      .attr('class', 'order-bar')
      .attr('x', (d) => x(d.shortLabel) ?? 0)
      .attr('width', x.bandwidth())
      .attr('rx', windowDays === 30 ? 3 : 6)
      .attr('ry', windowDays === 30 ? 3 : 6)
      .attr('y', innerH)
      .attr('height', 0)
      .attr('fill', (_d, idx) => (idx === buckets.length - 1 ? barTodayFill : barBaseFill))
      .attr('opacity', (d) => (getVal(d) === 0 ? 0.16 : 0.9))
      .style('cursor', 'pointer');

    bars
      .transition()
      .duration(360)
      .ease(d3.easeCubicOut)
      .attr('y', (d) => (getVal(d) === 0 ? innerH - 3 : y(getVal(d))))
      .attr('height', (d) => (getVal(d) === 0 ? 3 : Math.max(4, innerH - y(getVal(d)))));

    if (windowDays === 7) {
      g.selectAll<SVGTextElement, DayBucket>('text.bar-val')
        .data(buckets.filter((b) => getVal(b) > 0), (d) => d.dateKey)
        .join('text')
        .attr('class', 'bar-val')
        .attr('x', (d) => (x(d.shortLabel) ?? 0) + x.bandwidth() / 2)
        .attr('y', (d) => y(getVal(d)) - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', 'currentColor')
        .attr('opacity', 0.85)
        .style('font-size', '11px')
        .style('font-weight', '700')
        .style('font-variant-numeric', 'tabular-nums')
        .style('font-family', 'Plus Jakarta Sans, system-ui, sans-serif')
        .text((d) => (metric === 'revenue' ? `${Math.round(d.revenue / 100) / 10}k` : String(d.count)));
    }

    g.selectAll<SVGRectElement, DayBucket>('rect.bar-hit')
      .data(buckets, (d) => d.dateKey)
      .join('rect')
      .attr('class', 'bar-hit')
      .attr('x', (d) => x(d.shortLabel) ?? 0)
      .attr('width', x.bandwidth())
      .attr('y', 0)
      .attr('height', innerH)
      .attr('fill', 'transparent')
      .style('cursor', 'pointer')
      .on('mouseenter', function (_event, d) {
        d3.selectAll<SVGRectElement, DayBucket>('rect.order-bar')
          .filter((b) => b.dateKey === d.dateKey)
          .attr('fill', barHoverFill)
          .attr('opacity', 1);

        const barX = margin.left + (x(d.shortLabel) ?? 0) + x.bandwidth() / 2;
        const barY = margin.top + Math.max(8, y(getVal(d)) - 10);
        setHovered({ day: d, x: barX, y: barY });
      })
      .on('mouseleave', function (_event, d) {
        const idx = buckets.findIndex((b) => b.dateKey === d.dateKey);
        d3.selectAll<SVGRectElement, DayBucket>('rect.order-bar')
          .filter((b) => b.dateKey === d.dateKey)
          .attr('fill', idx === buckets.length - 1 ? barTodayFill : barBaseFill)
          .attr('opacity', getVal(d) === 0 ? 0.16 : 0.9);
        setHovered(null);
      })
      .on('click', function (_event, d) {
        const barX = margin.left + (x(d.shortLabel) ?? 0) + x.bandwidth() / 2;
        const barY = margin.top + Math.max(8, y(getVal(d)) - 10);
        setHovered((prev) =>
          prev?.day.dateKey === d.dateKey ? null : { day: d, x: barX, y: barY },
        );
      });
  }, [buckets, width, isDark, metric, windowDays]);

  const title =
    lang === 'fr'
      ? `Activité des ${windowDays} derniers jours`
      : `النشاط خلال آخر ${windowDays} ${windowDays === 7 ? 'أيام' : 'يومًا'}`;
  const subtitle =
    metric === 'revenue'
      ? lang === 'fr'
        ? 'Revenus quotidiens hors commandes annulées'
        : 'المداخيل اليومية باستثناء الطلبات الملغاة'
      : lang === 'fr'
        ? 'Volume quotidien des commandes reçues'
        : 'التطور اليومي لعدد الطلبات المستلمة';

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-alt)] text-[#D7193F] border border-[var(--border)]">
            <BarChart3 className="h-4.5 w-4.5" />
          </span>
          <div>
            <h2 className="font-display text-sm sm:text-base font-extrabold text-[var(--ink)]">
              {title}
            </h2>
            <p className="text-xs text-[var(--ink-muted)]">{subtitle}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-0.5 text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setMetric('count')}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                metric === 'count'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              {lang === 'fr' ? 'Commandes' : 'الطلبات'}
            </button>
            <button
              type="button"
              onClick={() => setMetric('revenue')}
              className={`rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                metric === 'revenue'
                  ? 'bg-[var(--surface)] text-[var(--ink)] shadow-xs'
                  : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              {lang === 'fr' ? 'Revenu' : 'المداخيل'}
            </button>
          </div>

          <div className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] p-0.5 text-[11px] font-bold">
            {([7, 30] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setWindowDays(days)}
                className={`num rounded-md px-2.5 py-1 transition-colors cursor-pointer ${
                  windowDays === days
                    ? 'bg-[#D7193F] text-white'
                    : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}
              >
                {days}J
              </button>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs font-bold">
            <span className="num rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-2.5 py-1 text-[var(--ink)]">
              {metric === 'revenue'
                ? formatPriceDzd(totalRevenue, lang)
                : lang === 'fr'
                  ? `${totalCount} cmd`
                  : `${totalCount} طلب`}
            </span>
            <span className="num rounded-lg bg-[#D7193F]/10 px-2.5 py-1 text-[#D7193F] dark:text-[#FF6B86]">
              {lang === 'fr' ? `Pic ${peakDayCount}/j` : `الذروة ${peakDayCount}/ي`}
            </span>
          </div>
        </div>
      </div>

      <div ref={containerRef} dir="ltr" className="relative w-full text-[var(--ink)]">
        <svg
          ref={svgRef}
          role="img"
          aria-label={title}
          className="w-full overflow-visible select-none"
        />

        {hovered && (
          <div
            style={{
              left: `${Math.min(Math.max(hovered.x, 76), Math.max(76, width - 76))}px`,
              top: `${Math.max(0, hovered.y - 54)}px`,
            }}
            className="pointer-events-none absolute -translate-x-1/2 z-10 rounded-lg bg-[#111318] px-3 py-2 text-white shadow-lg border border-white/15 whitespace-nowrap"
          >
            <p className="text-[11px] font-bold text-white/75">{hovered.day.fullLabel}</p>
            <p className="num text-xs font-extrabold">
              {hovered.day.count} {lang === 'fr' ? 'commande(s)' : 'طلب'} ·{' '}
              {formatPriceDzd(hovered.day.revenue, lang)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
