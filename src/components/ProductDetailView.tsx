import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Heart,
  MessageSquare,
  Minus,
  Plus,
  Send,
  ShoppingBag,
  Star,
  User,
  X,
  ZoomIn,
} from 'lucide-react';
import { TX } from '../shared/i18n.ts';
import { formatPriceDzd, resolveItemUnitPrice } from '../shared/commerce.ts';
import { DEFAULT_CATEGORIES, resolveCategoryLabel } from '../shared/categories.ts';
import { apiJson } from '../utils/api.ts';
import type {
  CategoryItem,
  Lang,
  Product,
  ProductReviewsData,
  PublicSettings,
} from '../shared/types.ts';
import { ProductMeta } from './ProductMeta.tsx';
import { ProductDetailSkeleton } from './ProductSkeletons.tsx';
import { ServiceSvgIllustration } from './ServiceArtwork.tsx';

interface ProductDetailViewProps {
  lang: Lang;
  product: Product | null;
  allProducts: Product[];
  loading?: boolean;
  settings?: PublicSettings;
  categories?: CategoryItem[];
  isWishlisted?: boolean;
  onBack: () => void;
  onOpenProduct: (p: Product) => void;
  onAddToCart: (p: Product, planId?: string, qty?: number) => void;
  onToggleWishlist?: (p: Product) => void;
}

function StarRow({
  rating,
  size = 'sm',
}: {
  rating: number;
  size?: 'sm' | 'md' | 'lg';
}) {
  const cls =
    size === 'lg' ? 'h-5 w-5' : size === 'md' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const rounded = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`${cls} ${
            star <= rounded
              ? 'fill-amber-400 text-amber-400'
              : 'text-slate-300 dark:text-white/25'
          }`}
        />
      ))}
    </span>
  );
}

