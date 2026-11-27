import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CreditCard,
  FileWarning,
  Package,
  Plus,
  Search,
  ShoppingCart,
  X,
} from 'lucide-react';
import { formatPriceDzd } from '../../shared/commerce.ts';
import { TX } from '../../shared/i18n.ts';
import type { Lang, Order, Product } from '../../shared/types.ts';

export interface PaletteNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

export function AdminQuickPalette({
  open,
  lang,
  navItems,
  orders,
  products,
  canOrders,
  canProducts,
  onClose,
  onNavigateTab,
  onInspectOrder,
  onFilterPendingProofs,
  onFilterOutOfStock,
}: {
  open: boolean;
  lang: Lang;
  navItems: PaletteNavItem[];
  orders: Order[];
  products: Product[];
  canOrders: boolean;
  canProducts: boolean;
  onClose: () => void;
  onNavigateTab: (tabId: string) => void;
  onInspectOrder: (order: Order) => void;
  onFilterPendingProofs: () => void;
  onFilterOutOfStock: () => void;
}) {
  const t = TX[lang];
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const q = query.trim().toLowerCase();

  const matchedNav = useMemo(
    () =>
      navItems.filter(
        (item) => !q || item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q),
      ),
    [navItems, q],
  );

  const matchedOrders = useMemo(() => {
    if (!canOrders || !q) return [];
    return orders
      .filter(
        (o) =>
          o.code.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerPhone.toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [canOrders, orders, q]);

  const matchedProducts = useMemo(() => {
    if (!canProducts || !q) return [];
    return products
      .filter(
        (p) =>
          (p.name.ar || '').toLowerCase().includes(q) ||
          (p.name.fr || '').toLowerCase().includes(q),
      )
      .slice(0, 5);
  }, [canProducts, products, q]);

  if (!open) return null;

  const hasAny =
    matchedNav.length > 0 || matchedOrders.length > 0 || matchedProducts.length > 0 || !q;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 pt-16 sm:pt-24 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.admin.workspace.searchShortcut}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--border)] px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--ink-muted)]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.admin.palette.placeholder}
            className="flex-1 bg-transparent text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)] focus:outline-none"
          />
          <span className="hidden sm:inline-flex rounded border border-[var(--border)] bg-[var(--surface-alt)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--ink-muted)]">
            {t.admin.palette.closeHint}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.gallery.close}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--ink-muted)] hover:bg-[var(--surface-alt)] cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-3 space-y-4">
          {!hasAny && (
            <p className="py-6 text-center text-xs font-semibold text-[var(--ink-muted)]">
              {t.admin.palette.noResults}
            </p>
          )}

          {!q && (canOrders || canProducts) && (
            <div className="space-y-1.5">
              <p className="px-2 text-[10px] font-extrabold uppercase text-[var(--ink-muted)]">
                {t.admin.palette.quickTitle}
              </p>
              {canOrders && (
                <button
                  type="button"
                  onClick={() => {
                    onFilterPendingProofs();
                    onClose();
                  }}
                  className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-alt)] cursor-pointer"
                >
                  <CreditCard className="h-4 w-4 text-[#D7193F]" />
                  <span>{t.admin.palette.pendingProofsAction}</span>
                </button>
              )}
              {canProducts && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      onFilterOutOfStock();
                      onClose();
                    }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-alt)] cursor-pointer"
                  >
                    <FileWarning className="h-4 w-4 text-amber-600" />
                    <span>{t.admin.palette.outOfStockAction}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onNavigateTab('products');
                      onClose();
                    }}
                    className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-alt)] cursor-pointer"
                  >
                    <Plus className="h-4 w-4 text-emerald-600" />
                    <span>{t.admin.palette.newProductAction}</span>
                  </button>
                </>
              )}
            </div>
          )}

          {matchedNav.length > 0 && (
            <div className="space-y-1.5">
              <p className="px-2 text-[10px] font-extrabold uppercase text-[var(--ink-muted)]">
                {t.admin.palette.sectionsTitle}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {matchedNav.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      onNavigateTab(item.id);
                      onClose();
                    }}
                    className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-bold text-[var(--ink)] hover:bg-[var(--surface-alt)] cursor-pointer"
                  >
                    <span className="text-[#D7193F]">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {matchedOrders.length > 0 && (
            <div className="space-y-1.5">
              <p className="px-2 text-[10px] font-extrabold uppercase text-[var(--ink-muted)]">
                {t.admin.palette.ordersTitle}
              </p>
              {matchedOrders.map((ord) => (
                <button
                  key={ord.id}
                  type="button"
                  onClick={() => {
                    onInspectOrder(ord);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs hover:bg-[var(--surface-alt)] cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ShoppingCart className="h-3.5 w-3.5 text-[#D7193F] shrink-0" />
                    <span className="num font-bold text-[var(--ink)]">{ord.code}</span>
                    <span className="truncate text-[var(--ink-muted)]">{ord.customerName}</span>
                  </div>
                  <span className="num font-bold text-[var(--ink)] shrink-0">
                    {formatPriceDzd(ord.subtotal, lang)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {matchedProducts.length > 0 && (
            <div className="space-y-1.5">
              <p className="px-2 text-[10px] font-extrabold uppercase text-[var(--ink-muted)]">
                {t.admin.palette.productsTitle}
              </p>
              {matchedProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    onNavigateTab('products');
                    onClose();
                  }}
                  className="w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs hover:bg-[var(--surface-alt)] cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Package className="h-3.5 w-3.5 text-[#D7193F] shrink-0" />
                    <span className="truncate font-bold text-[var(--ink)]">
                      {p.name[lang] || p.name.ar}
                    </span>
                  </div>
                  <span className="num font-bold text-[var(--ink-muted)] shrink-0">
                    {formatPriceDzd(p.price, lang)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
