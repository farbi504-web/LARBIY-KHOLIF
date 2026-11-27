import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import { FileText, Heart, HelpCircle, Lock, Shield } from 'lucide-react';
import { TX } from './shared/i18n.ts';
import { DEFAULT_CATEGORIES, groupCategories } from './shared/categories.ts';
import type {
  CartItem,
  CategoryId,
  CategoryItem,
  Customer,
  Lang,
  Product,
  ProductType,
  PublicSettings,
} from './shared/types.ts';
import { apiJson } from './utils/api.ts';
import { CategoryIcon } from './components/CategoryIcon.tsx';
import { AnnouncementBar } from './components/AnnouncementBar.tsx';
import { FloatingActionButton } from './components/FloatingActionButton.tsx';
import { CartDrawer } from './components/CartDrawer.tsx';
import { Header, type AppView } from './components/Header.tsx';
import { StoreHome } from './components/StoreHome.tsx';
import { CatalogView, type SortMode } from './components/CatalogView.tsx';
import { ProductDetailView } from './components/ProductDetailView.tsx';
import { CartCheckoutView } from './components/CartCheckoutView.tsx';
import {
  ContactView,
  CustomerAccountView,
  LegalView,
  TrackOrderView,
  type LegalTab,
} from './components/TrackAccountContactLegal.tsx';
import { AdminConsole } from './components/AdminConsole.tsx';
import { SlimiLogoMark } from './components/ServiceArtwork.tsx';

const DEFAULT_SETTINGS: PublicSettings = {
  storeName: { ar: 'مكتبة سليمي', fr: 'Librairie Slimi' },
  address: {
    ar: 'شارع استقلال حطاطبة ولاية تيبازة',
    fr: "Rue de l'Indépendance, Hatatba, Wilaya de Tipaza",
  },
  phone: '0772 82 72 62',
  whatsapp: '213772827262',
  ccpRip: '',
  ccpName: 'Librairie Slimi',
  workingHours: {
    ar: 'السبت إلى الخميس: 08:00 - 20:00',
    fr: 'Samedi au Jeudi : 08h00 - 20h00',
  },
  announcement: {
    ar: 'مرحباً بكم في مكتبة سليمي · توصيل سريع لجميع الولايات · اطلب الآن عبر الواتساب',
    fr: 'Bienvenue à la Librairie Slimi · Livraison rapide · Commandez dès maintenant',
  },
  announcementConfig: {
    enabled: true,
    tone: 'navy',
    mode: 'ticker',
    speed: 'normal',
    dismissible: false,
    ctaLabel: { ar: 'تصفح المتجر', fr: 'Boutique' },
    ctaTarget: 'shop',
  },
  logo: '',
  facade: '',
  facade2: '',
  in1: '',
  svc_subs: '',
  svc_games: '',
  svc_bills: '',
  svc_shop: '',
  vid: '',
  gallery: [],
  chargilyEnabled: false,
  chargilyMode: 'test',
  deliveryProvider: 'none',
  deliveryEnabled: false,
  deliveryApiId: '',
  facebook: 'https://www.facebook.com/slimi.bookstore',
};

function parseInitialRoute(): { view: AppView; productId?: string; trackCode?: string } {
  try {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash || hash === '/') return { view: 'home' };
    if (hash.startsWith('product=')) {
      return { view: 'product', productId: decodeURIComponent(hash.slice('product='.length)) };
    }
    if (hash.startsWith('track=')) {
      return { view: 'track', trackCode: decodeURIComponent(hash.slice('track='.length)) };
    }
    const valid: AppView[] = ['home', 'shop', 'cart', 'track', 'account', 'contact', 'legal', 'admin'];
    if (valid.includes(hash as AppView)) {
      return { view: hash as AppView };
    }
    return { view: 'notfound' };
  } catch {
    return { view: 'home' };
  }
}

