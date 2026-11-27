import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarPlus,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  MessageCircle,
  Printer,
  Search,
  ShoppingCart,
  X,
  XCircle,
} from 'lucide-react';
import { formatPriceDzd, formatWhatsAppDeliveryUrl } from '../../shared/commerce.ts';
import { TX } from '../../shared/i18n.ts';
import type {
  Lang,
  Order,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../shared/types.ts';
import { getAdminToken } from '../../utils/api.ts';

const STATUS_BADGE: Record<OrderStatus, string> = {
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

const PAY_STATUS_BADGE: Record<PaymentStatus, string> = {
  unpaid: 'bg-slate-500/10 text-[var(--ink-muted)] border-[var(--border)]',
  pending_review: 'bg-amber-500/12 text-amber-800 dark:text-amber-300 border-amber-500/25',
  paid: 'bg-emerald-500/12 text-emerald-800 dark:text-emerald-300 border-emerald-500/25',
  failed: 'bg-rose-500/12 text-rose-800 dark:text-rose-300 border-rose-500/25',
};

export function AdminOrdersPanel({
  lang,
  orders,
  statusFilter,
  payStatusFilter,
  selectedOrderId,
  onStatusFilterChange,
  onPayStatusFilterChange,
  onSelectOrder,
  onUpdateOrder,
  onBulkUpdateStatus,
  onCreateSubscriptionFromOrder,
  onOpenProof,
}: {
  lang: Lang;
  orders: Order[];
  statusFilter: OrderStatus | 'all';
  payStatusFilter: PaymentStatus | 'all';
  selectedOrderId: string | null;
  onStatusFilterChange: (s: OrderStatus | 'all') => void;
  onPayStatusFilterChange: (ps: PaymentStatus | 'all') => void;
  onSelectOrder: (id: string | null) => void;
  onUpdateOrder: (
    order: Order,
    patch: {
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      deliveryData?: string;
      notes?: string;
    },
    openWhatsapp?: boolean,
  ) => Promise<Order | null>;
  onBulkUpdateStatus: (ids: string[], status: OrderStatus) => Promise<void>;
  onCreateSubscriptionFromOrder: (order: Order) => void;
  onOpenProof: (url: string) => void;
}) {
  const t = TX[lang];
  const [search, setSearch] = useState('');
  const [payFilter, setPayFilter] = useState<PaymentMethod | 'all'>('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>('confirmed');
  const [bulkApplying, setBulkApplying] = useState(false);

  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deliveryDraft, setDeliveryDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [savingInspector, setSavingInspector] = useState(false);
  const [printingOrder, setPrintingOrder] = useState<Order | null>(null);

  const inspectedOrder = useMemo(
    () => orders.find((o) => o.id === selectedOrderId) || null,
    [orders, selectedOrderId],
  );

  useEffect(() => {
    if (inspectedOrder) {
      setDeliveryDraft(inspectedOrder.deliveryData || '');
      setNotesDraft(inspectedOrder.notes || '');
    }
  }, [inspectedOrder]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: orders.length,
      pending: 0,
      pending_confirmation: 0,
      confirmed: 0,
      processing: 0,
      ready_shipping: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
      returned: 0,
      failed_delivery: 0,
    };
    for (const o of orders) {
      if (counts[o.status] !== undefined) {
        counts[o.status] += 1;
      }
    }
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (payFilter !== 'all' && o.paymentMethod !== payFilter) return false;
      if (payStatusFilter !== 'all' && o.paymentStatus !== payStatusFilter) return false;
      if (q) {
        const match =
          o.code.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.toLowerCase().includes(q) ||
          o.wilaya.toLowerCase().includes(q) ||
          (o.billRef && o.billRef.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [orders, statusFilter, payFilter, payStatusFilter, search]);

  function copyValue(key: string, value: string) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(value).catch(() => {});
    }
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((prev) => (prev === key ? null : prev)), 1800);
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === filteredOrders.length && filteredOrders.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredOrders.map((o) => o.id));
    }
  }

  async function applyBulk() {
    if (selectedIds.length === 0) return;
    setBulkApplying(true);
    try {
      await onBulkUpdateStatus(selectedIds, bulkStatus);
      setSelectedIds([]);
    } finally {
      setBulkApplying(false);
    }
  }

  const exportToken = getAdminToken();
  const exportUrl = exportToken
    ? `/api/admin/orders/export?token=${encodeURIComponent(exportToken)}`
    : '/api/admin/orders/export';

  return (
    <div className="space-y-4">
      {/* Header + CSV Export */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg sm:text-xl font-extrabold text-[var(--ink)]">
          {t.admin.nav.orders}
        </h2>
        <a
          href={exportUrl}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3.5 text-xs font-bold text-[var(--ink)] hover:border-[#D7193F] transition-colors"
        >
          <Download className="h-4 w-4" />
          <span>{t.admin.orders.exportCsv}</span>
        </a>
      </div>

      {/* Status Segmented Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {(
          [
            'all',
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
          ] as const
        ).map((st) => {
          const active = statusFilter === st;
          const label = st === 'all' ? t.admin.orders.allStatus : t.statuses[st];
          return (
            <button
              key={st}
              type="button"
              onClick={() => onStatusFilterChange(st as OrderStatus | 'all')}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-bold transition-colors cursor-pointer ${
                active
                  ? 'border-[#111318] bg-[#111318] text-white dark:border-[#D7193F] dark:bg-[#D7193F]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)] hover:text-[var(--ink)]'
              }`}
            >
              <span>{label}</span>
              <span
                className={`num rounded px-1.5 py-0.5 text-[10px] font-extrabold ${
                  active ? 'bg-white/15 text-white' : 'bg-[var(--surface-alt)] text-[var(--ink)]'
                }`}
              >
                {statusCounts[st] || 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        <div className="relative sm:col-span-6">
          <Search className="pointer-events-none absolute top-1/2 start-3 -translate-y-1/2 h-4 w-4 text-[var(--ink-muted)]" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.admin.orders.search}
            className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] ps-9 pe-3 text-xs sm:text-sm text-[var(--ink)]"
          />
        </div>
        <select
          value={payFilter}
          onChange={(e) => setPayFilter(e.target.value as PaymentMethod | 'all')}
          className="sm:col-span-3 h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink)]"
        >
          <option value="all">{t.admin.orders.allPay}</option>
          {(['cod', 'ccp', 'chargily'] as PaymentMethod[]).map((m) => (
            <option key={m} value={m}>
              {t.payLabels[m]}
            </option>
          ))}
        </select>
        <select
          value={payStatusFilter}
          onChange={(e) => onPayStatusFilterChange(e.target.value as PaymentStatus | 'all')}
          className="sm:col-span-3 h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink)]"
        >
          <option value="all">{t.admin.orders.allPayStatus}</option>
          {(['unpaid', 'pending_review', 'paid', 'failed'] as PaymentStatus[]).map((ps) => (
            <option key={ps} value={ps}>
              {t.payStatuses[ps]}
            </option>
          ))}
        </select>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#D7193F]/40 bg-[#D7193F]/[0.05] px-4 py-3">
          <span className="num text-xs font-extrabold text-[var(--ink)]">
            {selectedIds.length} {t.admin.orders.selectedCount}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as OrderStatus)}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-bold"
            >
              {(['pending', 'confirmed', 'processing', 'delivered', 'cancelled'] as OrderStatus[]).map(
                (s) => (
                  <option key={s} value={s}>
                    {t.statuses[s]}
                  </option>
                ),
              )}
            </select>
            <button
              type="button"
              disabled={bulkApplying}
              onClick={() => void applyBulk()}
              className="h-9 rounded-lg bg-[#D7193F] px-3.5 text-xs font-extrabold text-white hover:bg-[#B81434] cursor-pointer disabled:opacity-50"
            >
              {bulkApplying ? '...' : t.admin.orders.applyBulk}
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink-muted)] cursor-pointer"
            >
              {t.admin.orders.clearSelection}
            </button>
          </div>
        </div>
      )}

      {/* Orders List (Desktop Table + Mobile Cards) */}
      {filteredOrders.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center space-y-2">
          <ShoppingCart className="mx-auto h-7 w-7 text-[var(--ink-muted)]/50" />
          <p className="text-sm font-bold text-[var(--ink)]">{t.admin.orders.empty}</p>
        </div>
      ) : (
        <>
          {/* Desktop High-Density Table */}
          <div className="hidden md:block rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-alt)]/60 text-[var(--ink-muted)] text-[11px]">
                  <th className="p-3 w-9 text-center">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={
                        filteredOrders.length > 0 && selectedIds.length === filteredOrders.length
                      }
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th className="p-3 text-start font-bold">
                    {lang === 'fr' ? 'Commande' : 'الطلب'}
                  </th>
                  <th className="p-3 text-start font-bold">
                    {lang === 'fr' ? 'Client' : 'الزبون'}
                  </th>
                  <th className="p-3 text-start font-bold">
                    {lang === 'fr' ? 'Articles' : 'المنتجات'}
                  </th>
                  <th className="p-3 text-start font-bold">
                    {lang === 'fr' ? 'Paiement' : 'الدفع'}
                  </th>
                  <th className="p-3 text-start font-bold">
                    {lang === 'fr' ? 'Statut' : 'الحالة'}
                  </th>
                  <th className="p-3 text-start font-bold">
                    {lang === 'fr' ? 'Total' : 'المجموع'}
                  </th>
                  <th className="p-3 text-end font-bold">
                    {lang === 'fr' ? 'Actions' : 'إجراءات'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filteredOrders.map((ord) => {
                  const isSelected = selectedIds.includes(ord.id);
                  const isInspected = selectedOrderId === ord.id;
                  return (
                    <tr
                      key={ord.id}
                      className={`transition-colors ${
                        isInspected
                          ? 'bg-[#D7193F]/[0.04]'
                          : 'hover:bg-[var(--surface-alt)]/45'
                      }`}
                    >
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(ord.id)}
                          aria-label={ord.code}
                        />
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => copyValue(`code-${ord.id}`, ord.code)}
                          className="inline-flex items-center gap-1 font-mono font-bold text-[var(--ink)] hover:text-[#D7193F] cursor-pointer"
                        >
                          {copiedKey === `code-${ord.id}` ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3 opacity-50" />
                          )}
                          <span className="num">{ord.code}</span>
                        </button>
                        <p className="num text-[10px] text-[var(--ink-muted)] mt-0.5">
                          {ord.createdAt.slice(0, 16).replace('T', ' ')}
                        </p>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <p className="font-bold text-[var(--ink)]">{ord.customerName}</p>
                        <p className="num text-[11px] text-[var(--ink-muted)]">
                          {ord.customerPhone} · {ord.wilaya}
                        </p>
                      </td>
                      <td className="p-3 max-w-[190px]">
                        <p className="truncate font-medium text-[var(--ink)]">
                          {ord.items.map((it) => `${it.name[lang] || it.name.ar} ×${it.qty}`).join('، ')}
                        </p>
                        {ord.billRef && (
                          <p className="num text-[10px] font-bold text-[#D7193F] truncate">
                            ID: {ord.billRef}
                          </p>
                        )}
                      </td>
                      <td className="p-3 whitespace-nowrap space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-[var(--ink)]">
                            {t.payLabels[ord.paymentMethod]}
                          </span>
                          {ord.proofMediaId && (
                            <button
                              type="button"
                              onClick={() => onOpenProof(`/media/${ord.proofMediaId}`)}
                              className="text-[#D7193F] hover:underline cursor-pointer"
                              title={t.admin.orders.viewProof}
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <span
                          className={`inline-flex rounded border px-1.5 py-0.5 text-[10px] font-bold ${PAY_STATUS_BADGE[ord.paymentStatus]}`}
                        >
                          {t.payStatuses[ord.paymentStatus]}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <select
                          value={ord.status}
                          onChange={(e) =>
                            void onUpdateOrder(ord, { status: e.target.value as OrderStatus })
                          }
                          className={`h-8 rounded-lg border px-2 text-[11px] font-bold cursor-pointer ${STATUS_BADGE[ord.status]}`}
                        >
                          {(['pending', 'confirmed', 'processing', 'delivered', 'cancelled'] as OrderStatus[]).map(
                            (s) => (
                              <option key={s} value={s} className="bg-[var(--surface)] text-[var(--ink)]">
                                {t.statuses[s]}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="num font-extrabold text-[var(--ink)]">
                          {formatPriceDzd(ord.subtotal, lang)}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <a
                            href={formatWhatsAppDeliveryUrl(ord, lang)}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="WhatsApp"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={() => onSelectOrder(ord.id)}
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

          {/* Mobile Responsive Cards */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {filteredOrders.map((ord) => (
              <div
                key={ord.id}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(ord.id)}
                      onChange={() => toggleSelect(ord.id)}
                      aria-label={ord.code}
                    />
                    <div>
                      <p className="num text-sm font-extrabold text-[var(--ink)]">
                        {ord.code} · {formatPriceDzd(ord.subtotal, lang)}
                      </p>
                      <p className="text-xs text-[var(--ink-muted)]">
                        {ord.customerName} · <span className="num">{ord.customerPhone}</span>
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[ord.status]}`}
                  >
                    {t.statuses[ord.status]}
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border)]">
                  <select
                    value={ord.status}
                    onChange={(e) =>
                      void onUpdateOrder(ord, { status: e.target.value as OrderStatus })
                    }
                    className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-xs font-bold"
                  >
                    {(['pending', 'confirmed', 'processing', 'delivered', 'cancelled'] as OrderStatus[]).map(
                      (s) => (
                        <option key={s} value={s}>
                          {t.statuses[s]}
                        </option>
                      ),
                    )}
                  </select>

                  <button
                    type="button"
                    onClick={() => onSelectOrder(ord.id)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#111318] dark:bg-[#D7193F] px-3 text-xs font-bold text-white cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>{t.admin.orders.inspect}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Slide-Over Order Inspector Drawer */}
      {inspectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50" onClick={() => onSelectOrder(null)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="h-full w-full max-w-lg bg-[var(--surface)] border-s border-[var(--border)] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border)]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="num font-display text-base font-extrabold text-[var(--ink)]">
                    {inspectedOrder.code}
                  </h3>
                  <span
                    className={`rounded border px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[inspectedOrder.status]}`}
                  >
                    {t.statuses[inspectedOrder.status]}
                  </span>
                </div>
                <p className="num text-[11px] text-[var(--ink-muted)]">
                  {inspectedOrder.createdAt.slice(0, 19).replace('T', ' ')}
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setPrintingOrder(inspectedOrder);
                    setTimeout(() => window.print(), 80);
                  }}
                  title={t.admin.orders.printReceipt}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 text-xs font-bold text-[var(--ink)] hover:border-[#D7193F] cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t.admin.orders.printReceipt}</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelectOrder(null)}
                  aria-label="Close"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--ink)] hover:bg-[var(--surface-alt)] cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Customer & Address */}
              <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-alt)]/50 p-4 space-y-2">
                <p className="text-[11px] font-bold text-[var(--ink-muted)]">
                  {t.admin.orders.customerInfo}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display text-sm font-extrabold text-[var(--ink)]">
                    {inspectedOrder.customerName}
                  </p>
                  <button
                    type="button"
                    onClick={() => copyValue('cust-phone', inspectedOrder.customerPhone)}
                    className="num inline-flex items-center gap-1 text-xs font-bold text-[#D7193F] cursor-pointer"
                  >
                    {copiedKey === 'cust-phone' ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    <span>{inspectedOrder.customerPhone}</span>
                  </button>
                </div>
                {(inspectedOrder.wilaya || inspectedOrder.address) && (
                  <p className="text-xs text-[var(--ink-muted)]">
                    {inspectedOrder.wilaya} {inspectedOrder.address ? `· ${inspectedOrder.address}` : ''}
                  </p>
                )}
                {inspectedOrder.billRef && (
                  <div className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs">
                    <span className="font-bold text-[var(--ink-muted)]">
                      {t.track.billRefTitle}:
                    </span>
                    <button
                      type="button"
                      onClick={() => copyValue('bill-ref', inspectedOrder.billRef)}
                      className="num inline-flex items-center gap-1 font-extrabold text-[var(--ink)] cursor-pointer"
                    >
                      <span>{inspectedOrder.billRef}</span>
                      <Copy className="h-3 w-3 opacity-60" />
                    </button>
                  </div>
                )}
              </div>

              {/* Line Items */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-[var(--ink-muted)]">
                  {t.admin.orders.itemsBreakdown}
                </p>
                <div className="rounded-lg border border-[var(--border)] divide-y divide-[var(--border)]">
                  {inspectedOrder.items.map((it, idx) => (
                    <div key={idx} className="flex items-center justify-between gap-2 px-3.5 py-2.5 text-xs">
                      <div className="min-w-0">
                        <p className="font-bold text-[var(--ink)]">
                          {it.name[lang] || it.name.ar}
                        </p>
                        <p className="text-[11px] text-[var(--ink-muted)]">
                          {it.planLabel ? `${it.planLabel[lang] || it.planLabel.ar} · ` : ''}
                          <span className="num">
                            {formatPriceDzd(it.unitPrice, lang)} × {it.qty}
                          </span>
                        </p>
                      </div>
                      <span className="num font-extrabold text-[var(--ink)] shrink-0">
                        {formatPriceDzd(it.unitPrice * it.qty, lang)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3.5 py-2.5 bg-[var(--surface-alt)]/55 text-xs font-extrabold">
                    <span>{t.cart.subtotal}</span>
                    <span className="num text-sm text-[#D7193F]">
                      {formatPriceDzd(inspectedOrder.subtotal, lang)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Payment & CCP Receipt Quick Verification */}
              <div className="rounded-lg border border-[var(--border)] p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-[var(--ink)]">
                      {t.payLabels[inspectedOrder.paymentMethod]}
                    </p>
                    <span
                      className={`mt-1 inline-flex rounded border px-2 py-0.5 text-[10px] font-bold ${PAY_STATUS_BADGE[inspectedOrder.paymentStatus]}`}
                    >
                      {t.payStatuses[inspectedOrder.paymentStatus]}
                    </span>
                  </div>

                  {inspectedOrder.proofMediaId && (
                    <button
                      type="button"
                      onClick={() => onOpenProof(`/media/${inspectedOrder.proofMediaId}`)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-3 text-xs font-bold text-[var(--ink)] cursor-pointer"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>{t.admin.orders.viewProof}</span>
                    </button>
                  )}
                </div>

                {inspectedOrder.proofMediaId && (
                  <img
                    src={`/media/${inspectedOrder.proofMediaId}`}
                    alt={t.admin.orders.viewProof}
                    onClick={() => onOpenProof(`/media/${inspectedOrder.proofMediaId}`)}
                    className="max-h-44 w-full rounded-lg border border-[var(--border)] object-contain bg-[var(--surface-alt)] cursor-pointer"
                  />
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void onUpdateOrder(inspectedOrder, {
                        paymentStatus: 'paid',
                        status:
                          inspectedOrder.status === 'pending'
                            ? 'confirmed'
                            : inspectedOrder.status,
                      })
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>{t.admin.orders.approvePayment}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void onUpdateOrder(inspectedOrder, {
                        paymentStatus: 'failed',
                      })
                    }
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-rose-500/35 bg-rose-500/10 px-3 text-xs font-bold text-rose-700 dark:text-rose-300 cursor-pointer"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    <span>{t.admin.orders.rejectPayment}</span>
                  </button>
                </div>
              </div>

              {/* Status & Payment Status Controls */}
              <div className="grid grid-cols-2 gap-3">
                <label className="block space-y-1">
                  <span className="text-xs font-bold text-[var(--ink)]">
                    {lang === 'fr' ? 'Statut commande' : 'حالة الطلب'}
                  </span>
                  <select
                    value={inspectedOrder.status}
                    onChange={(e) =>
                      void onUpdateOrder(inspectedOrder, { status: e.target.value as OrderStatus })
                    }
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold"
                  >
                    {(['pending', 'confirmed', 'processing', 'delivered', 'cancelled'] as OrderStatus[]).map(
                      (s) => (
                        <option key={s} value={s}>
                          {t.statuses[s]}
                        </option>
                      ),
                    )}
                  </select>
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-bold text-[var(--ink)]">
                    {lang === 'fr' ? 'Statut paiement' : 'حالة الدفع'}
                  </span>
                  <select
                    value={inspectedOrder.paymentStatus}
                    onChange={(e) =>
                      void onUpdateOrder(inspectedOrder, {
                        paymentStatus: e.target.value as PaymentStatus,
                      })
                    }
                    className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold"
                  >
                    {(['unpaid', 'pending_review', 'paid', 'failed'] as PaymentStatus[]).map((ps) => (
                      <option key={ps} value={ps}>
                        {t.payStatuses[ps]}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Delivery Credentials & Internal Notes */}
              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-[var(--ink)]">
                  {t.admin.orders.deliveryData}
                </span>
                <textarea
                  rows={3}
                  value={deliveryDraft}
                  onChange={(e) => setDeliveryDraft(e.target.value)}
                  placeholder={t.admin.orders.deliveryPlaceholder}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs"
                />
              </label>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-[var(--ink)]">
                  {t.admin.orders.internalNotes}
                </span>
                <textarea
                  rows={2}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder={t.admin.orders.notesPlaceholder}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-xs"
                />
              </label>

              {/* Digital Shortcut: Create Subscription */}
              {inspectedOrder.items.some((it) => it.type === 'digital' || it.cat === 'subs') && (
                <button
                  type="button"
                  onClick={() => onCreateSubscriptionFromOrder(inspectedOrder)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-alt)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[#D7193F] cursor-pointer"
                >
                  <CalendarPlus className="h-4 w-4 text-[#D7193F]" />
                  <span>{t.admin.orders.createSub}</span>
                </button>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] p-4 bg-[var(--surface)]">
              <button
                type="button"
                disabled={savingInspector}
                onClick={async () => {
                  setSavingInspector(true);
                  try {
                    await onUpdateOrder(inspectedOrder, {
                      deliveryData: deliveryDraft,
                      notes: notesDraft,
                    });
                  } finally {
                    setSavingInspector(false);
                  }
                }}
                className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-alt)] cursor-pointer disabled:opacity-50"
              >
                {savingInspector ? '...' : t.admin.orders.saveDelivery}
              </button>
              <a
                href={formatWhatsAppDeliveryUrl(
                  { ...inspectedOrder, deliveryData: deliveryDraft },
                  lang,
                )}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  void onUpdateOrder(
                    inspectedOrder,
                    {
                      deliveryData: deliveryDraft,
                      notes: notesDraft,
                      status: 'delivered',
                    },
                    true,
                  );
                }}
                className="flex-1 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#D7193F] px-4 text-xs font-extrabold text-white hover:bg-[#B81434] transition-colors"
              >
                <MessageCircle className="h-4 w-4" />
                <span>{t.admin.orders.saveAndWhatsapp}</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Printable Invoice View (visible only during @media print) */}
      {printingOrder && (
        <div className="hidden print:block print-only-sheet space-y-4 text-black">
          <div className="flex items-center justify-between border-b border-black/20 pb-3">
            <div>
              <h1 className="text-xl font-extrabold">{t.brand}</h1>
              <p className="text-xs">{t.brandSub}</p>
            </div>
            <div className="text-end">
              <p className="num text-base font-extrabold">{printingOrder.code}</p>
              <p className="num text-xs">{printingOrder.createdAt.slice(0, 16).replace('T', ' ')}</p>
            </div>
          </div>
          <div className="text-sm space-y-1">
            <p>
              <strong>{t.admin.orders.customerInfo}:</strong> {printingOrder.customerName} (
              {printingOrder.customerPhone})
            </p>
            {(printingOrder.wilaya || printingOrder.address) && (
              <p>
                {printingOrder.wilaya} — {printingOrder.address}
              </p>
            )}
            <p>
              <strong>{t.cart.payMethod}:</strong> {t.payLabels[printingOrder.paymentMethod]}
            </p>
          </div>
          <table className="w-full border-collapse border border-black/20 text-xs">
            <thead>
              <tr className="border-b border-black/20 bg-gray-100">
                <th className="p-2 text-start">{lang === 'fr' ? 'Article' : 'المنتج'}</th>
                <th className="p-2 text-center">{lang === 'fr' ? 'Qté' : 'الكمية'}</th>
                <th className="p-2 text-end">{lang === 'fr' ? 'Total' : 'المبلغ'}</th>
              </tr>
            </thead>
            <tbody>
              {printingOrder.items.map((it, i) => (
                <tr key={i} className="border-b border-black/15">
                  <td className="p-2">
                    {it.name[lang] || it.name.ar}{' '}
                    {it.planLabel ? `(${it.planLabel[lang] || it.planLabel.ar})` : ''}
                  </td>
                  <td className="num p-2 text-center">{it.qty}</td>
                  <td className="num p-2 text-end">{formatPriceDzd(it.unitPrice * it.qty, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="num text-end text-base font-extrabold">
            {t.cart.subtotal}: {formatPriceDzd(printingOrder.subtotal, lang)}
          </p>
        </div>
      )}
    </div>
  );
}
