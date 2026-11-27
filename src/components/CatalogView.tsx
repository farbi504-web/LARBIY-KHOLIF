import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpDown, Heart, RefreshCw, Search, SlidersHorizontal, X } from 'lucide-react';
import { TX } from '../shared/i18n.ts';
import { DEFAULT_CATEGORIES, resolveCategoryLabel } from '../shared/categories.ts';
import type { CategoryIconName, CategoryId, CategoryItem, Lang, Product, ProductType } from '../shared/types.ts';
import { CategoryIcon } from './CategoryIcon.tsx';
import { CatalogCardSkeletonGrid } from './ProductSkeletons.tsx';
import { ProductCard } from './ProductCard.tsx';

export type SortMode = 'featured' | 'bestselling' | 'price_asc' | 'price_desc' | 'newest';

interface CatalogViewProps {
  lang: Lang;
  categories?: CategoryItem[];
  products: Product[];
  loading: boolean;
  error: string | null;
  search: string;
  category: CategoryId | 'all';
  productType: ProductType | 'all';
  sort: SortMode;
  minPrice: string;
  maxPrice: string;
  wishlistIds: string[];
  wishlistOnly: boolean;
  onSearchChange: (v: string) => void;
  onCategoryChange: (c: CategoryId | 'all') => void;
  onTypeChange: (t: ProductType | 'all') => void;
  onSortChange: (s: SortMode) => void;
  onMinPriceChange: (v: string) => void;
  onMaxPriceChange: (v: string) => void;
  onWishlistOnlyChange: (v: boolean) => void;
  onToggleWishlist: (p: Product) => void;
  onRetry: () => void;
  onOpenProduct: (p: Product) => void;
  onAddToCart: (p: Product) => void;
}

