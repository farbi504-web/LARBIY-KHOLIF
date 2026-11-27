import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { TX } from '../shared/i18n.ts';
import { calculateCartTotals, formatPriceDzd, resolveItemUnitPrice } from '../shared/commerce.ts';
import type { CartItem, Lang } from '../shared/types.ts';
import { ServiceSvgIllustration } from './ServiceArtwork.tsx';

interface CartDrawerProps {
  open: boolean;
  lang: Lang;
  cart: CartItem[];
  onClose: () => void;
  onUpdateQty: (index: number, qty: number) => void;
  onRemoveItem: (index: number) => void;
  onGoCheckout: () => void;
  onGoShop: () => void;
}

export function CartDrawer({
  open,
  lang,
  cart,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onGoCheckout,
  onGoShop,
}: CartDrawerProps) {
  const t = TX[lang];
  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;
  const totals = calculateCartTotals(cart);
  const count = cart.reduce((acc, it) => acc + it.qty, 0);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={t.cart.title}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#07142B]/55 backdrop-blur-md cursor-pointer"
          />

          {/* Slide-over Liquid Glass Sheet */}
          <motion.aside
            initial={{ x: lang === 'ar' ? '-100%' : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: lang === 'ar' ? '-100%' : '100%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 36, mass: 0.85 }}
            className="relative z-10 flex h-full w-full max-w-md flex-col border-s border-white/65 dark:border-white/16 liquid-glass-hi shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)]/80 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="h-5 w-5 text-[#D7193F] dark:text-[#FF6B86]" />
                <h2 className="font-display text-lg font-extrabold text-[var(--ink)]">
                  {t.cart.title}
                </h2>
                <span className="num text-xs font-bold text-[var(--ink-muted)]">({count})</span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t.cart.drawerClose}
                className="liquid-glass inline-flex h-10 w-10 items-center justify-center rounded-full text-[var(--ink)] active:scale-90 transition-transform cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {cart.length === 0 ? (
                <div className="py-16 text-center space-y-4">
                  <ShoppingBag className="mx-auto h-10 w-10 text-[var(--ink-muted)] opacity-60" />
                  <p className="text-sm font-semibold text-[var(--ink-muted)]">{t.cart.empty}</p>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onGoShop();
                    }}
                    className="apple-btn-primary inline-flex h-11 items-center rounded-xl px-5 text-sm font-extrabold cursor-pointer"
                  >
                    {t.cart.browse}
                  </button>
                </div>
              ) : (
                cart.map((item, idx) => {
                  const { price, plan } = resolveItemUnitPrice(item.product, item.planId);
                  return (
                    <div
                      key={`${item.product.id}-${item.planId || 'base'}`}
                      className="liquid-glass flex items-center gap-3 rounded-2xl p-3"
                    >
                      <div className="h-16 w-18 shrink-0 overflow-hidden rounded-[12px] bg-[var(--surface-alt)]">
                        {item.product.img ? (
                          <img
                            src={item.product.img}
                            alt={item.product.name[lang] || item.product.name.ar}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ServiceSvgIllustration cat={item.product.cat} />
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="font-display text-sm font-bold text-[var(--ink)] truncate">
                          {item.product.name[lang] || item.product.name.ar}
                        </p>
                        {plan && (
                          <p className="text-[11px] font-medium text-[var(--ink-muted)] truncate">
                            {plan.label[lang] || plan.label.ar}
                          </p>
                        )}
                        <p className="num text-sm font-extrabold text-[#0B2D5B] dark:text-[#FF6B86]">
                          {formatPriceDzd(price * item.qty, lang)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => onRemoveItem(idx)}
                          aria-label="Remove item"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-500/10 active:scale-90 transition-all cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--border)]/80 bg-white/60 dark:bg-white/6 px-1 py-0.5">
                          <button
                            type="button"
                            aria-label="Decrease quantity"
                            onClick={() => onUpdateQty(idx, Math.max(1, item.qty - 1))}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ink)] hover:bg-white/70 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="num w-5 text-center text-xs font-bold text-[var(--ink)]">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            aria-label="Increase quantity"
                            onClick={() => onUpdateQty(idx, Math.min(99, item.qty + 1))}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--ink)] hover:bg-white/70 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {cart.length > 0 && (
              <div className="border-t border-[var(--border)]/80 bg-white/55 dark:bg-[#07142B]/55 backdrop-blur-xl px-5 py-4 space-y-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-[var(--ink-muted)]">{t.cart.subtotal}</span>
                  <div className="text-end">
                    <span className="num text-xl font-extrabold text-[#0B2D5B] dark:text-[#FF6B86]">
                      {formatPriceDzd(totals.subtotal, lang)}
                    </span>
                    {totals.savings > 0 && (
                      <p className="num text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                        {t.cart.savings}: {formatPriceDzd(totals.savings, lang)}
                      </p>
                    )}
                  </div>
                </div>

                <p className="text-[11px] font-medium text-[var(--ink-muted)]">{t.cart.drawerTip}</p>

                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onGoCheckout();
                    }}
                    className="apple-btn-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold cursor-pointer"
                  >
                    <span>{t.cart.drawerCheckout}</span>
                    <ArrowIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="liquid-glass inline-flex h-10 w-full items-center justify-center rounded-xl text-xs font-bold text-[var(--ink)] active:scale-[0.98] transition-all cursor-pointer"
                  >
                    {t.cart.drawerContinue}
                  </button>
                </div>
              </div>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
