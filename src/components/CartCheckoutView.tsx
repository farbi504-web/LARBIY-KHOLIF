import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Minus, Plus, Trash2, Upload } from 'lucide-react';
import { TX } from '../shared/i18n.ts';
import {
  ALGERIAN_WILAYAS,
  calculateCartTotals,
  calculateShippingFee,
  computeAllowedPayments,
  formatPriceDzd,
  requiresBillRef,
  resolveItemUnitPrice,
} from '../shared/commerce.ts';
import type { CartItem, Customer, Lang, Order, PaymentMethod, PublicSettings } from '../shared/types.ts';
import { apiJson, fileToDataUrl } from '../utils/api.ts';
import { ServiceSvgIllustration } from './ServiceArtwork.tsx';

interface CartCheckoutViewProps {
  lang: Lang;
  cart: CartItem[];
  settings: PublicSettings;
  customer: Customer | null;
  onUpdateQty: (index: number, qty: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  onGoShop: () => void;
  onTrackOrder: (code: string, phone: string) => void;
}

export function CartCheckoutView({
  lang,
  cart,
  settings,
  customer,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  onGoShop,
  onTrackOrder,
}: CartCheckoutViewProps) {
  const t = TX[lang];

  const [customerName, setCustomerName] = useState(customer?.name || '');
  const [customerPhone, setCustomerPhone] = useState(customer?.phone || '');
  const [wilaya, setWilaya] = useState('Tipaza');
  const [address, setAddress] = useState('');
  const [billRef, setBillRef] = useState('');
  const [notes, setNotes] = useState('');
  const [proofMediaId, setProofMediaId] = useState('');
  const [proofUrl, setProofUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  const payCheck = computeAllowedPayments(cart);
  const needsBillRef = requiresBillRef(cart);
  const totals = calculateCartTotals(cart);
  const shipping = calculateShippingFee(wilaya, settings.deliveryProvider, settings.deliveryEnabled);
  const grandTotal = totals.subtotal + shipping.fee;

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | ''>(
    payCheck.methods[0] || '',
  );

  useEffect(() => {
    if (!payCheck.methods.length) {
      setPaymentMethod('');
    } else if (!paymentMethod || !payCheck.methods.includes(paymentMethod)) {
      setPaymentMethod(payCheck.methods[0]);
    }
  }, [payCheck.methods.join(','), paymentMethod]);

  async function handleProofUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingProof(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const res = await apiJson<{ id: string; url: string }>('/api/upload/proof', {
        method: 'POST',
        body: JSON.stringify({ dataUrl }),
      });
      setProofMediaId(res.id);
      setProofUrl(res.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingProof(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (payCheck.conflict || !paymentMethod) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiJson<{ order: Order; checkoutUrl?: string }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          customerName,
          customerPhone,
          wilaya,
          address,
          paymentMethod,
          billRef: needsBillRef ? billRef : '',
          proofMediaId: paymentMethod === 'ccp' ? proofMediaId : '',
          notes,
          lang,
          items: cart.map((item) => ({
            productId: item.product.id,
            planId: item.planId,
            qty: item.qty,
          })),
        }),
      });
      onClearCart();
      if (res.checkoutUrl) {
        window.location.assign(res.checkoutUrl);
        return;
      }
      setConfirmedOrder(res.order);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Order failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmedOrder) {
    return (
      <div className="mx-auto max-w-xl liquid-glass rounded-[28px] p-7 sm:p-10 text-center space-y-5">
        <div className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h1 className="font-display text-2xl font-extrabold text-[var(--ink)]">
          {t.cart.orderConfirmedTitle}
        </h1>
        <div className="rounded-2xl border border-[var(--border)]/80 bg-white/60 dark:bg-white/6 backdrop-blur-md p-4">
          <p className="text-xs font-semibold text-[var(--ink-muted)]">{t.cart.orderCodeLabel}</p>
          <p className="num mt-1 text-2xl font-extrabold text-[#0B2D5B] dark:text-[#FF6B86]">
            {confirmedOrder.code}
          </p>
          <p className="num mt-2 text-sm font-bold text-[var(--ink)]">
            {formatPriceDzd(confirmedOrder.subtotal, lang)} · {t.payLabels[confirmedOrder.paymentMethod]}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onTrackOrder(confirmedOrder.code, confirmedOrder.customerPhone)}
            className="apple-btn-primary inline-flex h-11 items-center rounded-xl px-5 text-sm font-extrabold cursor-pointer"
          >
            {t.cart.trackNow}
          </button>
          <button
            type="button"
            onClick={onGoShop}
            className="liquid-glass inline-flex h-11 items-center rounded-xl px-5 text-sm font-bold text-[var(--ink)] active:scale-95 transition-all cursor-pointer"
          >
            {t.cart.continueShop}
          </button>
        </div>
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="liquid-glass rounded-[28px] p-10 text-center space-y-4">
        <h1 className="font-display text-2xl font-extrabold text-[var(--ink)]">{t.cart.title}</h1>
        <p className="text-sm text-[var(--ink-muted)]">{t.cart.empty}</p>
        <button
          type="button"
          onClick={onGoShop}
          className="apple-btn-primary inline-flex h-11 items-center rounded-xl px-6 text-sm font-extrabold cursor-pointer"
        >
          {t.cart.browse}
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-8 items-start">
      {/* Cart Items */}
      <div className="lg:col-span-6 space-y-4">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
          {t.cart.title}
        </h1>

        <div className="space-y-3">
          {cart.map((item, idx) => {
            const { price, plan } = resolveItemUnitPrice(item.product, item.planId);
            return (
              <div
                key={`${item.product.id}-${item.planId || 'base'}`}
                className="liquid-glass flex items-center gap-3.5 rounded-[22px] p-3.5"
              >
                <div className="h-18 w-20 shrink-0 overflow-hidden rounded-[14px] bg-[var(--surface-alt)]">
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
                  <h2 className="font-display text-sm sm:text-base font-bold text-[var(--ink)] truncate">
                    {item.product.name[lang] || item.product.name.ar}
                  </h2>
                  {plan && (
                    <p className="text-xs font-medium text-[var(--ink-muted)]">
                      {plan.label[lang] || plan.label.ar}
                    </p>
                  )}
                  <p className="num text-sm font-extrabold text-[#0B2D5B] dark:text-[#FF6B86]">
                    {formatPriceDzd(price * item.qty, lang)}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => onUpdateQty(idx, Math.max(1, item.qty - 1))}
                    className="liquid-glass inline-flex h-10 w-10 items-center justify-center rounded-xl active:scale-90 cursor-pointer"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="num w-7 text-center text-sm font-bold">{item.qty}</span>
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => onUpdateQty(idx, Math.min(99, item.qty + 1))}
                    className="liquid-glass inline-flex h-10 w-10 items-center justify-center rounded-xl active:scale-90 cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Remove item"
                    onClick={() => onRemoveItem(idx)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-rose-600 hover:bg-rose-500/10 active:scale-90 transition-all cursor-pointer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="liquid-glass rounded-[22px] p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-[var(--ink-muted)]">{t.cart.subtotal}</span>
            <span className="num font-bold text-[var(--ink)]">{formatPriceDzd(totals.subtotal, lang)}</span>
          </div>

          {settings.deliveryEnabled && settings.deliveryProvider && settings.deliveryProvider !== 'none' && (
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[var(--ink-muted)]">
                {shipping.providerLabel} ({wilaya || 'الولاية'})
              </span>
              <span className="num font-bold text-[var(--ink)]">{formatPriceDzd(shipping.fee, lang)}</span>
            </div>
          )}

          <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
            <span className="font-display text-base font-bold text-[var(--ink)]">{t.cart.totalWithShipping}</span>
            <div className="text-end">
              <span className="num text-xl font-extrabold text-[#0B2D5B] dark:text-[#FF6B86]">
                {formatPriceDzd(grandTotal, lang)}
              </span>
              {totals.savings > 0 && (
                <p className="num text-xs text-emerald-700 dark:text-emerald-400">
                  {t.cart.savings}: {formatPriceDzd(totals.savings, lang)}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Form */}
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-6 liquid-glass rounded-[28px] p-5 sm:p-7 space-y-5"
      >
        <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
          {t.cart.checkoutTitle}
        </h2>

        {payCheck.conflict && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm font-semibold text-rose-700 dark:text-rose-300">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <span>{t.cart.payMix}</span>
          </div>
        )}

        {!payCheck.conflict && payCheck.hasDigital && (
          <div className="rounded-xl border border-[#26C5D8]/40 bg-[#26C5D8]/10 p-3 text-xs font-semibold text-[var(--ink)]">
            {t.cart.digitalNoCod}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">{t.cart.fullName}</span>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="apple-input h-11 w-full rounded-xl px-3.5 text-sm text-[var(--ink)]"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">{t.cart.phone}</span>
            <input
              type="tel"
              required
              dir="ltr"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="0772827262"
              className="apple-input num h-11 w-full rounded-xl px-3.5 text-sm text-[var(--ink)]"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">{t.cart.wilaya}</span>
            <select
              value={wilaya}
              onChange={(e) => setWilaya(e.target.value)}
              className="apple-input h-11 w-full rounded-xl px-3.5 text-sm text-[var(--ink)]"
            >
              {ALGERIAN_WILAYAS.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">{t.cart.address}</span>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="apple-input h-11 w-full rounded-xl px-3.5 text-sm text-[var(--ink)]"
            />
          </label>
        </div>

        {needsBillRef && (
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">{t.cart.billRef} *</span>
            <input
              type="text"
              required
              dir="ltr"
              value={billRef}
              onChange={(e) => setBillRef(e.target.value)}
              placeholder={t.cart.billRefPlaceholder}
              className="apple-input num h-11 w-full rounded-xl px-3.5 text-sm text-[var(--ink)]"
            />
          </label>
        )}

        {/* Payment Method Intersection Selector */}
        {!payCheck.conflict && (
          <div className="space-y-2">
            <span className="block text-xs font-bold text-[var(--ink)]">{t.cart.payMethod}</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {payCheck.methods.map((method) => {
                const active = paymentMethod === method;
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`min-h-11 rounded-xl border px-3 py-2.5 text-xs font-bold transition-all active:scale-[0.97] cursor-pointer ${
                      active
                        ? 'border-[#0B2D5B] bg-[#0B2D5B] text-[#FFFFFF] dark:border-[#D7193F] dark:bg-[#D7193F] dark:text-[#FFFFFF] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]'
                        : 'liquid-glass text-[var(--ink)]'
                    }`}
                  >
                    {t.payLabels[method]}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CCP / BaridiMob Receipt Proof Upload */}
        {paymentMethod === 'ccp' && (
          <div className="rounded-2xl border border-[var(--border)]/80 bg-white/55 dark:bg-white/6 backdrop-blur-md p-4 space-y-3">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">{t.cart.ccpInstructions}</p>
            <div className="num rounded-xl bg-[var(--surface-alt)]/80 p-3 text-xs font-bold text-[var(--ink)]">
              <div>{settings.ccpName || 'Librairie Slimi'}</div>
              {settings.ccpRip && <div className="mt-0.5 select-all">{settings.ccpRip}</div>}
            </div>
            <label className="inline-flex h-11 items-center gap-2 rounded-xl border border-dashed border-[#0B2D5B] px-4 text-xs font-bold text-[#0B2D5B] dark:border-[#FF6B86] dark:text-[#FF6B86] cursor-pointer">
              <Upload className="h-4 w-4" />
              <span>{uploadingProof ? '...' : t.cart.uploadProof}</span>
              <input type="file" accept="image/*" onChange={handleProofUpload} className="sr-only" />
            </label>
            {proofUrl && (
              <div className="flex items-center gap-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                <img src={proofUrl} alt="Receipt" className="h-12 w-12 rounded-lg object-cover border" />
                <span>{t.cart.proofUploaded}</span>
              </div>
            )}
          </div>
        )}

        {paymentMethod === 'chargily' && (
          <div className="rounded-xl border border-[var(--border)]/80 bg-white/55 dark:bg-white/6 p-3 text-xs font-medium text-[var(--ink-muted)]">
            {settings.chargilyEnabled ? t.cart.chargilyReady : t.cart.chargilySimulated}
          </div>
        )}

        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-[var(--ink)]">{t.cart.notes}</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="apple-input w-full rounded-xl p-3 text-sm text-[var(--ink)]"
          />
        </label>

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-bold text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={payCheck.conflict || !paymentMethod || submitting}
          className="apple-btn-primary h-12 w-full rounded-xl text-base font-extrabold disabled:opacity-45 cursor-pointer"
        >
          {submitting ? t.cart.submitting : t.cart.submitOrder}
        </button>
      </form>
    </div>
  );
}
