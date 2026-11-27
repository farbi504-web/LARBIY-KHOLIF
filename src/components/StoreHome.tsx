import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Clock, CreditCard, MapPin, Pause, Play, Volume2, VolumeX, X, ZoomIn } from 'lucide-react';
import { TX } from '../shared/i18n.ts';
import {
  DEFAULT_CATEGORIES,
  buildVerifiedTrustHighlights,
  groupCategories,
} from '../shared/categories.ts';
import type { CategoryId, CategoryItem, Lang, Product, PublicSettings } from '../shared/types.ts';
import { ServiceSvgIllustration } from './ServiceArtwork.tsx';
import { LazyImage } from './LazyImage.tsx';
import { ProductCard } from './ProductCard.tsx';

interface StoreHomeProps {
  lang: Lang;
  settings: PublicSettings;
  categories?: CategoryItem[];
  products: Product[];
  wishlistIds?: string[];
  onExploreCategory: (cat: CategoryId) => void;
  onGoShop: (initialSearch?: string) => void;
  onGoTrack?: () => void;
  onGoContact?: () => void;
  onOpenProduct: (product: Product) => void;
  onAddToCart: (product: Product) => void;
  onToggleWishlist?: (product: Product) => void;
}

export function StoreHome({
  lang,
  settings,
  categories = DEFAULT_CATEGORIES,
  products,
  wishlistIds = [],
  onExploreCategory,
  onGoShop,
  onGoTrack,
  onGoContact,
  onOpenProduct,
  onAddToCart,
  onToggleWishlist,
}: StoreHomeProps) {
  const t = TX[lang];
  const ArrowIcon = lang === 'ar' ? ArrowLeft : ArrowRight;
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);


  const activeCategories = (categories.length ? categories : DEFAULT_CATEGORIES).filter(
    (c) => c.active,
  );
  const { retail: retailCategories, digital: digitalCategories } = groupCategories(activeCategories);

  const popular = [...products]
    .sort((a, b) => Number(b.featured) - Number(a.featured) || b.salesCount - a.salesCount)
    .slice(0, 6);

  const trustHighlights = buildVerifiedTrustHighlights(settings, lang);

  const galleryImages = [settings.facade, settings.facade2, settings.in1, ...(settings.gallery || [])].filter(
    (u): u is string => Boolean(u && u.trim()),
  );
  const hasGallery = galleryImages.length > 0 || Boolean(settings.vid);

  const heroImage =
    settings.facade || '/src/assets/images/hero_bookstore_editorial_1795529055490.jpg';
  const storyImage =
    settings.in1 || '/src/assets/images/story_bookstore_shelf_1795529056424.jpg';

  function resolveCategoryImg(cat: CategoryItem): string {
    const legacySlot =
      cat.id === 'shop'
        ? settings.svc_shop
        : cat.id === 'subs'
          ? settings.svc_subs
          : cat.id === 'games'
            ? settings.svc_games
            : cat.id === 'bills'
              ? settings.svc_bills
              : '';
    return cat.img || legacySlot;
  }

  return (
    <div className="w-full bg-[var(--bg)]">
      {/* Cinematic Full-Width Video Showcase Banner */}
      {settings.vid && (
        <section className="relative w-full bg-black border-b border-[var(--border)] overflow-hidden">
          <motion.video
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            src={settings.vid}
            autoPlay
            muted
            loop
            playsInline
            className="w-full h-[350px] sm:h-[500px] lg:h-[650px] object-cover"
          />
        </section>
      )}

      {/* 1. Editorial Split Hero — Multi-Category Retail & Digital Storefront */}
      <section className="border-b border-[var(--border)] bg-[var(--surface)]">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div className="space-y-3.5">
                <p className="text-xs sm:text-sm font-semibold text-[var(--crimson)]">
                  {t.hero.kicker}
                </p>
                <h1 className="font-display text-[clamp(1.85rem,3.4vw,2.95rem)] font-extrabold tracking-tight text-[var(--ink)] leading-[1.18]">
                  {t.hero.title}
                </h1>
                <p className="max-w-xl text-sm sm:text-base leading-relaxed text-[var(--ink-muted)]">
                  {t.hero.subtitle}
                </p>
              </div>

              {/* Action Row */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                <button
                  type="button"
                  onClick={() => onGoShop()}
                  className="apple-btn-primary inline-flex h-11 sm:h-12 items-center gap-2 rounded-lg px-5 text-sm font-bold cursor-pointer whitespace-nowrap"
                >
                  <span>{t.hero.ctaShop}</span>
                  <ArrowIcon className="h-4 w-4" />
                </button>

                {onGoTrack && (
                  <button
                    type="button"
                    onClick={onGoTrack}
                    className="inline-flex h-11 sm:h-12 items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-4 sm:px-5 text-sm font-bold text-[var(--ink)] hover:border-[var(--ink)]/35 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <span>{t.hero.ctaTrack}</span>
                  </button>
                )}

                {onGoContact && (
                  <button
                    type="button"
                    onClick={onGoContact}
                    className="inline-flex h-11 sm:h-12 items-center px-2 text-sm font-semibold text-[var(--ink-muted)] hover:text-[var(--crimson)] transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {t.hero.ctaVisit}
                  </button>
                )}
              </div>

              {/* Verified Store Facts from Configurable Settings */}
              <div className="pt-3 border-t border-[var(--border)] flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-[var(--ink-muted)]">
                {settings.address[lang] && <span>{settings.address[lang]}</span>}
                {settings.address[lang] && settings.workingHours[lang] && (
                  <span aria-hidden="true">·</span>
                )}
                {settings.workingHours[lang] && <span>{settings.workingHours[lang]}</span>}
                {settings.phone && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span dir="ltr" className="num font-semibold text-[var(--ink)]">
                      {settings.phone}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Editorial Store Photography Showcase */}
            <div className="lg:col-span-6 flex flex-col space-y-3">
              <div className="relative aspect-[16/10] lg:aspect-auto lg:h-[390px] w-full overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-alt)] shadow-lg">
                <img
                  src={heroImage}
                  alt={settings.storeName[lang] || t.brand}
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 sm:py-16 space-y-16 sm:space-y-20 pb-24 md:pb-16">
        {/* 2. Fast Multi-Category Discovery (Physical Retail + Digital Services) */}
        <section className="space-y-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-[var(--border)] pb-4">
            <div>
              <h2 className="font-display text-2xl sm:text-[1.75rem] font-extrabold text-[var(--ink)]">
                {t.services.title}
              </h2>
              <p className="mt-1 text-sm text-[var(--ink-muted)]">{t.services.subtitle}</p>
            </div>
            <button
              type="button"
              onClick={() => onGoShop()}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[var(--crimson)] hover:underline cursor-pointer whitespace-nowrap self-start sm:self-auto"
            >
              <span>{t.popular.viewAll}</span>
              <ArrowIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Group 1: Physical Retail Categories */}
          {retailCategories.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                    {t.services.groups.retail}
                  </h3>
                  <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
                    {t.services.groups.retailDesc}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
                {retailCategories.map((svc) => {
                  const title = (svc.name[lang] || svc.name.ar || svc.name.fr || svc.id).trim();
                  const desc = (svc.desc[lang] || svc.desc.ar || svc.desc.fr || '').trim();
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => onExploreCategory(svc.id)}
                      className="group liquid-glass flex flex-col overflow-hidden rounded-xl text-start hover:-translate-y-0.5 cursor-pointer"
                    >
                      <div className="aspect-[4/3] w-full overflow-hidden bg-[var(--surface-alt)] border-b border-[var(--border)]">
                        <ServiceSvgIllustration
                          cat={svc.id}
                          customImg={resolveCategoryImg(svc)}
                          className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                        />
                      </div>

                      <div className="flex-1 p-4 space-y-1.5">
                        <h4 className="font-display text-sm sm:text-base font-bold text-[var(--ink)] group-hover:text-[var(--crimson)] transition-colors">
                          {title}
                        </h4>
                        <p className="text-xs leading-relaxed text-[var(--ink-muted)] line-clamp-2">
                          {desc}
                        </p>
                      </div>

                      <div className="px-4 pb-4 pt-1 flex items-center gap-1.5 text-xs font-bold text-[var(--ink)] group-hover:text-[var(--crimson)] transition-colors">
                        <span>{t.services.explore}</span>
                        <ArrowIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Group 2: Digital Services */}
          {digitalCategories.length > 0 && (
            <div className="space-y-4">
              <div>
                <h3 className="font-display text-lg font-extrabold text-[var(--ink)]">
                  {t.services.groups.digital}
                </h3>
                <p className="text-xs sm:text-sm text-[var(--ink-muted)]">
                  {t.services.groups.digitalDesc}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {digitalCategories.map((svc) => {
                  const title = (svc.name[lang] || svc.name.ar || svc.name.fr || svc.id).trim();
                  const desc = (svc.desc[lang] || svc.desc.ar || svc.desc.fr || '').trim();
                  return (
                    <button
                      key={svc.id}
                      type="button"
                      onClick={() => onExploreCategory(svc.id)}
                      className="group liquid-glass grid grid-cols-1 sm:grid-cols-12 overflow-hidden rounded-xl text-start hover:-translate-y-0.5 cursor-pointer"
                    >
                      <div className="sm:col-span-5 aspect-[4/3] sm:aspect-auto sm:h-full overflow-hidden bg-[var(--surface-alt)] border-b sm:border-b-0 sm:border-e border-[var(--border)]">
                        <ServiceSvgIllustration
                          cat={svc.id}
                          customImg={resolveCategoryImg(svc)}
                          className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]"
                        />
                      </div>

                      <div className="sm:col-span-7 p-5 flex flex-col justify-between gap-4">
                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-[var(--crimson)]">
                            {t.catalog.digital}
                          </p>
                          <h4 className="font-display text-base sm:text-lg font-bold text-[var(--ink)] group-hover:text-[var(--crimson)] transition-colors">
                            {title}
                          </h4>
                          <p className="text-xs sm:text-sm leading-relaxed text-[var(--ink-muted)] line-clamp-2">
                            {desc}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--ink)] group-hover:text-[var(--crimson)] transition-colors">
                          <span>{t.services.explore}</span>
                          <ArrowIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-1 rtl:group-hover:-translate-x-1" />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* 3. Featured Products & Services Grid (Shared ProductCard) */}
        {popular.length > 0 && (
          <section className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div>
                <h2 className="font-display text-2xl sm:text-[1.75rem] font-extrabold text-[var(--ink)]">
                  {t.popular.title}
                </h2>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">{t.popular.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => onGoShop()}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 text-xs sm:text-sm font-bold text-[var(--ink)] hover:border-[var(--ink)]/35 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>{t.popular.viewAll}</span>
                <ArrowIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {popular.map((prod) => (
                <ProductCard
                  key={prod.id}
                  lang={lang}
                  product={prod}
                  categories={categories}
                  isSaved={wishlistIds.includes(prod.id)}
                  onOpen={onOpenProduct}
                  onAddToCart={onAddToCart}
                  onToggleWishlist={onToggleWishlist}
                />
              ))}
            </div>
          </section>
        )}

        {/* 4. Store Story, Verified Settings Info & Real Gallery */}
        <section className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch rounded-2xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
            <div className="lg:col-span-5 aspect-[4/3] lg:aspect-auto bg-[var(--surface-alt)]">
              <img
                src={storyImage}
                alt={t.gallery.title}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            </div>

            <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-between space-y-8">
              <div className="space-y-2.5">
                <p className="text-xs font-bold text-[var(--crimson)]">
                  {settings.storeName[lang] || t.brand}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold text-[var(--ink)]">
                  {t.trust.title}
                </h2>
                <p className="text-sm text-[var(--ink-muted)] leading-relaxed max-w-2xl">
                  {[settings.address[lang], settings.workingHours[lang]].filter(Boolean).join(' — ')}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-6 border-t border-[var(--border)]">
                {trustHighlights.map((item) => {
                  const Icon =
                    item.id === 'store'
                      ? MapPin
                      : item.id === 'hours'
                        ? Clock
                        : CreditCard;
                  return (
                    <div key={item.id} className="space-y-1.5">
                      <Icon className="h-4 w-4 text-[var(--crimson)]" aria-hidden="true" />
                      <h3 className="font-display text-sm font-bold text-[var(--ink)]">
                        {item.title}
                      </h3>
                      <p className="text-xs text-[var(--ink-muted)] leading-relaxed">
                        {item.desc}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {hasGallery && (
            <div className="space-y-5">
              <div className="border-b border-[var(--border)] pb-3">
                <h3 className="font-display text-xl font-extrabold text-[var(--ink)]">
                  {t.gallery.title}
                </h3>
                <p className="mt-1 text-sm text-[var(--ink-muted)]">{t.gallery.subtitle}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {settings.vid && (
                  <div className="lg:col-span-6 liquid-glass overflow-hidden rounded-xl p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-bold text-[var(--ink-muted)]">
                      <Play className="h-4 w-4 text-[var(--crimson)]" />
                      <span>{t.gallery.videoTitle}</span>
                    </div>
                    <video
                      src={settings.vid}
                      controls
                      playsInline
                      preload="metadata"
                      className="aspect-video w-full rounded-lg bg-[#111318] object-cover"
                    />
                  </div>
                )}

                {galleryImages.length > 0 && (
                  <div
                    className={`grid grid-cols-2 sm:grid-cols-3 gap-4 ${
                      settings.vid ? 'lg:col-span-6' : 'lg:col-span-12 sm:grid-cols-4'
                    }`}
                  >
                    {galleryImages.map((imgUrl, idx) => (
                      <button
                        key={`${imgUrl}-${idx}`}
                        type="button"
                        onClick={() => setLightboxUrl(imgUrl)}
                        className="group liquid-glass relative aspect-square overflow-hidden rounded-xl cursor-pointer"
                        aria-label={t.gallery.zoomHint}
                      >
                        <LazyImage
                          src={imgUrl}
                          alt={`${t.gallery.title} ${idx + 1}`}
                          className="aspect-square w-full overflow-hidden bg-[var(--surface-alt)]"
                          imgClassName="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105"
                        />
                        <span className="absolute bottom-2.5 end-2.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#111318]/80 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                          <ZoomIn className="h-4 w-4" />
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            role="dialog"
            aria-modal="true"
            onClick={() => setLightboxUrl(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              className="relative max-h-[90vh] max-w-4xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setLightboxUrl(null)}
                aria-label={t.gallery.close}
                className="absolute -top-12 end-0 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-white/15 text-white hover:bg-white/25 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
              <img
                src={lightboxUrl}
                alt={t.gallery.title}
                referrerPolicy="no-referrer"
                className="max-h-[82vh] w-auto rounded-xl object-contain border border-white/15"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
