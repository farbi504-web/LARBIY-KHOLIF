import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Globe,
  Home,
  MapPin,
  Moon,
  PackageSearch,
  Search,
  ShieldCheck,
  ShoppingBag,
  Store,
  Sun,
  User,
  X,
} from 'lucide-react';
import { TX } from '../shared/i18n.ts';
import { formatPriceDzd } from '../shared/commerce.ts';
import type { Lang, Product, PublicSettings } from '../shared/types.ts';
import { ServiceSvgIllustration, SlimiLogoMark } from './ServiceArtwork.tsx';

export type AppView =
  | 'home'
  | 'shop'
  | 'product'
  | 'cart'
  | 'track'
  | 'account'
  | 'contact'
  | 'legal'
  | 'admin'
  | 'notfound';

interface HeaderProps {
  lang: Lang;
  dark: boolean;
  view: AppView;
  cartCount: number;
  settings: PublicSettings;
  products?: Product[];
  searchValue?: string;
  onSearchSubmit?: (query: string) => void;
  onOpenProduct?: (product: Product) => void;
  onNavigate: (view: AppView) => void;
  onToggleLang: () => void;
  onToggleTheme: () => void;
}

export function Header({
  lang,
  dark,
  view,
  cartCount,
  settings,
  products = [],
  searchValue = '',
  onSearchSubmit,
  onOpenProduct,
  onNavigate,
  onToggleLang,
  onToggleTheme,
}: HeaderProps) {
  const t = TX[lang];
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState(searchValue);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;

  useEffect(() => {
    setQuery(searchValue);
  }, [searchValue]);

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 40);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen]);

  const liveMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return products
      .filter((p) => {
        const hay = `${p.name.ar} ${p.name.fr} ${p.desc.ar} ${p.desc.fr}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 5);
  }, [products, query]);

  const navItems: { id: AppView; label: string }[] = [
    { id: 'home', label: t.nav.home },
    { id: 'shop', label: t.nav.shop },
    { id: 'track', label: t.nav.track },
    { id: 'contact', label: t.nav.contact },
  ];

  function handleSearchForm(e: React.FormEvent) {
    e.preventDefault();
    if (onSearchSubmit) {
      onSearchSubmit(query.trim());
    } else {
      onNavigate('shop');
    }
    setSearchOpen(false);
  }

  const iconBtnClass =
    'inline-flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--ink)]/30 hover:bg-[var(--surface-alt)] transition-colors cursor-pointer shrink-0';

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/96 dark:bg-[#0D0E12]/96 backdrop-blur-md">
        <div className="mx-auto flex h-13 sm:h-16 max-w-6xl items-center justify-between gap-2 sm:gap-8 px-3 sm:px-6">
          {/* Zone 1: Brand (Single-Line Wordmark + Original Logo) */}
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 sm:gap-2.5 text-start whitespace-nowrap shrink-0 py-1 cursor-pointer group min-w-0"
          >
            <SlimiLogoMark logoUrl={settings.logo} size={32} variant="auto" />
            <span className="font-display text-sm sm:text-lg font-extrabold text-[var(--ink)] group-hover:text-[var(--crimson)] transition-colors truncate">
              {settings.storeName[lang] || t.brand}
            </span>
          </button>

          {/* Zone 2: Clean Typographic Nav Links */}
          <nav
            className="hidden md:flex items-center gap-7"
            aria-label="Main navigation"
          >
            {navItems.map((item) => {
              const active = view === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`relative py-1.5 text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                    active
                      ? 'text-[var(--ink)]'
                      : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                  }`}
                >
                  <span>{item.label}</span>
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 -bottom-0.5 h-[2px] rounded-full bg-[var(--crimson)] transition-opacity duration-200 ${
                      active ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Search, Language/Theme, Account, Admin & Primary Cart CTA */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-expanded={searchOpen}
              aria-label={t.catalog.searchPlaceholder}
              title={t.catalog.searchPlaceholder}
              className={`${iconBtnClass} ${
                searchOpen ? 'border-[var(--crimson)] text-[var(--crimson)]' : ''
              }`}
            >
              {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={onToggleLang}
              aria-label={lang === 'ar' ? 'Passer en français' : 'التحويل للعربية'}
              className="inline-flex h-8 sm:h-10 min-w-8 sm:min-w-10 items-center justify-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 sm:px-2.5 text-xs font-bold text-[var(--ink)] hover:border-[var(--ink)]/30 hover:bg-[var(--surface-alt)] transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <Globe className="h-3.5 w-3.5 text-[var(--crimson)]" />
              <span>{lang === 'ar' ? 'FR' : 'AR'}</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              aria-label={dark ? 'Light mode' : 'Dark mode'}
              className={iconBtnClass}
            >
              {dark ? (
                <Sun className="h-4 w-4 text-[#E83556]" />
              ) : (
                <Moon className="h-4 w-4 text-[var(--ink)]" />
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('account')}
              aria-label={t.nav.account}
              title={t.nav.account}
              className={`hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors cursor-pointer shrink-0 ${
                view === 'account'
                  ? 'border-[#111318] bg-[#111318] text-white dark:border-[#E83556] dark:bg-[#E83556]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--ink)]/30 hover:bg-[var(--surface-alt)]'
              }`}
            >
              <User className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('admin')}
              aria-label={t.nav.admin}
              title={t.nav.admin}
              className={`hidden sm:inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors cursor-pointer shrink-0 ${
                view === 'admin'
                  ? 'border-[#111318] bg-[#111318] text-white dark:border-[#E83556] dark:bg-[#E83556]'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:border-[var(--ink)]/30 hover:bg-[var(--surface-alt)]'
              }`}
            >
              <ShieldCheck className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate('cart')}
              aria-label={t.nav.cart}
              className="apple-btn-primary ms-0.5 inline-flex h-8 sm:h-10 items-center gap-1.5 sm:gap-2 rounded-lg px-2.5 sm:px-3.5 text-xs sm:text-sm font-bold cursor-pointer whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t.nav.cart}</span>
              <span className="num inline-flex h-4.5 sm:h-5 min-w-4.5 sm:min-w-5 items-center justify-center rounded bg-black/20 px-1 sm:px-1.5 text-[11px] font-bold text-white">
                {cartCount}
              </span>
            </button>
          </div>
        </div>

        {/* Expandable Instant Search Drawer inside Header */}
        {searchOpen && (
          <div className="border-t border-[var(--border)] bg-[var(--surface)] dark:bg-[#0D0E12]">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 py-3.5 space-y-3">
              <form onSubmit={handleSearchForm} className="flex items-center gap-2.5">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-[var(--ink-muted)]" />
                  <input
                    ref={inputRef}
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t.catalog.searchPlaceholder}
                    aria-label={t.catalog.searchPlaceholder}
                    className="apple-input h-11 w-full rounded-lg ps-10 pe-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
                  />
                </div>
                <button
                  type="submit"
                  className="apple-btn-primary inline-flex h-11 items-center gap-1.5 rounded-lg px-5 text-xs sm:text-sm font-bold whitespace-nowrap cursor-pointer"
                >
                  <span>{lang === 'fr' ? 'Rechercher' : 'بحث'}</span>
                  <ArrowIcon className="h-4 w-4" />
                </button>
              </form>

              {query.trim() && (
                <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--bg)] overflow-hidden">
                  {liveMatches.length > 0 ? (
                    liveMatches.map((prod) => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => {
                          setSearchOpen(false);
                          if (onOpenProduct) {
                            onOpenProduct(prod);
                          } else {
                            onSearchSubmit?.(query.trim());
                          }
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-start hover:bg-[var(--surface)] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-12 shrink-0 overflow-hidden rounded-md bg-[var(--surface-alt)] border border-[var(--border)]">
                            {prod.img ? (
                              <img
                                src={prod.img}
                                alt={prod.name[lang] || prod.name.ar}
                                referrerPolicy="no-referrer"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <ServiceSvgIllustration cat={prod.cat} />
                            )}
                          </div>
                          <span className="truncate text-sm font-semibold text-[var(--ink)]">
                            {prod.name[lang] || prod.name.ar}
                          </span>
                        </div>
                        <span className="num shrink-0 text-xs sm:text-sm font-bold text-[var(--crimson)]">
                          {formatPriceDzd(prod.price, lang)}
                        </span>
                      </button>
                    ))
                  ) : (
                    <div className="px-4 py-3 text-xs text-[var(--ink-muted)]">
                      {t.catalog.emptyTitle}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Clean Mobile Bottom Bar (52px to keep total sticky chrome compact <= 13% on 844px viewport) */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 flex h-13 items-center justify-around border-t border-[var(--border)] bg-[var(--surface)]/98 dark:bg-[#0D0E12]/98 px-1"
        aria-label="Mobile navigation"
      >
        {navItems.map((item) => {
          const active = view === item.id;
          const mobileLabel =
            item.id === 'contact' && lang === 'ar'
              ? 'تواصل'
              : item.id === 'track' && lang === 'ar'
                ? 'تتبع'
                : item.label;
          const Icon =
            item.id === 'home'
              ? Home
              : item.id === 'shop'
                ? Store
                : item.id === 'track'
                  ? PackageSearch
                  : MapPin;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                active ? 'text-[var(--crimson)]' : 'text-[var(--ink-muted)]'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{mobileLabel}</span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => onNavigate('account')}
          className={`relative flex h-12 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
            view === 'account' ? 'text-[var(--crimson)]' : 'text-[var(--ink-muted)]'
          }`}
        >
          <User className="h-4 w-4" aria-hidden="true" />
          <span>{t.nav.account}</span>
        </button>
      </nav>
    </>
  );
}
