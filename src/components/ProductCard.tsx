import React from 'react';
import { Heart, Star } from 'lucide-react';
import { TX } from '../shared/i18n.ts';
import { formatPriceDzd } from '../shared/commerce.ts';
import { DEFAULT_CATEGORIES, resolveCategoryLabel } from '../shared/categories.ts';
import type { CategoryItem, Lang, Product } from '../shared/types.ts';
import { LazyImage } from './LazyImage.tsx';
import { ServiceSvgIllustration } from './ServiceArtwork.tsx';

interface ProductCardProps {
  lang: Lang;
  product: Product;
  categories?: CategoryItem[];
  isSaved?: boolean;
  onOpen: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleWishlist?: (product: Product) => void;
  headingTag?: 'h2' | 'h3';
}

export function ProductCard({
  lang,
  product,
  categories = DEFAULT_CATEGORIES,
  isSaved = false,
  onOpen,
  onAddToCart,
  onToggleWishlist,
  headingTag = 'h3',
}: ProductCardProps) {
  const t = TX[lang];
  const discountPct =
    product.old && product.old > product.price
      ? Math.round(((product.old - product.price) / product.old) * 100)
      : 0;
  const catLabel = resolveCategoryLabel(categories, product.cat, lang, t.services.items);
  const typeLabel = product.type === 'digital' ? t.catalog.digital : t.catalog.physical;
  const availLabel = product.avail ? t.catalog.available : t.catalog.unavailable;
  const titleText = product.name[lang] || product.name.ar || product.name.fr;

  return (
    <article className="liquid-glass relative group flex flex-col justify-between overflow-hidden rounded-xl hover:-translate-y-0.5">
      {onToggleWishlist && (
        <button
          type="button"
          onClick={() => onToggleWishlist(product)}
          aria-pressed={isSaved}
          aria-label={isSaved ? `${t.wishlist.saved}: ${titleText}` : `${t.wishlist.save}: ${titleText}`}
          title={isSaved ? t.wishlist.saved : t.wishlist.save}
          className="absolute top-3 end-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)]/95 text-[var(--ink)] hover:border-[var(--crimson)] transition-colors cursor-pointer"
        >
          <Heart
            className={`h-4 w-4 transition-colors ${
              isSaved
                ? 'fill-[#D7193F] text-[#D7193F] dark:fill-[#E83556] dark:text-[#E83556]'
                : 'text-[var(--ink-muted)]'
            }`}
          />
        </button>
      )}

      <button
        type="button"
        onClick={() => onOpen(product)}
        className="text-start cursor-pointer"
      >
        <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--surface-alt)] border-b border-[var(--border)]">
          <LazyImage
            src={product.img}
            alt={titleText}
            className="aspect-[4/3] w-full overflow-hidden bg-[var(--surface-alt)]"
            imgClassName="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
            fallback={<ServiceSvgIllustration cat={product.cat} />}
          />
        </div>

        <div className="p-4 sm:p-5 pb-3 space-y-1.5">
          <p className="text-xs font-medium text-[var(--ink-muted)] truncate">
            <span>{catLabel}</span>
            <span aria-hidden="true"> · </span>
            <span>{typeLabel}</span>
            <span aria-hidden="true"> · </span>
            <span className={product.avail ? 'text-[var(--ink)]' : 'text-[var(--crimson)]'}>
              {availLabel}
            </span>
          </p>

          {headingTag === 'h2' ? (
            <h2 className="font-display text-base font-bold text-[var(--ink)] line-clamp-2 group-hover:text-[var(--crimson)] transition-colors">
              {titleText}
            </h2>
          ) : (
            <h3 className="font-display text-base font-bold text-[var(--ink)] line-clamp-2 group-hover:text-[var(--crimson)] transition-colors">
              {titleText}
            </h3>
          )}

          {typeof product.reviewsCount === 'number' && product.reviewsCount > 0 && (
            <p className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--ink-muted)]">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
              <span className="num font-bold text-[var(--ink)]">
                {Number(product.rating || 0).toFixed(1)}
              </span>
              <span className="num">({product.reviewsCount})</span>
            </p>
          )}
        </div>
      </button>

      <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-3 border-t border-[var(--border)]/70 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="num text-base font-extrabold text-[var(--ink)]">
            {formatPriceDzd(product.price, lang)}
          </div>
          {product.old && product.old > product.price && (
            <div className="flex items-center gap-1.5">
              <span className="num text-xs line-through text-[var(--ink-muted)]">
                {formatPriceDzd(product.old, lang)}
              </span>
              {discountPct > 0 && (
                <span className="num text-[11px] font-bold text-[var(--crimson)]">
                  -{discountPct}%
                </span>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          disabled={!product.avail}
          onClick={() => onAddToCart(product)}
          className="apple-btn-primary inline-flex h-10 items-center justify-center rounded-lg px-4 text-xs sm:text-sm font-bold disabled:opacity-45 cursor-pointer whitespace-nowrap shrink-0"
        >
          {product.avail ? t.catalog.addToCart : t.catalog.unavailable}
        </button>
      </div>
    </article>
  );
}