export default function App() {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem('slimi-lang');
      return saved === 'fr' ? 'fr' : 'ar';
    } catch {
      return 'ar';
    }
  });

  const [dark, setDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('slimi-theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    } catch {
      return false;
    }
  });

  const initial = parseInitialRoute();
  const [view, setView] = useState<AppView>(initial.view);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(initial.productId);
  const [trackPrefill, setTrackPrefill] = useState<{ code: string; phone: string }>({
    code: initial.trackCode || '',
    phone: '',
  });
  const [legalTab, setLegalTab] = useState<LegalTab>('terms');

  // Catalog filter state
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryId | 'all'>('all');
  const [productType, setProductType] = useState<ProductType | 'all'>('all');
  const [sort, setSort] = useState<SortMode>('featured');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [wishlistOnly, setWishlistOnly] = useState(false);

  // Data state
  const [settings, setSettings] = useState<PublicSettings>(DEFAULT_SETTINGS);
  const [categories, setCategories] = useState<CategoryItem[]>(DEFAULT_CATEGORIES);
  const [products, setProducts] = useState<Product[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cart & Wishlist state
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const raw = localStorage.getItem('slimi-cart');
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [wishlistIds, setWishlistIds] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('slimi-wishlist');
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
    } catch {
      return [];
    }
  });
  const [toast, setToast] = useState<string | null>(null);
  const [cartDrawerOpen, setCartDrawerOpen] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem('slimi-lang', lang);
    } catch {
      // ignore storage failure
    }
  }, [lang]);

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [dark]);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const listener = (e: MediaQueryListEvent) => {
      try {
        if (!localStorage.getItem('slimi-theme')) {
          setDark(e.matches);
        }
      } catch {
        setDark(e.matches);
      }
    };
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('slimi-cart', JSON.stringify(cart));
    } catch {
      // ignore
    }
  }, [cart]);

  useEffect(() => {
    try {
      localStorage.setItem('slimi-wishlist', JSON.stringify(wishlistIds));
    } catch {
      // ignore
    }
  }, [wishlistIds]);

  const loadBootstrap = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiJson<{
        settings: PublicSettings;
        categories?: CategoryItem[];
        products: Product[];
        customer: Customer | null;
      }>('/api/store/bootstrap');
      setSettings(res.settings);
      if (Array.isArray(res.categories)) {
        setCategories(res.categories);
      }
      setProducts(res.products);
      setCustomer(res.customer);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load store');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    const onHashChange = () => {
      const parsed = parseInitialRoute();
      setView(parsed.view);
      if (parsed.productId) setSelectedProductId(parsed.productId);
      if (parsed.trackCode) setTrackPrefill((p) => ({ ...p, code: parsed.trackCode || '' }));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Code-based navigation that works inside sandboxed iframes without relying on location.hash mutation
  const nav = useCallback((nextView: AppView, hashOverride?: string) => {
    setView(nextView);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const targetHash = hashOverride ?? (nextView === 'home' ? '' : `#${nextView}`);
      window.history.replaceState(null, '', targetHash || window.location.pathname);
    } catch {
      // Sandboxed iframes may block history/hash updates; React state handles navigation cleanly
    }
  }, []);

  function addToCart(product: Product, planId?: string, qty = 1) {
    const resolvedPlanId = planId || product.plans?.[0]?.id;
    setCart((prev) => {
      const idx = prev.findIndex(
        (it) => it.product.id === product.id && it.planId === resolvedPlanId,
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: Math.min(99, copy[idx].qty + qty) };
        return copy;
      }
      return [...prev, { product, planId: resolvedPlanId, qty }];
    });
    setCartDrawerOpen(true);
  }

  function toggleWishlist(product: Product) {
    const label = product.name[lang] || product.name.ar;
    const exists = wishlistIds.includes(product.id);
    setWishlistIds((prev) =>
      exists ? prev.filter((id) => id !== product.id) : [...prev, product.id],
    );
    const prefix = exists ? TX[lang].wishlist.removedToast : TX[lang].wishlist.addedToast;
    setToast(`${prefix} ${label}`);
    setTimeout(() => setToast(null), 2200);
  }

  const t = TX[lang];
  const cartCount = cart.reduce((acc, it) => acc + it.qty, 0);
  const selectedProduct =
    products.find((p) => p.id === selectedProductId) || null;

  const toggleLang = () => setLang((l) => (l === 'ar' ? 'fr' : 'ar'));
  const toggleTheme = () => {
    setDark((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('slimi-theme', next ? 'dark' : 'light');
      } catch {
        // ignore
      }
      return next;
    });
  };

  if (view === 'admin') {
    return (
      <MotionConfig reducedMotion="user">
        <AdminConsole
          lang={lang}
          dark={dark}
          logoUrl={settings.logo}
          onToggleLang={toggleLang}
          onToggleTheme={toggleTheme}
          onBackToStore={() => nav('home')}
          onNavigateStore={(v) => nav(v)}
          onStoreDataChanged={loadBootstrap}
        />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="relative min-h-screen flex flex-col overflow-x-clip bg-[var(--bg)] text-[var(--ink)]">
      <AnnouncementBar
        lang={lang}
        announcement={settings.announcement}
        config={settings.announcementConfig}
        onNavigate={(v) => nav(v)}
      />
      <Header
        lang={lang}
        dark={dark}
        view={view}
        cartCount={cartCount}
        settings={settings}
        products={products}
        searchValue={search}
        onSearchSubmit={(q) => {
          setWishlistOnly(false);
          setCategory('all');
          setSearch(q);
          nav('shop');
        }}
        onOpenProduct={(p) => {
          setSelectedProductId(p.id);
          nav('product', `#product=${encodeURIComponent(p.id)}`);
        }}
        onNavigate={(v) => nav(v)}
        onToggleLang={toggleLang}
        onToggleTheme={toggleTheme}
      />

      {view === 'home' ? (
        <main className="relative z-10 flex-1 w-full bg-[var(--bg)]">
          <StoreHome
            lang={lang}
            settings={settings}
            categories={categories}
            products={products}
            wishlistIds={wishlistIds}
            onExploreCategory={(cat) => {
              setWishlistOnly(false);
              setCategory(cat);
              nav('shop');
            }}
            onGoShop={(initialQuery) => {
              setWishlistOnly(false);
              setCategory('all');
              setSearch(initialQuery || '');
              nav('shop');
            }}
            onGoTrack={() => nav('track')}
            onGoContact={() => nav('contact')}
            onOpenProduct={(p) => {
              setSelectedProductId(p.id);
              nav('product', `#product=${encodeURIComponent(p.id)}`);
            }}
            onAddToCart={(p) => addToCart(p)}
            onToggleWishlist={(p) => toggleWishlist(p)}
          />
        </main>
      ) : (
        <main className="relative z-10 flex-1 w-full bg-[var(--bg)]">
          <motion.div
            key={view}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="mx-auto w-full max-w-6xl px-4 sm:px-6 pt-6 sm:pt-8 pb-24 md:pb-12"
          >

        {view === 'shop' && (
          <CatalogView
            lang={lang}
            categories={categories}
            products={products}
            loading={loading}
            error={error}
            search={search}
            category={category}
            productType={productType}
            sort={sort}
            minPrice={minPrice}
            maxPrice={maxPrice}
            wishlistIds={wishlistIds}
            wishlistOnly={wishlistOnly}
            onSearchChange={setSearch}
            onCategoryChange={setCategory}
            onTypeChange={setProductType}
            onSortChange={setSort}
            onMinPriceChange={setMinPrice}
            onMaxPriceChange={setMaxPrice}
            onWishlistOnlyChange={setWishlistOnly}
            onToggleWishlist={(p) => toggleWishlist(p)}
            onRetry={loadBootstrap}
            onOpenProduct={(p) => {
              setSelectedProductId(p.id);
              nav('product', `#product=${encodeURIComponent(p.id)}`);
            }}
            onAddToCart={(p) => addToCart(p)}
          />
        )}

        {view === 'product' && (
          <ProductDetailView
            lang={lang}
            product={selectedProduct}
            allProducts={products}
            loading={loading}
            settings={settings}
            categories={categories}
            isWishlisted={Boolean(selectedProduct && wishlistIds.includes(selectedProduct.id))}
            onBack={() => nav('shop')}
            onOpenProduct={(p) => {
              setSelectedProductId(p.id);
              nav('product', `#product=${encodeURIComponent(p.id)}`);
            }}
            onAddToCart={(p, planId, qty) => addToCart(p, planId, qty)}
            onToggleWishlist={(p) => toggleWishlist(p)}
          />
        )}

        {view === 'cart' && (
          <CartCheckoutView
            lang={lang}
            cart={cart}
            settings={settings}
            customer={customer}
            onUpdateQty={(idx, qty) =>
              setCart((prev) => prev.map((it, i) => (i === idx ? { ...it, qty } : it)))
            }
            onRemoveItem={(idx) => setCart((prev) => prev.filter((_, i) => i !== idx))}
            onClearCart={() => setCart([])}
            onGoShop={() => nav('shop')}
            onTrackOrder={(code, phone) => {
              setTrackPrefill({ code, phone });
              nav('track', `#track=${encodeURIComponent(code)}`);
            }}
          />
        )}

        {view === 'track' && (
          <TrackOrderView
            lang={lang}
            initialCode={trackPrefill.code}
            initialPhone={trackPrefill.phone}
          />
        )}

        {view === 'account' && (
          <CustomerAccountView
            lang={lang}
            customer={customer}
            products={products}
            categories={categories}
            wishlistIds={wishlistIds}
            onCustomerChange={setCustomer}
            onTrackOrder={(code, phone) => {
              setTrackPrefill({ code, phone });
              nav('track', `#track=${encodeURIComponent(code)}`);
            }}
            onToggleWishlist={(p) => toggleWishlist(p)}
            onOpenProduct={(p) => {
              setSelectedProductId(p.id);
              nav('product', `#product=${encodeURIComponent(p.id)}`);
            }}
            onAddToCart={(p) => addToCart(p)}
            onGoShop={() => {
              setWishlistOnly(false);
              nav('shop');
            }}
          />
        )}

        {view === 'contact' && <ContactView lang={lang} settings={settings} />}

        {view === 'legal' && (
          <LegalView lang={lang} tab={legalTab} onTabChange={setLegalTab} />
        )}

        {view === 'notfound' && (
          <div className="liquid-glass rounded-2xl p-10 text-center space-y-4">
            <h1 className="font-display text-3xl font-extrabold text-[var(--ink)]">
              404 · {t.notFound.title}
            </h1>
            <p className="text-sm text-[var(--ink-muted)]">{t.notFound.desc}</p>
            <button
              type="button"
              onClick={() => nav('home')}
              className="inline-flex h-11 items-center rounded-xl bg-[#D7193F] px-6 text-sm font-extrabold text-[#FFFFFF] shadow-[inset_0_1px_0_rgba(255,255,255,0.28)] hover:bg-[#BE1335] transition-colors cursor-pointer"
            >
              {t.notFound.goHome}
            </button>
          </div>
        )}
          </motion.div>
        </main>
      )}

      {/* Slide-over Cart Drawer */}
      <CartDrawer
        open={cartDrawerOpen}
        lang={lang}
        cart={cart}
        onClose={() => setCartDrawerOpen(false)}
        onUpdateQty={(idx, qty) =>
          setCart((prev) => prev.map((it, i) => (i === idx ? { ...it, qty } : it)))
        }
        onRemoveItem={(idx) => setCart((prev) => prev.filter((_, i) => i !== idx))}
        onGoCheckout={() => nav('cart')}
        onGoShop={() => nav('shop')}
      />

      {/* Clean Toast Feedback */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            role="status"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.18 }}
            className="fixed bottom-20 md:bottom-8 left-1/2 -translate-x-1/2 z-50 inline-flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-lg bg-[#111318] px-4 py-2.5 text-xs sm:text-sm font-bold text-[#FFFFFF] border border-white/15 shadow-lg"
          >
            <Heart className="h-3.5 w-3.5 shrink-0 fill-[#E83556] text-[#E83556]" aria-hidden="true" />
            <span className="truncate">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <FloatingActionButton lang={lang} settings={settings} />

      {/* Footer */}
      <footer className="relative z-10 bg-[#111318] text-[#FFFFFF] border-t border-white/10 pt-12 pb-24 md:pb-12 mt-auto">
        {(() => {
          const groupedFooterCats = groupCategories(
            categories.length ? categories : DEFAULT_CATEGORIES,
          );
          return (
            <div className="mx-auto max-w-6xl px-4 sm:px-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <SlimiLogoMark logoUrl={settings.logo} size={40} variant="dark" />
                  <span className="font-display text-lg font-extrabold text-[#FFFFFF]">
                    {settings.storeName[lang] || t.brand}
                  </span>
                </div>
                {settings.address[lang] && (
                  <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
                    {settings.address[lang]}
                  </p>
                )}
                {settings.workingHours[lang] && (
                  <p className="text-xs text-white/65">{settings.workingHours[lang]}</p>
                )}
                <div className="flex flex-col items-start gap-1.5 pt-1">
                  {settings.phone && (
                    <p className="num w-fit text-xs font-bold text-[#E83556]" dir="ltr">
                      {settings.phone}
                    </p>
                  )}
                  <a
                    href="mailto:toyschop@gmail.com"
                    dir="ltr"
                    className="num w-fit text-xs text-white/80 hover:text-[#E83556] transition-colors"
                  >
                    toyschop@gmail.com
                  </a>
                  <a
                    href={settings.facebook || 'https://www.facebook.com/slimi.bookstore'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-white/85 hover:text-[#E83556] transition-colors cursor-pointer"
                  >
                    <svg className="h-3.5 w-3.5 fill-current text-[#1877F2]" viewBox="0 0 24 24">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                    <span>{t.contact.facebookPage}</span>
                  </a>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="font-display text-sm font-extrabold text-[#E83556]">
                  {t.services.groups.retail}
                </h2>
                <div className="flex flex-col items-start gap-2 text-xs sm:text-sm text-white/85">
                  {groupedFooterCats.retail.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setWishlistOnly(false);
                        setCategory(cat.id);
                        nav('shop');
                      }}
                      className="inline-flex items-center gap-2 hover:text-[#E83556] transition-colors cursor-pointer"
                    >
                      <CategoryIcon
                        cat={cat.id}
                        icon={cat.icon}
                        className="h-4 w-4 text-[#E83556]/90 shrink-0"
                      />
                      <span>{cat.name[lang] || cat.name.ar || cat.name.fr}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="font-display text-sm font-extrabold text-[#E83556]">
                  {t.services.groups.digital}
                </h2>
                <div className="flex flex-col items-start gap-2 text-xs sm:text-sm text-white/85">
                  {groupedFooterCats.digital.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setWishlistOnly(false);
                        setCategory(cat.id);
                        nav('shop');
                      }}
                      className="inline-flex items-center gap-2 hover:text-[#E83556] transition-colors cursor-pointer"
                    >
                      <CategoryIcon
                        cat={cat.id}
                        icon={cat.icon}
                        className="h-4 w-4 text-[#E83556]/90 shrink-0"
                      />
                      <span>{cat.name[lang] || cat.name.ar || cat.name.fr}</span>
                    </button>
                  ))}

                  <div className="pt-2 border-t border-white/10 w-full flex flex-col items-start gap-2">
                    <button
                      type="button"
                      onClick={() => nav('track')}
                      className="hover:text-[#E83556] transition-colors cursor-pointer"
                    >
                      {t.nav.track}
                    </button>
                    <button
                      type="button"
                      onClick={() => nav('contact')}
                      className="hover:text-[#E83556] transition-colors cursor-pointer"
                    >
                      {t.nav.contact}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="font-display text-sm font-extrabold text-[#E83556]">
                  {lang === 'fr' ? 'Informations' : 'معلومات وسياسات'}
                </h2>
                <div className="flex flex-col items-start gap-2 text-xs sm:text-sm text-white/85">
                  {(['terms', 'privacy', 'faq'] as LegalTab[]).map((lt) => {
                    const LegalIcon =
                      lt === 'terms'
                        ? FileText
                        : lt === 'privacy'
                          ? Shield
                          : HelpCircle;
                    return (
                      <button
                        key={lt}
                        type="button"
                        onClick={() => {
                          setLegalTab(lt);
                          nav('legal');
                        }}
                        className="inline-flex items-center gap-2 hover:text-[#E83556] transition-colors cursor-pointer"
                      >
                        <LegalIcon className="h-4 w-4 text-white/60 shrink-0" aria-hidden="true" />
                        <span>{t.legal[lt]}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => nav('admin')}
                    className="pt-1 inline-flex items-center gap-2 text-xs font-bold text-[#E83556] hover:underline cursor-pointer"
                  >
                    <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span>{t.nav.admin}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      </footer>
    </div>
    </MotionConfig>
  );
}