export function CatalogView({
  lang,
  categories: storeCategories = DEFAULT_CATEGORIES,
  products,
  loading,
  error,
  search,
  category,
  productType,
  sort,
  minPrice,
  maxPrice,
  wishlistIds,
  wishlistOnly,
  onSearchChange,
  onCategoryChange,
  onTypeChange,
  onSortChange,
  onMinPriceChange,
  onMaxPriceChange,
  onWishlistOnlyChange,
  onToggleWishlist,
  onRetry,
  onOpenProduct,
  onAddToCart,
}: CatalogViewProps) {
  const t = TX[lang];

  const availableTypes = new Set(products.map((p) => p.type));
  const showTypeFilter = availableTypes.size > 1;
  const parsedMin = minPrice.trim() !== '' ? Number(minPrice) : null;
  const parsedMax = maxPrice.trim() !== '' ? Number(maxPrice) : null;
  const hasPriceFilter = Boolean(minPrice.trim() || maxPrice.trim());
  const wishlistCount = products.filter((p) => wishlistIds.includes(p.id)).length;

  const filtered = products
    .filter((p) => {
      if (wishlistOnly && !wishlistIds.includes(p.id)) return false;
      if (!wishlistOnly && category !== 'all' && p.cat !== category) return false;
      if (showTypeFilter && productType !== 'all' && p.type !== productType) return false;
      if (parsedMin !== null && Number.isFinite(parsedMin) && p.price < parsedMin) return false;
      if (parsedMax !== null && Number.isFinite(parsedMax) && p.price > parsedMax) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${p.name.ar} ${p.name.fr} ${p.desc.ar} ${p.desc.fr}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sort === 'bestselling') {
        return b.salesCount - a.salesCount || Number(b.featured) - Number(a.featured);
      }
      if (sort === 'price_asc') return a.price - b.price;
      if (sort === 'price_desc') return b.price - a.price;
      if (sort === 'newest') return b.createdAt.localeCompare(a.createdAt);
      return Number(b.featured) - Number(a.featured) || b.salesCount - a.salesCount;
    });

  const activeCategories = (storeCategories.length ? storeCategories : DEFAULT_CATEGORIES).filter(
    (c) => c.active,
  );
  const categories: { id: CategoryId | 'all'; label: string; icon?: CategoryIconName }[] = [
    { id: 'all', label: t.catalog.allCats },
    ...activeCategories.map((c) => ({
      id: c.id,
      label: (c.name[lang] || c.name.ar || c.name.fr || c.id).trim(),
      icon: c.icon,
    })),
  ];

  const sortOptions: { id: SortMode; label: string }[] = [
    { id: 'featured', label: t.catalog.sortFeatured },
    { id: 'bestselling', label: t.catalog.sortBestselling },
    { id: 'price_asc', label: t.catalog.sortPriceAsc },
    { id: 'price_desc', label: t.catalog.sortPriceDesc },
    { id: 'newest', label: t.catalog.sortNewest },
  ];

  function clearAllFilters() {
    onWishlistOnlyChange(false);
    onCategoryChange('all');
    onTypeChange('all');
    onSearchChange('');
    onMinPriceChange('');
    onMaxPriceChange('');
  }

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--border)]/80 pb-4">
        <h1 className="font-display text-2xl sm:text-3xl font-black text-[var(--ink)]">
          {t.catalog.title}
        </h1>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 start-3.5 h-4 w-4 text-[var(--ink-muted)]" />
            <input
              type="search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={t.catalog.searchPlaceholder}
              aria-label={t.catalog.searchPlaceholder}
              className="apple-input h-11 w-full rounded-xl ps-10 pe-3 text-sm text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
            />
          </div>

          <select
            value={sort}
            onChange={(e) => onSortChange(e.target.value as SortMode)}
            aria-label={t.catalog.sortBy}
            className="apple-input h-11 rounded-xl px-3.5 text-sm font-semibold text-[var(--ink)] cursor-pointer"
          >
            {sortOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Mobile Category & Price Filter Strip */}
      <div className="flex lg:hidden flex-col gap-3">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {categories.map((cat) => {
            const active = !wishlistOnly && category === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  onWishlistOnlyChange(false);
                  onCategoryChange(cat.id);
                }}
                className={`inline-flex h-10 items-center gap-2 px-3.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#111318] text-[#FFFFFF] dark:bg-[#E83556] dark:text-[#FFFFFF]'
                    : 'liquid-glass text-[var(--ink-muted)] hover:text-[var(--ink)]'
                }`}
              >
                <CategoryIcon cat={cat.id} icon={cat.icon} className="h-4 w-4 shrink-0" />
                <span>{cat.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => onWishlistOnlyChange(!wishlistOnly)}
            className={`inline-flex h-10 items-center gap-2 px-3.5 rounded-lg text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              wishlistOnly
                ? 'bg-[#D7193F] text-white'
                : 'liquid-glass text-[var(--ink-muted)] hover:text-[var(--ink)]'
            }`}
          >
            <Heart className={`h-4 w-4 shrink-0 ${wishlistOnly ? 'fill-white' : 'text-[#D7193F] dark:text-[#E83556]'}`} />
            <span>{t.wishlist.title}</span>
            <span className="num text-[11px]">({wishlistCount})</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="liquid-glass flex flex-1 min-w-[220px] items-center gap-2 rounded-lg px-2.5 py-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-[var(--crimson)]" />
            <input
              type="number"
              min={0}
              inputMode="numeric"
              dir="ltr"
              value={minPrice}
              onChange={(e) => onMinPriceChange(e.target.value)}
              placeholder={t.catalog.minPrice}
              aria-label={t.catalog.minPrice}
              className="apple-input num h-8 w-full min-w-0 rounded-md px-2 text-xs font-bold text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
            />
            <span className="text-xs text-[var(--ink-muted)]">-</span>
            <input
              type="number"
              min={0}
              inputMode="numeric"
              dir="ltr"
              value={maxPrice}
              onChange={(e) => onMaxPriceChange(e.target.value)}
              placeholder={t.catalog.maxPrice}
              aria-label={t.catalog.maxPrice}
              className="apple-input num h-8 w-full min-w-0 rounded-md px-2 text-xs font-bold text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
            />
            {hasPriceFilter && (
              <button
                type="button"
                onClick={() => {
                  onMinPriceChange('');
                  onMaxPriceChange('');
                }}
                aria-label={t.catalog.clearPrice}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--ink-muted)] hover:text-[var(--ink)] cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {showTypeFilter && (
            <div className="liquid-glass inline-flex items-center gap-1 rounded-lg p-1">
              {(['all', 'physical', 'digital'] as const).map((tp) => {
                const active = productType === tp;
                const label =
                  tp === 'all'
                    ? t.catalog.allTypes
                    : tp === 'physical'
                      ? t.catalog.physical
                      : t.catalog.digital;
                return (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => onTypeChange(tp)}
                    className={`relative h-8 px-3 rounded-md text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      active ? 'text-[#FFFFFF]' : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="catalog-mobile-type-pill"
                        transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.75 }}
                        className="absolute inset-0 rounded-md bg-[#111318] dark:bg-[#E83556]"
                      />
                    )}
                    <span className="relative z-10">{label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Desktop Sidebar Filter Menu */}
        <aside
          aria-label={t.services.title}
          className="hidden lg:block lg:col-span-3 liquid-glass rounded-xl p-4 space-y-4 sticky top-20"
        >
          <h2 className="font-display text-sm font-extrabold text-[var(--ink)] px-1">
            {t.services.title}
          </h2>
          <nav className="flex flex-col gap-1">
            {categories.map((cat) => {
              const active = !wishlistOnly && category === cat.id;
              const count =
                cat.id === 'all'
                  ? products.length
                  : products.filter((p) => p.cat === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    onWishlistOnlyChange(false);
                    onCategoryChange(cat.id);
                  }}
                  className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 text-start text-[13px] font-bold leading-snug transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#111318] text-[#FFFFFF] dark:bg-[#E83556] dark:text-[#FFFFFF]'
                      : 'text-[var(--ink-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]'
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <CategoryIcon
                      cat={cat.id}
                      icon={cat.icon}
                      className={`h-4 w-4 shrink-0 ${active ? 'text-[#FFFFFF]' : 'text-[var(--crimson)]'}`}
                    />
                    <span>{cat.label}</span>
                  </span>
                  <span
                    className={`num shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded ${
                      active ? 'bg-white/15 text-[#FFFFFF]' : 'bg-[var(--surface-alt)] text-[var(--ink-muted)]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => onWishlistOnlyChange(!wishlistOnly)}
              className={`mt-1 flex items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 text-start text-[13px] font-bold leading-snug transition-colors cursor-pointer border ${
                wishlistOnly
                  ? 'border-[#D7193F] bg-[#D7193F] text-white'
                  : 'border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] hover:bg-[var(--surface-alt)]'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <Heart
                  className={`h-4 w-4 shrink-0 ${
                    wishlistOnly ? 'fill-white text-white' : 'text-[var(--crimson)]'
                  }`}
                />
                <span>{t.wishlist.title}</span>
              </span>
              <span
                className={`num shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded ${
                  wishlistOnly ? 'bg-white/20 text-white' : 'bg-[var(--surface-alt)] text-[var(--ink-muted)]'
                }`}
              >
                {wishlistCount}
              </span>
            </button>
          </nav>

          {showTypeFilter && (
            <div className="border-t border-[var(--border)] pt-3.5 space-y-2">
              <div className="flex flex-col gap-1 rounded-lg bg-[var(--surface-alt)] p-1">
                {(['all', 'physical', 'digital'] as const).map((tp) => {
                  const active = productType === tp;
                  const label =
                    tp === 'all'
                      ? t.catalog.allTypes
                      : tp === 'physical'
                        ? t.catalog.physical
                        : t.catalog.digital;
                  return (
                    <button
                      key={tp}
                      type="button"
                      onClick={() => onTypeChange(tp)}
                      className={`relative h-9 rounded-md px-3 text-start text-xs font-bold transition-colors cursor-pointer ${
                        active
                          ? 'text-[#FFFFFF]'
                          : 'text-[var(--ink-muted)] hover:text-[var(--ink)]'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="catalog-desktop-type-pill"
                          transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.75 }}
                          className="absolute inset-0 rounded-md bg-[#111318] dark:bg-[#E83556]"
                        />
                      )}
                      <span className="relative z-10">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Price Range Filter */}
          <div className="border-t border-[var(--border)] pt-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[var(--ink)]">
                <SlidersHorizontal className="h-3.5 w-3.5 text-[var(--crimson)]" />
                <span>{t.catalog.priceRange}</span>
              </span>
              {hasPriceFilter && (
                <button
                  type="button"
                  onClick={() => {
                    onMinPriceChange('');
                    onMaxPriceChange('');
                  }}
                  className="text-[11px] font-bold text-[var(--crimson)] hover:underline cursor-pointer"
                >
                  {t.catalog.clearPrice}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                dir="ltr"
                value={minPrice}
                onChange={(e) => onMinPriceChange(e.target.value)}
                placeholder={t.catalog.minPrice}
                aria-label={t.catalog.minPrice}
                className="apple-input num h-10 w-full rounded-lg px-2.5 text-xs font-bold text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
              />
              <input
                type="number"
                min={0}
                inputMode="numeric"
                dir="ltr"
                value={maxPrice}
                onChange={(e) => onMaxPriceChange(e.target.value)}
                placeholder={t.catalog.maxPrice}
                aria-label={t.catalog.maxPrice}
                className="apple-input num h-10 w-full rounded-lg px-2.5 text-xs font-bold text-[var(--ink)] placeholder:text-[var(--ink-muted)]"
              />
            </div>
          </div>

          {/* Sort Options */}
          <div className="border-t border-[var(--border)] pt-3.5 space-y-2">
            <div className="flex items-center gap-1.5 px-1 text-xs font-extrabold text-[var(--ink)]">
              <ArrowUpDown className="h-3.5 w-3.5 text-[var(--crimson)]" />
              <span>{t.catalog.sortBy}</span>
            </div>
            <div className="flex flex-col gap-1">
              {sortOptions.map((opt) => {
                const active = sort === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onSortChange(opt.id)}
                    className={`h-9 rounded-lg px-3 text-start text-xs font-bold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#111318] text-[#FFFFFF] dark:bg-[#E83556] dark:text-[#FFFFFF]'
                        : 'text-[var(--ink-muted)] hover:bg-[var(--surface-alt)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="lg:col-span-9 space-y-4">
          {/* Results count & Active Filters */}
          {!loading && !error && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[var(--ink-muted)]">
                <span className="num text-[var(--ink)]">{filtered.length}</span> {t.catalog.resultsCount}
              </span>

              {(wishlistOnly || category !== 'all' || productType !== 'all' || search.trim() || hasPriceFilter) && (
                <div className="flex flex-wrap items-center gap-2">
                  {wishlistOnly && (
                    <button
                      type="button"
                      onClick={() => onWishlistOnlyChange(false)}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-rose-500/35 bg-rose-500/10 px-2 font-bold text-rose-700 dark:text-rose-300 cursor-pointer"
                    >
                      <span>{t.wishlist.title}</span>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {!wishlistOnly && category !== 'all' && (
                    <button
                      type="button"
                      onClick={() => onCategoryChange('all')}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 font-bold text-[var(--ink)] cursor-pointer"
                    >
                      <span>{resolveCategoryLabel(storeCategories, category, lang, t.services.items)}</span>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {productType !== 'all' && (
                    <button
                      type="button"
                      onClick={() => onTypeChange('all')}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 font-bold text-[var(--ink)] cursor-pointer"
                    >
                      <span>{productType === 'digital' ? t.catalog.digital : t.catalog.physical}</span>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {hasPriceFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        onMinPriceChange('');
                        onMaxPriceChange('');
                      }}
                      className="num inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 font-bold text-[var(--ink)] cursor-pointer"
                    >
                      <span dir="ltr">
                        {minPrice || '0'} – {maxPrice || '∞'} DA
                      </span>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {search.trim() && (
                    <button
                      type="button"
                      onClick={() => onSearchChange('')}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-[var(--border)] bg-[var(--surface)] px-2 font-bold text-[var(--ink)] cursor-pointer"
                    >
                      <span>“{search.trim()}”</span>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="font-bold text-[#D7193F] dark:text-[#FF6B86] hover:underline cursor-pointer"
                  >
                    {t.catalog.clearAll}
                  </button>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <CatalogCardSkeletonGrid count={6} />
          ) : error ? (
            <div className="liquid-glass rounded-xl p-8 text-center space-y-4">
              <p className="font-display text-lg font-bold text-[var(--ink)]">{t.catalog.errorTitle}</p>
              <p className="text-sm text-[var(--ink-muted)]">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#D7193F] px-5 text-sm font-bold text-white cursor-pointer"
              >
                <RefreshCw className="h-4 w-4" />
                <span>{t.catalog.retry}</span>
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="liquid-glass rounded-xl p-10 text-center space-y-3">
              {wishlistOnly && !search && !hasPriceFilter && productType === 'all' ? (
                <>
                  <Heart className="mx-auto h-9 w-9 text-[var(--ink-muted)]" />
                  <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">{t.wishlist.emptyTitle}</h2>
                  <p className="mx-auto max-w-md text-sm text-[var(--ink-muted)]">{t.wishlist.emptyDesc}</p>
                  <button
                    type="button"
                    onClick={() => onWishlistOnlyChange(false)}
                    className="apple-btn-primary mt-2 inline-flex h-11 items-center rounded-lg px-5 text-sm font-bold cursor-pointer"
                  >
                    {t.wishlist.browse}
                  </button>
                </>
              ) : (
                <>
                  <h2 className="font-display text-xl font-extrabold text-[var(--ink)]">{t.catalog.emptyTitle}</h2>
                  <p className="mx-auto max-w-md text-sm text-[var(--ink-muted)]">{t.catalog.emptyDesc}</p>
                  {(wishlistOnly || category !== 'all' || productType !== 'all' || search || hasPriceFilter) && (
                    <button
                      type="button"
                      onClick={clearAllFilters}
                      className="apple-btn-primary mt-2 inline-flex h-11 items-center rounded-lg px-5 text-sm font-bold cursor-pointer"
                    >
                      {t.catalog.resetFilters}
                    </button>
                  )}
                </>
              )}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
            >
              {filtered.map((prod) => (
                <ProductCard
                  key={prod.id}
                  lang={lang}
                  product={prod}
                  categories={storeCategories}
                  isSaved={wishlistIds.includes(prod.id)}
                  onOpen={onOpenProduct}
                  onAddToCart={onAddToCart}
                  onToggleWishlist={onToggleWishlist}
                  headingTag="h2"
                />
              ))}
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