export function ProductDetailView({
  lang,
  product,
  allProducts,
  loading = false,
  settings,
  categories = DEFAULT_CATEGORIES,
  isWishlisted = false,
  onBack,
  onOpenProduct,
  onAddToCart,
  onToggleWishlist,
}: ProductDetailViewProps) {
  const t = TX[lang];
  const BackIcon = lang === 'ar' ? ArrowRight : ArrowLeft;
  const [selectedPlanId, setSelectedPlanId] = useState<string | undefined>(
    product?.plans?.[0]?.id,
  );
  const [qty, setQty] = useState(1);
  const [zoomOpen, setZoomOpen] = useState(false);

  // Reviews State
  const [reviewsData, setReviewsData] = useState<ProductReviewsData>({
    reviews: [],
    averageRating: 0,
    totalReviews: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [ratingInput, setRatingInput] = useState(5);
  const [hoverRating, setHoverRating] = useState(0);
  const [authorName, setAuthorName] = useState('');
  const [comment, setComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  useEffect(() => {
    setSelectedPlanId(product?.plans?.[0]?.id);
    setQty(1);
    setReviewError(null);
    setReviewSuccess(false);
    if (!product?.id) return;

    let cancelled = false;
    setReviewsLoading(true);
    apiJson<ProductReviewsData>(`/api/products/${encodeURIComponent(product.id)}/reviews`)
      .then((data) => {
        if (!cancelled && data) {
          setReviewsData({
            reviews: Array.isArray(data.reviews) ? data.reviews : [],
            averageRating: Number(data.averageRating || 0),
            totalReviews: Number(data.totalReviews || 0),
            distribution: data.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
          });
        }
      })
      .catch(() => {
        // Keep clean empty reviews fallback
      })
      .finally(() => {
        if (!cancelled) setReviewsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [product?.id]);

  async function handleSubmitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!product) return;
    setReviewError(null);
    setReviewSuccess(false);
    const cleanAuthor = authorName.trim();
    if (cleanAuthor.length < 2) {
      setReviewError(
        lang === 'fr'
          ? 'Veuillez saisir votre nom (2 caractères minimum).'
          : 'يرجى إدخال اسمك (حرفين على الأقل).',
      );
      return;
    }

    setSubmittingReview(true);
    try {
      const res = await apiJson<ProductReviewsData>(
        `/api/products/${encodeURIComponent(product.id)}/reviews`,
        {
          method: 'POST',
          body: JSON.stringify({
            authorName: cleanAuthor,
            rating: ratingInput,
            comment: comment.trim(),
          }),
        },
      );
      setReviewsData({
        reviews: Array.isArray(res.reviews) ? res.reviews : [],
        averageRating: Number(res.averageRating || 0),
        totalReviews: Number(res.totalReviews || 0),
        distribution: res.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      });
      setAuthorName('');
      setComment('');
      setRatingInput(5);
      setReviewSuccess(true);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : 'Error');
    } finally {
      setSubmittingReview(false);
    }
  }

  if (loading && !product) {
    return (
      <>
        <ProductMeta lang={lang} product={null} settings={settings} />
        <ProductDetailSkeleton />
      </>
    );
  }

  if (!product) {
    return (
      <div className="liquid-glass rounded-2xl p-10 text-center space-y-4">
        <ProductMeta lang={lang} product={null} settings={settings} />
        <h1 className="font-display text-2xl font-bold text-[var(--ink)]">{t.product.notFound}</h1>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0B2D5B] dark:bg-[#D7193F] px-5 text-sm font-bold text-white cursor-pointer"
        >
          <BackIcon className="h-4 w-4" />
          <span>{t.product.back}</span>
        </button>
      </div>
    );
  }

  const activePlanId =
    selectedPlanId && product.plans.some((p) => p.id === selectedPlanId)
      ? selectedPlanId
      : product.plans[0]?.id;

  const { price, oldPrice } = resolveItemUnitPrice(product, activePlanId);
  const similar = allProducts
    .filter((p) => p.id !== product.id && p.cat === product.cat)
    .slice(0, 4);

  const effectivePays =
    product.type === 'digital'
      ? product.pays.filter((m) => m !== 'cod')
      : product.pays;

  const displayAvg =
    reviewsData.totalReviews > 0 ? reviewsData.averageRating.toFixed(1) : '0.0';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
      className="space-y-12 pb-8"
    >
      <ProductMeta lang={lang} product={product} settings={settings} categories={categories} />
      <button
        type="button"
        onClick={onBack}
        className="liquid-glass inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-bold text-[var(--ink)] active:scale-95 transition-all cursor-pointer"
      >
        <BackIcon className="h-4 w-4" />
        <span>{t.product.back}</span>
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sticky Product Gallery */}
        <div className="lg:col-span-6 lg:sticky lg:top-22 liquid-glass overflow-hidden rounded-[28px] p-3.5 sm:p-4">
          {product.img ? (
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              aria-label={t.product.zoomImage}
              className="group relative block aspect-[4/3] w-full overflow-hidden rounded-[20px] bg-[var(--surface-alt)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.22)] cursor-pointer"
            >
              <img
                src={product.img}
                alt={product.name[lang] || product.name.ar}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.035]"
              />
              <span className="liquid-glass-pill absolute bottom-3.5 end-3.5 inline-flex h-9 w-9 items-center justify-center rounded-full text-white opacity-90 group-hover:opacity-100 transition-opacity">
                <ZoomIn className="h-4 w-4" />
              </span>
            </button>
          ) : (
            <div className="aspect-[4/3] w-full overflow-hidden rounded-[20px] bg-[var(--surface-alt)]">
              <ServiceSvgIllustration cat={product.cat} />
            </div>
          )}
        </div>

        {/* Contiguous Purchase Module */}
        <div className="lg:col-span-6 liquid-glass rounded-[28px] p-6 sm:p-8 space-y-6">
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-[var(--ink-muted)]">
              {resolveCategoryLabel(categories, product.cat, lang, t.services.items)} ·{' '}
              {product.type === 'digital' ? t.catalog.digital : t.catalog.physical} ·{' '}
              <span className={product.avail ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600'}>
                {product.avail ? t.catalog.available : t.catalog.unavailable}
              </span>
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
              {product.name[lang] || product.name.ar}
            </h1>

            {/* Compact Star Rating Summary */}
            <a
              href="#product-reviews"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)]/75 px-3 py-1 text-xs font-bold text-[var(--ink)] hover:border-amber-400/60 transition-colors"
            >
              <StarRow rating={reviewsData.averageRating} size="sm" />
              <span className="num font-extrabold">
                {reviewsData.totalReviews > 0 ? displayAvg : '—'}
              </span>
              <span className="text-[var(--ink-muted)]">
                ({reviewsData.totalReviews} {t.product.reviewsCountSuffix})
              </span>
            </a>
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="num text-3xl font-extrabold text-[#0B2D5B] dark:text-[#FF6B86]">
              {formatPriceDzd(price, lang)}
            </span>
            {oldPrice && oldPrice > price && (
              <>
                <span className="num text-base line-through text-[var(--ink-muted)]">
                  {formatPriceDzd(oldPrice, lang)}
                </span>
                <span className="num text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                  -{Math.round(((oldPrice - price) / oldPrice) * 100)}%
                </span>
              </>
            )}
          </div>

          {(product.desc[lang] || product.desc.ar) && (
            <p className="text-sm sm:text-base leading-relaxed text-[var(--ink-muted)] whitespace-pre-line">
              {product.desc[lang] || product.desc.ar}
            </p>
          )}

          {/* Duration Plans */}
          {product.plans && product.plans.length > 0 && (
            <div className="space-y-2.5">
              <label className="block text-sm font-bold text-[var(--ink)]">
                {t.product.selectPlan}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {product.plans.map((pl) => {
                  const active = pl.id === activePlanId;
                  return (
                    <motion.button
                      key={pl.id}
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setSelectedPlanId(pl.id)}
                      className={`relative flex flex-col items-start rounded-2xl border p-3.5 text-start transition-colors cursor-pointer ${
                        active
                          ? 'border-[#0B2D5B]/45 dark:border-[#FF6B86]/55 text-[var(--ink)]'
                          : 'border-[var(--border)]/80 bg-white/45 dark:bg-white/5 hover:bg-white/75 dark:hover:bg-white/10'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="pdp-plan-highlight"
                          transition={{ type: 'spring', stiffness: 420, damping: 34, mass: 0.75 }}
                          className="absolute inset-0 rounded-2xl bg-[#0B2D5B]/10 dark:bg-[#D7193F]/20 border border-[#0B2D5B]/35 dark:border-[#FF6B86]/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]"
                        />
                      )}
                      <span className="relative z-10 text-sm font-bold text-[var(--ink)]">
                        {pl.label[lang] || pl.label.ar}
                      </span>
                      <span className="relative z-10 num mt-0.5 text-xs font-extrabold text-[#0B2D5B] dark:text-[#FF6B86]">
                        {formatPriceDzd(pl.price, lang)}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>
          )}

          {product.needsRef && (
            <div className="flex items-start gap-2.5 rounded-2xl border border-[#26C5D8]/40 bg-[#26C5D8]/10 p-3.5 text-sm text-[var(--ink)]">
              <FileText className="h-4 w-4 shrink-0 mt-0.5 text-[var(--royal)] dark:text-[#26C5D8]" />
              <span>{t.product.billRefNote}</span>
            </div>
          )}

          {/* Quantity & Add to Cart */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <div className="liquid-glass inline-flex h-12 items-center rounded-xl p-0.5">
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--ink)] hover:bg-white/60 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="num w-10 text-center text-base font-bold text-[var(--ink)]">{qty}</span>
              <button
                type="button"
                aria-label="Increase quantity"
                onClick={() => setQty((q) => Math.min(99, q + 1))}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-[var(--ink)] hover:bg-white/60 dark:hover:bg-white/10 active:scale-90 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              disabled={!product.avail}
              onClick={() => onAddToCart(product, activePlanId, qty)}
              className="apple-btn-primary flex-1 inline-flex h-12 min-w-[180px] items-center justify-center gap-2 rounded-xl px-6 text-base font-extrabold disabled:opacity-45 cursor-pointer"
            >
              <ShoppingBag className="h-5 w-5" />
              <span>{product.avail ? t.catalog.addToCart : t.catalog.unavailable}</span>
            </button>

            {onToggleWishlist && (
              <motion.button
                type="button"
                whileTap={{ scale: 0.86 }}
                onClick={() => onToggleWishlist(product)}
                aria-pressed={isWishlisted}
                aria-label={isWishlisted ? t.wishlist.saved : t.wishlist.save}
                title={isWishlisted ? t.wishlist.saved : t.wishlist.save}
                className={`inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
                  isWishlisted
                    ? 'border-rose-500/50 bg-rose-500/14 text-rose-600 dark:text-rose-400'
                    : 'liquid-glass text-[var(--ink)]'
                }`}
              >
                <Heart className={`h-5 w-5 ${isWishlisted ? 'fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400' : ''}`} />
              </motion.button>
            )}
          </div>

          {/* Allowed payment methods */}
          <div className="pt-4 border-t border-[var(--border)] text-xs text-[var(--ink-muted)]">
            <span className="font-semibold">{t.product.allowedPays} </span>
            <span>
              {effectivePays.map((p) => t.payLabels[p]).join(' · ')}
            </span>
          </div>
        </div>
      </div>

      {/* 5-Star Ratings & Customer Reviews Section */}
      <section id="product-reviews" className="space-y-6">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
          </span>
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[var(--ink)]">
            {t.product.reviewsTitle}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Summary & 5-Star Distribution Card */}
          <div className="lg:col-span-5 space-y-5">
            <div className="liquid-glass rounded-[24px] p-6 space-y-5 border border-[var(--border)]">
              <div className="flex items-center gap-5">
                <div className="text-center shrink-0">
                  <div className="num text-4xl font-black text-[#0B2D5B] dark:text-[#FF6B86]">
                    {reviewsData.totalReviews > 0 ? displayAvg : '0.0'}
                  </div>
                  <div className="mt-1">
                    <StarRow rating={reviewsData.averageRating} size="md" />
                  </div>
                  <p className="mt-1.5 text-[11px] font-bold text-[var(--ink-muted)]">
                    {t.product.basedOn} <span className="num">{reviewsData.totalReviews}</span>{' '}
                    {t.product.reviewsCountSuffix}
                  </p>
                </div>

                <div className="flex-1 space-y-1.5">
                  {[5, 4, 3, 2, 1].map((star) => {
                    const count = reviewsData.distribution[star] || 0;
                    const pct =
                      reviewsData.totalReviews > 0
                        ? Math.round((count / reviewsData.totalReviews) * 100)
                        : 0;
                    return (
                      <div key={star} className="flex items-center gap-2 text-xs">
                        <span className="num w-7 font-bold text-[var(--ink)] flex items-center gap-0.5 shrink-0" dir="ltr">
                          {star}
                          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                        </span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--surface-alt)]">
                          <div
                            className="h-full rounded-full bg-amber-400 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="num w-7 text-end text-[11px] font-bold text-[var(--ink-muted)]">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Write a Review Form */}
            <form
              onSubmit={handleSubmitReview}
              className="liquid-glass rounded-[24px] p-6 space-y-4 border border-[var(--border)]"
            >
              <h3 className="font-display text-base font-extrabold text-[var(--ink)]">
                {t.product.writeReview}
              </h3>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-[var(--ink-muted)]">
                  {t.product.yourRating}
                </label>
                <div className="flex items-center gap-1.5" dir="ltr">
                  {[1, 2, 3, 4, 5].map((star) => {
                    const active = star <= (hoverRating || ratingInput);
                    return (
                      <button
                        key={star}
                        type="button"
                        aria-label={`${star} / 5`}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(0)}
                        onClick={() => setRatingInput(star)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                      >
                        <Star
                          className={`h-5 w-5 ${
                            active
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-300 dark:text-white/25'
                          }`}
                        />
                      </button>
                    );
                  })}
                  <span className="num ms-2 text-xs font-extrabold text-[var(--ink)]">
                    {ratingInput} / 5
                  </span>
                </div>
              </div>

              <label className="block space-y-1">
                <span className="text-xs font-bold text-[var(--ink-muted)]">
                  {t.product.yourName}
                </span>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={80}
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder={lang === 'fr' ? 'Ex : Mohamed A.' : 'مثال: أمين ب.'}
                  className="apple-input h-11 w-full rounded-xl px-3.5 text-sm text-[var(--ink)]"
                />
              </label>

              <label className="block space-y-1">
                <span className="text-xs font-bold text-[var(--ink-muted)]">
                  {t.product.yourComment}
                </span>
                <textarea
                  rows={3}
                  maxLength={600}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={
                    lang === 'fr'
                      ? 'Partagez votre expérience avec ce produit...'
                      : 'شاركنا رأيك حول جودة المنتج أو سرعة التفعيل...'
                  }
                  className="apple-input w-full rounded-xl p-3 text-sm text-[var(--ink)] resize-none"
                />
              </label>

              {reviewError && (
                <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs font-bold text-rose-600 dark:text-rose-300">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{reviewError}</span>
                </div>
              )}

              {reviewSuccess && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-500/12 border border-emerald-500/30 p-3 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{t.product.reviewSuccess}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submittingReview}
                className="apple-btn-primary inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl px-5 text-sm font-extrabold disabled:opacity-55 cursor-pointer"
              >
                <Send className="h-4 w-4" />
                <span>{submittingReview ? t.product.submitting : t.product.submitReview}</span>
              </button>
            </form>
          </div>

          {/* Reviews List */}
          <div className="lg:col-span-7 space-y-3.5">
            {reviewsLoading ? (
              <div className="liquid-glass rounded-[24px] p-8 text-center text-sm text-[var(--ink-muted)]">
                ...
              </div>
            ) : reviewsData.reviews.length === 0 ? (
              <div className="liquid-glass rounded-[24px] p-10 text-center space-y-3 border border-[var(--border)]">
                <MessageSquare className="h-9 w-9 mx-auto text-[var(--ink-muted)] opacity-50" />
                <p className="text-sm font-bold text-[var(--ink-muted)]">
                  {t.product.noReviews}
                </p>
              </div>
            ) : (
              reviewsData.reviews.map((rev) => (
                <div
                  key={rev.id}
                  className="liquid-glass rounded-[22px] p-5 space-y-2.5 border border-[var(--border)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#0B2D5B]/12 dark:bg-white/10 text-[#0B2D5B] dark:text-[#FF6B86]">
                        <User className="h-4 w-4" />
                      </span>
                      <div>
                        <p dir="auto" className="font-display text-sm font-extrabold text-[var(--ink)]">
                          {rev.authorName}
                        </p>
                        <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {t.product.verifiedBuyer}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <StarRow rating={rev.rating} size="sm" />
                      <span className="num text-[11px] text-[var(--ink-muted)]">
                        {rev.createdAt.slice(0, 10)}
                      </span>
                    </div>
                  </div>
                  {rev.comment && (
                    <p dir="auto" className="text-sm leading-relaxed text-[var(--ink-muted)] whitespace-pre-line">
                      {rev.comment}
                    </p>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Similar Products */}
      {similar.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-[var(--ink)]">
            {t.product.similar}
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {similar.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onOpenProduct(p)}
                className="group liquid-glass apple-sheen rounded-[22px] p-3 text-start transition-all duration-300 hover:-translate-y-1 cursor-pointer"
              >
                <div className="aspect-[4/3] w-full overflow-hidden rounded-[15px] bg-[var(--surface-alt)]">
                  {p.img ? (
                    <img
                      src={p.img}
                      alt={p.name[lang] || p.name.ar}
                      referrerPolicy="no-referrer"
                      className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                    />
                  ) : (
                    <ServiceSvgIllustration cat={p.cat} />
                  )}
                </div>
                <h3 className="mt-2.5 font-display text-sm font-bold text-[var(--ink)] line-clamp-1">
                  {p.name[lang] || p.name.ar}
                </h3>
                <p className="num mt-1 text-sm font-extrabold text-[#0B2D5B] dark:text-[#FF6B86]">
                  {formatPriceDzd(p.price, lang)}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}
      <AnimatePresence>
        {zoomOpen && product.img && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#07142B]/80 backdrop-blur-xl p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => setZoomOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 360, damping: 32 }}
              className="relative max-h-[90vh] max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setZoomOpen(false)}
                aria-label={t.gallery.close}
                className="liquid-glass-pill absolute -top-13 end-0 inline-flex h-10 w-10 items-center justify-center rounded-full text-white cursor-pointer active:scale-90"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={product.img}
                alt={product.name[lang] || product.name.ar}
                referrerPolicy="no-referrer"
                className="max-h-[82vh] w-auto rounded-[22px] object-contain shadow-[0_28px_72px_rgba(0,0,0,0.55)] border border-white/20"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
