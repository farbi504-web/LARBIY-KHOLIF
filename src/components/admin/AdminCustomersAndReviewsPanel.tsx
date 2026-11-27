import React, { useMemo, useState } from 'react';
import { MessageCircle, Search, Star, Trash2, Users } from 'lucide-react';
import { resolveCategoryLabel } from '../../shared/categories.ts';
import { formatPriceDzd, normalizeAlgerianPhone } from '../../shared/commerce.ts';
import { TX } from '../../shared/i18n.ts';
import type {
  AdminCustomerSummary,
  AdminReviewEntry,
  CategoryItem,
  Lang,
} from '../../shared/types.ts';

export function AdminReviewsPanel({
  lang,
  reviews,
  categories,
  onDeleteReview,
}: {
  lang: Lang;
  reviews: AdminReviewEntry[];
  categories: CategoryItem[];
  onDeleteReview: (id: string) => Promise<void>;
}) {
  const t = TX[lang];
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState<'all' | 5 | 4 | 3 | 2 | 1>('all');
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const total = reviews.length;
    const sum = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0);
    const fiveStarCount = reviews.filter((r) => Number(r.rating) === 5).length;
    return {
      total,
      average: total > 0 ? Math.round((sum / total) * 10) / 10 : 0,
      fiveStarPct: total > 0 ? Math.round((fiveStarCount / total) * 100) : 0,
    };
  }, [reviews]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviews.filter((r) => {
      if (ratingFilter !== 'all' && Number(r.rating) !== ratingFilter) return false;
      if (q) {
        const pname = `${r.productName?.ar || ''} ${r.productName?.fr || ''}`.toLowerCase();
        if (
          !pname.includes(q) &&
          !r.authorName.toLowerCase().includes(q) &&
          !(r.comment || '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [reviews, search, ratingFilter]);

  async function confirmDelete(id: string) {
    setDeletingId(id);
    try {
      await onDeleteReview(id);
      setConfirmId(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg sm:text-xl font-extrabold text-[var(--ink)]">
          {t.admin.reviews.title}
        </h2>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[var(--ink-muted)]">{t.admin.reviews.average}</p>
            <p className="num text-2xl font-extrabold text-[var(--ink)] mt-0.5">
              {stats.average.toFixed(1)}
            </p>
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/12 text-amber-500">
            <Star className="h-5 w-5 fill-amber-500" />
          </span>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs font-bold text-[var(--ink-muted)]">{t.admin.reviews.total}</p>
          <p className="num text-2xl font-extrabold text-[var(--ink)] mt-0.5">{stats.total}</p>
        </div>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-xs font-bold text-[var(--ink-muted)]">
            {t.admin.reviews.fiveStarShare}
          </p>
          <p className="num text-2xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">
            {stats.fiveStarPct}%
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 h-4 w-4 text-[var(--ink-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.admin.reviews.searchPlaceholder}
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] ps-9 pe-3 text-xs sm:text-sm"
          />
        </div>
        <select
          value={ratingFilter}
          onChange={(e) =>
            setRatingFilter(
              e.target.value === 'all' ? 'all' : (Number(e.target.value) as 5 | 4 | 3 | 2 | 1),
            )
          }
          className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold"
        >
          <option value="all">{t.admin.reviews.allRatings}</option>
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} ★
            </option>
          ))}
        </select>
      </div>

      {/* Reviews List */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-sm text-[var(--ink-muted)]">
          {t.admin.reviews.empty}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rev) => (
            <div
              key={rev.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1.5 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-0.5 text-amber-500">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star
                        key={idx}
                        className={`h-3.5 w-3.5 ${
                          idx < rev.rating ? 'fill-amber-500 text-amber-500' : 'text-[var(--border)]'
                        }`}
                      />
                    ))}
                  </span>
                  <span className="font-display text-sm font-extrabold text-[var(--ink)]">
                    {rev.authorName}
                  </span>
                  <span className="text-xs text-[var(--ink-muted)]">·</span>
                  <span className="text-xs font-bold text-[#D7193F]">
                    {rev.productName?.[lang] || rev.productName?.ar || rev.productId}
                  </span>
                  <span className="rounded bg-[var(--surface-alt)] px-2 py-0.5 text-[10px] font-bold text-[var(--ink-muted)] border border-[var(--border)]">
                    {resolveCategoryLabel(categories, rev.productCat, lang, t.services.items)}
                  </span>
                </div>

                {rev.comment && (
                  <p className="text-xs sm:text-sm text-[var(--ink)] leading-relaxed">
                    {rev.comment}
                  </p>
                )}

                <p className="num text-[11px] text-[var(--ink-muted)]">
                  {rev.createdAt.slice(0, 16).replace('T', ' ')}
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                {confirmId === rev.id ? (
                  <>
                    <button
                      type="button"
                      disabled={deletingId === rev.id}
                      onClick={() => void confirmDelete(rev.id)}
                      className="h-8 rounded-lg bg-rose-600 px-3 text-xs font-bold text-white hover:bg-rose-700 cursor-pointer disabled:opacity-50"
                    >
                      {deletingId === rev.id ? '...' : t.admin.reviews.deleteConfirm}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmId(null)}
                      className="h-8 rounded-lg border border-[var(--border)] px-3 text-xs font-bold text-[var(--ink-muted)] cursor-pointer"
                    >
                      {t.admin.reviews.cancel}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    aria-label={t.admin.products.delete}
                    onClick={() => setConfirmId(rev.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] text-rose-600 hover:bg-rose-500/10 cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function AdminCustomersPanel({
  lang,
  customers,
}: {
  lang: Lang;
  customers: AdminCustomerSummary[];
}) {
  const t = TX[lang];
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q) ||
        (c.email && c.email.toLowerCase().includes(q)),
    );
  }, [customers, search]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg sm:text-xl font-extrabold text-[var(--ink)]">
            {t.admin.customers.title}
          </h2>
          <span className="num rounded-md bg-[var(--surface-alt)] px-2 py-0.5 text-xs font-bold text-[var(--ink-muted)] border border-[var(--border)]">
            {customers.length}
          </span>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 h-4 w-4 text-[var(--ink-muted)]" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.admin.customers.searchPlaceholder}
          className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] ps-9 pe-3 text-xs sm:text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center space-y-2">
          <Users className="mx-auto h-7 w-7 text-[var(--ink-muted)]/50" />
          <p className="text-sm font-bold text-[var(--ink-muted)]">{t.admin.customers.empty}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]/60 text-[var(--ink-muted)] text-[11px]">
                <th className="p-3 text-start font-bold">{t.admin.subs.customer}</th>
                <th className="p-3 text-start font-bold">{t.admin.subs.phone}</th>
                <th className="p-3 text-start font-bold">{t.admin.customers.ordersCount}</th>
                <th className="p-3 text-start font-bold">{t.admin.customers.totalSpent}</th>
                <th className="p-3 text-start font-bold">{t.admin.customers.lastOrder}</th>
                <th className="p-3 text-start font-bold">{t.admin.customers.joined}</th>
                <th className="p-3 text-end font-bold">{t.admin.customers.whatsapp}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map((cust) => {
                const waUrl = `https://wa.me/${encodeURIComponent(
                  normalizeAlgerianPhone(cust.phone),
                )}`;
                return (
                  <tr key={cust.id} className="hover:bg-[var(--surface-alt)]/45">
                    <td className="p-3 whitespace-nowrap">
                      <p className="font-bold text-[var(--ink)]">{cust.name}</p>
                      {cust.email && (
                        <p dir="ltr" className="num text-[11px] text-[var(--ink-muted)]">
                          {cust.email}
                        </p>
                      )}
                    </td>
                    <td className="p-3 num whitespace-nowrap font-bold text-[var(--ink)]">
                      {cust.phone}
                    </td>
                    <td className="p-3 num whitespace-nowrap font-bold">{cust.ordersCount}</td>
                    <td className="p-3 num whitespace-nowrap font-extrabold text-[#D7193F]">
                      {formatPriceDzd(cust.totalSpent, lang)}
                    </td>
                    <td className="p-3 num whitespace-nowrap text-[var(--ink-muted)]">
                      {cust.lastOrderAt ? cust.lastOrderAt.slice(0, 10) : '—'}
                    </td>
                    <td className="p-3 num whitespace-nowrap text-[var(--ink-muted)]">
                      {cust.createdAt.slice(0, 10)}
                    </td>
                    <td className="p-3 text-end whitespace-nowrap">
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-[11px] font-bold text-white hover:bg-emerald-700"
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        <span>{t.admin.customers.whatsapp}</span>
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
