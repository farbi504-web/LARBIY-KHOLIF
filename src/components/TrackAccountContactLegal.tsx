import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Bell, CheckCircle2, Clock, ExternalLink, Heart, Mail, MapPin, MessageCircle, Package, Phone, Search, ShoppingBag, Store, Trash2, Truck, User, XCircle } from 'lucide-react';
import { TX } from '../shared/i18n.ts';
import { formatPriceDzd } from '../shared/commerce.ts';
import { DEFAULT_CATEGORIES, resolveCategoryLabel } from '../shared/categories.ts';
import type { CategoryItem, Customer, Lang, Order, Product, PublicSettings } from '../shared/types.ts';
import { apiJson } from '../utils/api.ts';
import { ServiceSvgIllustration } from './ServiceArtwork.tsx';

export type LegalTab = 'terms' | 'privacy' | 'faq';

export function TrackOrderView({
  lang,
  initialCode = '',
  initialPhone = '',
}: {
  lang: Lang;
  initialCode?: string;
  initialPhone?: string;
}) {
  const t = TX[lang];
  const [code, setCode] = useState(initialCode);
  const [phone, setPhone] = useState(initialPhone);
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  async function requestNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
      if (perm === 'granted' && order) {
        new Notification(`مكتبة سليمي - ${order.code}`, {
          body: `تم تفعيل إشعارات حالة الطلب بنجاح. حالة طلبك الحالية: ${t.statuses[order.status]}`,
          icon: '/favicon.ico',
        });
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    if (order && notifPermission === 'granted' && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        new Notification(`تحديث الطلب ${order.code}`, {
          body: `حالة طلبك الحالية: ${t.statuses[order.status]}`,
          icon: '/favicon.ico',
        });
      } catch {
        // ignore
      }
    }
  }, [order?.status]);

  async function lookup(c: string, p: string) {
    if (!c.trim() || !p.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<{ order: Order }>('/api/orders/track', {
        method: 'POST',
        body: JSON.stringify({ code: c.trim(), phone: p.trim() }),
      });
      setOrder(res.order);
    } catch {
      setOrder(null);
      setError(t.track.notFound);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialCode && initialPhone) {
      void lookup(initialCode, initialPhone);
    }
  }, [initialCode, initialPhone]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-8">
      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
          {t.track.title}
        </h1>
        <p className="text-sm text-[var(--ink-muted)]">{t.track.subtitle}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void lookup(code, phone);
        }}
        className="liquid-glass rounded-[24px] p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-12 gap-3 items-end"
      >
        <label className="sm:col-span-5 block space-y-1.5">
          <span className="text-xs font-bold text-[var(--ink)]">{t.track.codeLabel}</span>
          <input
            type="text"
            required
            dir="ltr"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t.track.codePlaceholder}
            className="apple-input num h-11 w-full rounded-xl px-3.5 text-sm text-[var(--ink)]"
          />
        </label>
        <label className="sm:col-span-5 block space-y-1.5">
          <span className="text-xs font-bold text-[var(--ink)]">{t.track.phoneLabel}</span>
          <input
            type="tel"
            required
            dir="ltr"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="0772827262"
            className="apple-input num h-11 w-full rounded-xl px-3.5 text-sm text-[var(--ink)]"
          />
        </label>
        <button
          type="submit"
          disabled={loading}
          className="apple-btn-primary sm:col-span-2 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-4 text-sm font-extrabold cursor-pointer"
        >
          <Search className="h-4 w-4" />
          <span>{t.track.searchBtn}</span>
        </button>
      </form>

      {error && (
        <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm font-semibold text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {order && (
        <div className="liquid-glass rounded-[24px] p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
            <div>
              <p className="num text-xl font-extrabold text-[#0B2D5B] dark:text-[#FF6B86]">
                {order.code}
              </p>
              <p className="text-xs text-[var(--ink-muted)]">
                {order.customerName} · {t.payLabels[order.paymentMethod]} ({t.payStatuses[order.paymentStatus]})
              </p>
              <p className="num mt-1 text-[11px] font-medium text-[var(--ink-muted)]">
                {t.track.orderedAt}: {new Date(order.createdAt).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'ar-DZ')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {typeof window !== 'undefined' && 'Notification' in window && notifPermission !== 'granted' && (
                <button
                  type="button"
                  onClick={() => void requestNotificationPermission()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-bold text-[var(--ink)] hover:border-[#D7193F] transition-colors cursor-pointer"
                  title={t.track.enableNotif}
                >
                  <Bell className="h-3.5 w-3.5 text-[#D7193F]" />
                  <span className="hidden sm:inline">{t.track.enableNotif}</span>
                </button>
              )}
              {notifPermission === 'granted' && (
                <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/12 px-3 py-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                  <Bell className="h-3.5 w-3.5" />
                  <span>{t.track.notifEnabled}</span>
                </span>
              )}
              <span className="rounded-xl bg-[#0B2D5B]/10 px-3.5 py-1.5 text-sm font-extrabold text-[#0B2D5B] dark:bg-[#D7193F]/20 dark:text-[#FF6B86]">
                {t.statuses[order.status]}
              </span>
            </div>
          </div>

          {/* Visual 4-Stage Order Progress Timeline */}
          {order.status === 'cancelled' ? (
            <div className="flex items-center gap-3 rounded-xl border border-rose-500/35 bg-rose-500/10 p-4 text-xs sm:text-sm font-semibold text-rose-700 dark:text-rose-300">
              <XCircle className="h-5 w-5 shrink-0" />
              <span>{t.track.cancelledNote}</span>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 pt-1">
              {(
                [
                  { id: 'pending', Icon: Clock },
                  { id: 'confirmed', Icon: CheckCircle2 },
                  { id: 'processing', Icon: Package },
                  { id: 'delivered', Icon: Truck },
                ] as const
              ).map((step, idx) => {
                const orderIdx = ['pending', 'confirmed', 'processing', 'delivered'].indexOf(order.status);
                const done = orderIdx >= idx;
                const current = orderIdx === idx;
                const StepIcon = step.Icon;
                return (
                  <div key={step.id} className="flex flex-col items-center text-center gap-2">
                    <div
                      className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border transition-colors ${
                        done
                          ? 'border-[#0B2D5B] bg-[#0B2D5B] text-[#FFFFFF] dark:border-[#D7193F] dark:bg-[#D7193F] dark:text-[#FFFFFF]'
                          : 'border-[var(--border)] bg-[var(--surface)] text-[var(--ink-muted)]'
                      } ${current ? 'ring-2 ring-[#D7193F] dark:ring-[#FF6B86] ring-offset-2 ring-offset-[var(--bg)]' : ''}`}
                    >
                      <StepIcon className="h-4 w-4" />
                    </div>
                    <span
                      className={`text-[11px] sm:text-xs font-bold leading-tight ${
                        done ? 'text-[var(--ink)]' : 'text-[var(--ink-muted)]'
                      }`}
                    >
                      {t.statuses[step.id]}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {order.deliveryData && (
            <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-4 space-y-1">
              <p className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                {t.track.deliveryTitle}
              </p>
              <pre className="whitespace-pre-wrap text-sm font-semibold text-[var(--ink)]">
                {order.deliveryData}
              </pre>
            </div>
          )}

          {order.billRef && (
            <div className="rounded-xl bg-[var(--surface)] p-3 text-sm">
              <span className="font-bold text-[var(--ink-muted)]">{t.track.billRefTitle}: </span>
              <span className="num font-bold text-[var(--ink)]">{order.billRef}</span>
            </div>
          )}

          <div className="space-y-2">
            <h2 className="text-xs font-bold text-[var(--ink-muted)]">{t.track.itemsTitle}</h2>
            {order.items.map((it, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-[var(--ink)]">
                  {it.name[lang] || it.name.ar}
                  {it.planLabel ? ` (${it.planLabel[lang] || it.planLabel.ar})` : ''} × {it.qty}
                </span>
                <span className="num font-bold text-[var(--ink)]">
                  {formatPriceDzd(it.unitPrice * it.qty, lang)}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--border)] pt-3">
            <span className="font-bold text-[var(--ink)]">{t.cart.subtotal}</span>
            <span className="num text-lg font-extrabold text-[#0B2D5B] dark:text-[#FF6B86]">
              {formatPriceDzd(order.subtotal, lang)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export function CustomerAccountView({
  lang,
  customer,
  products,
  categories = DEFAULT_CATEGORIES,
  wishlistIds,
  onCustomerChange,
  onTrackOrder,
  onToggleWishlist,
  onOpenProduct,
  onAddToCart,
  onGoShop,
}: {
  lang: Lang;
  customer: Customer | null;
  products: Product[];
  categories?: CategoryItem[];
  wishlistIds: string[];
  onCustomerChange: (c: Customer | null) => void;
  onTrackOrder: (code: string, phone: string) => void;
  onToggleWishlist: (product: Product) => void;
  onOpenProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onGoShop: () => void;
}) {
  const t = TX[lang];
  const [accountTab, setAccountTab] = useState<'account' | 'wishlist'>('account');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const wishlistProducts = products.filter((p) => wishlistIds.includes(p.id));

  useEffect(() => {
    if (customer) {
      apiJson<{ orders: Order[] }>('/api/customer/orders')
        .then((res) => setOrders(res.orders || []))
        .catch(() => setOrders([]));
    }
  }, [customer]);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/customer/login' : '/api/customer/register';
      const payload =
        mode === 'login' ? { phone, password } : { name, phone, email, password };
      const res = await apiJson<{ customer: Customer }>(endpoint, {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onCustomerChange(res.customer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await apiJson('/api/customer/logout', { method: 'POST' });
    onCustomerChange(null);
    setOrders([]);
  }

  const tabsBar = (
    <div className="liquid-glass mx-auto max-w-3xl flex items-center gap-1.5 rounded-2xl p-1.5">
      <button
        type="button"
        onClick={() => setAccountTab('account')}
        className={`relative flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
          accountTab === 'account'
            ? 'text-white'
            : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
        }`}
      >
        {accountTab === 'account' && (
          <motion.span
            layoutId="account-top-tab-pill"
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.75 }}
            className="absolute inset-0 rounded-xl bg-[#0B2D5B] dark:bg-[#D7193F] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
          />
        )}
        <User className="relative z-10 h-4 w-4 shrink-0" />
        <span className="relative z-10">{t.wishlist.accountTab}</span>
      </button>
      <button
        type="button"
        onClick={() => setAccountTab('wishlist')}
        className={`relative flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
          accountTab === 'wishlist'
            ? 'text-white'
            : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
        }`}
      >
        {accountTab === 'wishlist' && (
          <motion.span
            layoutId="account-top-tab-pill"
            transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.75 }}
            className="absolute inset-0 rounded-xl bg-[#0B2D5B] dark:bg-[#D7193F] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
          />
        )}
        <Heart className="relative z-10 h-4 w-4 shrink-0" />
        <span className="relative z-10">{t.wishlist.title}</span>
        <span
          className={`relative z-10 num inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[11px] font-bold ${
            accountTab === 'wishlist' ? 'bg-white/20 text-white' : 'bg-[var(--surface-alt)]/80 text-[var(--ink)]'
          }`}
        >
          {wishlistProducts.length}
        </span>
      </button>
    </div>
  );

  if (accountTab === 'wishlist') {
    return (
      <div className="mx-auto max-w-4xl space-y-6 pb-8">
        {tabsBar}

        <div className="space-y-1">
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
            {t.wishlist.title}
          </h1>
        </div>

        {wishlistProducts.length === 0 ? (
          <div className="liquid-glass rounded-2xl p-10 text-center space-y-4">
            <Heart className="mx-auto h-10 w-10 text-[var(--ink-muted)]" />
            <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">
              {t.wishlist.emptyTitle}
            </h2>
            <p className="mx-auto max-w-md text-sm text-[var(--ink-muted)]">
              {t.wishlist.emptyDesc}
            </p>
            <button
              type="button"
              onClick={onGoShop}
              className="inline-flex h-11 items-center rounded-xl bg-[#D7193F] px-6 text-sm font-extrabold text-[#FFFFFF] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] hover:bg-[#BE1335] transition-colors cursor-pointer"
            >
              {t.wishlist.browse}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {wishlistProducts.map((prod) => (
              <article
                key={prod.id}
                className="liquid-glass apple-sheen group flex flex-col justify-between overflow-hidden rounded-[24px] p-3.5 transition-all duration-300 hover:-translate-y-1"
              >
                <button
                  type="button"
                  onClick={() => onOpenProduct(prod)}
                  className="text-start cursor-pointer"
                >
                  <div className="aspect-[4/3] w-full overflow-hidden rounded-[17px] bg-[var(--surface-alt)]">
                    {prod.img ? (
                      <img
                        src={prod.img}
                        alt={prod.name[lang] || prod.name.ar}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                      />
                    ) : (
                      <ServiceSvgIllustration cat={prod.cat} />
                    )}
                  </div>
                  <div className="mt-3.5 space-y-1 px-0.5">
                    <p className="text-[11px] font-medium text-[var(--ink-muted)]">
                      {resolveCategoryLabel(categories, prod.cat, lang, t.services.items)}
                    </p>
                    <h2 className="font-display text-sm sm:text-base font-extrabold text-[var(--ink)] line-clamp-2">
                      {prod.name[lang] || prod.name.ar}
                    </h2>
                  </div>
                </button>

                <div className="mt-3.5 mx-0.5 flex items-center justify-between gap-2 pt-3 border-t border-[var(--border)]/70">
                  <span className="num text-base font-extrabold text-[#0B2D5B] dark:text-[#FF6B86]">
                    {formatPriceDzd(prod.price, lang)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={!prod.avail}
                      onClick={() => onAddToCart(prod)}
                      className="apple-btn-primary inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-bold disabled:opacity-45 cursor-pointer"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      <span>{prod.avail ? t.catalog.addToCart : t.catalog.unavailable}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleWishlist(prod)}
                      aria-label={t.wishlist.saved}
                      title={t.wishlist.saved}
                      className="liquid-glass inline-flex h-9 w-9 items-center justify-center rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 active:scale-90 transition-all cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="space-y-6 pb-8">
        {tabsBar}
        <div className="mx-auto max-w-md liquid-glass rounded-[28px] p-6 sm:p-8 space-y-5">
          <h1 className="font-display text-2xl font-extrabold text-[var(--ink)]">{t.account.title}</h1>

        <div className="grid grid-cols-2 gap-1 rounded-xl bg-[var(--surface-alt)]/65 dark:bg-white/6 p-1">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`relative h-10 rounded-lg text-sm font-bold cursor-pointer transition-colors ${
              mode === 'login' ? 'text-white' : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            {mode === 'login' && (
              <motion.span
                layoutId="auth-mode-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.75 }}
                className="absolute inset-0 rounded-lg bg-[#0B2D5B] dark:bg-[#D7193F] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
              />
            )}
            <span className="relative z-10">{t.account.loginTab}</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`relative h-10 rounded-lg text-sm font-bold cursor-pointer transition-colors ${
              mode === 'register' ? 'text-white' : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            {mode === 'register' && (
              <motion.span
                layoutId="auth-mode-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.75 }}
                className="absolute inset-0 rounded-lg bg-[#0B2D5B] dark:bg-[#D7193F] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
              />
            )}
            <span className="relative z-10">{t.account.registerTab}</span>
          </button>
        </div>

        <form onSubmit={handleAuth} className="space-y-4">
          {mode === 'register' && (
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--ink)]">{t.account.name}</span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="apple-input h-11 w-full rounded-xl px-3.5 text-sm"
              />
            </label>
          )}
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">{t.account.phone}</span>
            <input
              type="tel"
              required
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="0772827262"
              className="apple-input num h-11 w-full rounded-xl px-3.5 text-sm"
            />
          </label>
          {mode === 'register' && (
            <label className="block space-y-1.5">
              <span className="text-xs font-bold text-[var(--ink)]">{t.account.email}</span>
              <input
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="apple-input h-11 w-full rounded-xl px-3.5 text-sm"
              />
            </label>
          )}
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-[var(--ink)]">{t.account.password}</span>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="apple-input h-11 w-full rounded-xl px-3.5 text-sm"
            />
          </label>

          {error && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs font-bold text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="apple-btn-primary h-12 w-full rounded-xl text-sm font-extrabold cursor-pointer"
          >
            {mode === 'login' ? t.account.loginBtn : t.account.registerBtn}
          </button>
        </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      {tabsBar}
      <div className="liquid-glass rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-[var(--ink)]">{customer.name}</h1>
          <p className="num text-sm text-[var(--ink-muted)]">{customer.phone}</p>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="h-11 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 text-sm font-bold text-[var(--ink)] cursor-pointer"
        >
          {t.account.logout}
        </button>
      </div>

      <div className="space-y-3">
        <h2 className="font-display text-xl font-bold text-[var(--ink)]">{t.account.myOrders}</h2>
        {orders.length === 0 ? (
          <div className="liquid-glass rounded-2xl p-6 text-sm text-[var(--ink-muted)]">
            {t.account.noOrders}
          </div>
        ) : (
          orders.map((ord) => (
            <div
              key={ord.id}
              className="liquid-glass rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3"
            >
              <div>
                <p className="num font-extrabold text-[#0B2D5B] dark:text-[#FF6B86]">{ord.code}</p>
                <p className="text-xs text-[var(--ink-muted)]">
                  {ord.createdAt.slice(0, 10)} · {t.statuses[ord.status]}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="num font-extrabold text-[var(--ink)]">
                  {formatPriceDzd(ord.subtotal, lang)}
                </span>
                <button
                  type="button"
                  onClick={() => onTrackOrder(ord.code, ord.customerPhone)}
                  className="h-10 rounded-xl bg-[#D7193F] px-3.5 text-xs font-extrabold text-[#FFFFFF] hover:bg-[#BE1335] transition-colors cursor-pointer"
                >
                  {t.nav.track}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function ContactView({ lang, settings }: { lang: Lang; settings: PublicSettings }) {
  const t = TX[lang];
  const phoneClean = (settings.phone || '0772827262').replace(/\s+/g, '');
  const waNum = settings.whatsapp || '213772827262';

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <div className="space-y-1">
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
          {t.contact.title}
        </h1>
        <p className="text-sm sm:text-base text-[var(--ink-muted)]">{t.contact.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="liquid-glass rounded-[24px] p-6 flex flex-col items-start gap-2.5">
          <MapPin className="h-6 w-6 text-[#D7193F] dark:text-[#FF6B86]" />
          <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.contact.addressLabel}</h2>
          <p className="text-sm text-[var(--ink-muted)]">{settings.address[lang]}</p>
        </div>

        <div className="liquid-glass rounded-[24px] p-6 flex flex-col items-start gap-2.5">
          <Phone className="h-6 w-6 text-[#D7193F] dark:text-[#FF6B86]" />
          <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.contact.phoneLabel}</h2>
          <p className="num w-fit text-base font-extrabold text-[var(--ink)]" dir="ltr">
            {settings.phone}
          </p>
          <a
            href={`tel:${phoneClean}`}
            className="mt-auto inline-flex h-10 items-center rounded-xl bg-[#0B2D5B] dark:bg-white/12 border border-white/15 px-4 text-xs font-bold text-white hover:opacity-90 active:scale-95 transition-all"
          >
            {t.contact.callNow}
          </a>
        </div>

        <div className="liquid-glass rounded-[24px] p-6 flex flex-col items-start gap-2.5">
          <Clock className="h-6 w-6 text-[#D7193F] dark:text-[#FF6B86]" />
          <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.contact.hoursLabel}</h2>
          <p className="text-sm text-[var(--ink-muted)]">{settings.workingHours[lang]}</p>
          <a
            href={`https://wa.me/${encodeURIComponent(waNum)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="apple-btn-primary mt-auto inline-flex h-10 items-center gap-1.5 rounded-xl px-4 text-xs font-extrabold"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{t.contact.chatWhatsapp}</span>
          </a>
        </div>

        <div className="liquid-glass rounded-[24px] p-6 flex flex-col items-start gap-2.5">
          <div className="flex items-center gap-2">
            <div className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#1877F2]/15 text-[#1877F2]">
              <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
            </div>
            <h2 className="font-display text-base font-bold text-[var(--ink)]">{t.contact.facebookLabel}</h2>
          </div>
          <p className="text-sm font-semibold text-[var(--ink)]">{t.contact.facebookPage}</p>
          <a
            href={settings.facebook || 'https://www.facebook.com/slimi.bookstore'}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto inline-flex h-10 items-center gap-2 rounded-xl bg-[#1877F2] hover:bg-[#166fe5] px-4 text-xs font-bold text-white active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>{t.contact.visitFacebook}</span>
          </a>
        </div>
      </div>
    </div>
  );
}

export function LegalView({
  lang,
  tab,
  onTabChange,
}: {
  lang: Lang;
  tab: LegalTab;
  onTabChange: (t: LegalTab) => void;
}) {
  const t = TX[lang];
  const tabs: { id: LegalTab; label: string }[] = [
    { id: 'terms', label: t.legal.terms },
    { id: 'privacy', label: t.legal.privacy },
    { id: 'faq', label: t.legal.faq },
  ];

  const content: Record<LegalTab, { ar: string[]; fr: string[] }> = {
    terms: {
      ar: [
        'تُقدَّم كافة الخدمات والمنتجات عبر مكتبة سليمي في حطاطبة، تيبازة وفق التوفر والأسعار المعروضة بالدينار الجزائري.',
        'المنتجات الرقمية (اشتراكات التطبيقات، شحن الألعاب، دفع الفواتير) يتم تفعيلها وتسليمها يدويًا بعد تأكيد الدفع.',
        'يلتزم الزبون بإدخال رقم هاتف صحيح ومرجع الفاتورة أو المعرّف الصحيح عند طلب خدمات الدفع.',
      ],
      fr: [
        'Les produits et services de la Librairie Slimi (Hatatba, Tipaza) sont proposés en dinars algériens selon disponibilité.',
        'Les services numériques (abonnements, recharges jeux, paiement de factures) sont activés manuellement après confirmation du paiement.',
        "Le client s'engage à fournir un numéro de téléphone exact et une référence de facture ou identifiant valide.",
      ],
    },
    privacy: {
      ar: [
        'نجمع فقط البيانات الضرورية لمعالجة الطلب والتسليم والتواصل مع الزبون (الاسم، الهاتف، العنوان، وإثبات الدفع عند التحويل).',
        'لا نشارك بيانات الزبائن مع أي جهة خارجية باستثناء مزودي بوابة الدفع الإلكتروني عند اختيار الدفع عبر Chargily.',
      ],
      fr: [
        'Nous collectons uniquement les données nécessaires au traitement et à la livraison de votre commande (nom, téléphone, adresse, justificatif de paiement).',
        'Aucune donnée client n’est vendue ou partagée avec des tiers hors prestataire de paiement Chargily lors d’un règlement en ligne.',
      ],
    },
    faq: {
      ar: [
        'كيف أستلم اشتراك التطبيق بعد الطلب؟ — تصلك بيانات التفعيل يدويًا عبر واتساب وتظهر أيضًا في صفحة تتبع الطلب.',
        'هل يتوفر الدفع عند الاستلام للاشتراكات؟ — لا، الدفع عند الاستلام متاح للمنتجات المادية فقط، بينما الاشتراكات تُدفع عبر CCP/بريدي موب أو Chargily.',
      ],
      fr: [
        'Comment recevoir mon abonnement ? — Les accès sont transmis manuellement via WhatsApp et visibles sur la page Suivi de commande.',
        'Le paiement à la livraison est-il disponible pour le numérique ? — Non, il est réservé aux articles physiques ; le numérique utilise BaridiMob/CCP ou Chargily.',
      ],
    },
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-8">
      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onTabChange(item.id)}
            className={`relative h-11 rounded-full px-4.5 text-sm font-bold cursor-pointer transition-colors ${
              tab === item.id
                ? 'text-white'
                : 'liquid-glass text-[var(--ink)]'
            }`}
          >
            {tab === item.id && (
              <motion.span
                layoutId="legal-tab-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.75 }}
                className="absolute inset-0 rounded-full bg-[#0B2D5B] dark:bg-[#D7193F] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]"
              />
            )}
            <span className="relative z-10">{item.label}</span>
          </button>
        ))}
      </div>

      <article className="liquid-glass rounded-[28px] p-6 sm:p-8 space-y-4">
        <h1 className="font-display text-2xl font-extrabold text-[var(--ink)]">
          {tabs.find((x) => x.id === tab)?.label}
        </h1>
        <ul className="space-y-3 text-sm sm:text-base leading-relaxed text-[var(--ink-muted)] list-disc ps-5">
          {content[tab][lang].map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </article>
    </div>
  );
}
