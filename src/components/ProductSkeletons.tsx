import React from 'react';
import { motion } from 'motion/react';

interface SkeletonPulseProps {
  className?: string;
  delay?: number;
}

function SkeletonPulse({ className = '', delay = 0 }: SkeletonPulseProps) {
  return (
    <motion.div
      aria-hidden="true"
      initial={{ opacity: 0.48 }}
      animate={{ opacity: [0.48, 0.88, 0.48] }}
      transition={{
        duration: 1.45,
        repeat: Infinity,
        ease: 'easeInOut',
        delay,
      }}
      className={`relative overflow-hidden bg-[var(--surface-alt)] ${className}`}
    >
      <motion.div
        initial={{ x: '-100%' }}
        animate={{ x: '100%' }}
        transition={{
          duration: 1.6,
          repeat: Infinity,
          ease: 'linear',
          delay,
        }}
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/35 to-transparent dark:via-white/10"
      />
    </motion.div>
  );
}

export function CatalogCardSkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      {/* Results count row placeholder matching loaded height */}
      <div className="flex items-center justify-between">
        <SkeletonPulse className="h-4 w-28 rounded-md" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {Array.from({ length: count }, (_, idx) => {
          const delay = (idx % 3) * 0.12;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.03 }}
              className="liquid-glass relative flex flex-col justify-between overflow-hidden rounded-[24px] p-3.5"
            >
              {/* Wishlist button silhouette */}
              <SkeletonPulse
                delay={delay}
                className="absolute top-5 end-5 z-10 h-9 w-9 rounded-full border border-white/30"
              />

              <div>
                {/* 4:3 Image frame */}
                <SkeletonPulse delay={delay} className="aspect-[4/3] w-full rounded-[17px]" />

                {/* Category kicker + 2-line title */}
                <div className="mt-3.5 space-y-2 px-0.5">
                  <SkeletonPulse delay={delay + 0.05} className="h-3.5 w-3/5 rounded" />
                  <SkeletonPulse delay={delay + 0.1} className="h-4 w-full rounded" />
                  <SkeletonPulse delay={delay + 0.12} className="h-4 w-2/3 rounded" />
                </div>
              </div>

              {/* Price + CTA footer matching loaded layout */}
              <div className="mt-3.5 mx-0.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-3 border-t border-[var(--border)]/70">
                <div className="space-y-1.5">
                  <SkeletonPulse delay={delay + 0.14} className="h-5 w-20 rounded" />
                  <SkeletonPulse delay={delay + 0.16} className="h-3 w-14 rounded" />
                </div>
                <SkeletonPulse delay={delay + 0.18} className="h-10 w-full sm:w-28 rounded-xl" />
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export function ProductDetailSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      className="space-y-12 pb-8"
      aria-busy="true"
      aria-live="polite"
    >
      {/* Back button placeholder */}
      <SkeletonPulse className="h-11 w-40 rounded-full border border-[var(--border)]" />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Product Image Card */}
        <div className="lg:col-span-6 liquid-glass overflow-hidden rounded-[28px] p-3.5 sm:p-4">
          <SkeletonPulse className="aspect-[4/3] w-full rounded-[20px]" />
        </div>

        {/* Purchase Module */}
        <div className="lg:col-span-6 liquid-glass rounded-[28px] p-6 sm:p-8 space-y-6">
          <div className="space-y-2.5">
            <SkeletonPulse delay={0.05} className="h-3.5 w-52 rounded" />
            <SkeletonPulse delay={0.08} className="h-8 sm:h-9 w-4/5 rounded-md" />
          </div>

          <div className="flex items-baseline gap-3">
            <SkeletonPulse delay={0.1} className="h-9 w-36 rounded-md" />
            <SkeletonPulse delay={0.12} className="h-5 w-20 rounded" />
          </div>

          <div className="space-y-2">
            <SkeletonPulse delay={0.14} className="h-4 w-full rounded" />
            <SkeletonPulse delay={0.16} className="h-4 w-11/12 rounded" />
            <SkeletonPulse delay={0.18} className="h-4 w-3/4 rounded" />
          </div>

          {/* Plan Selector Grid */}
          <div className="space-y-2.5">
            <SkeletonPulse delay={0.2} className="h-4 w-36 rounded" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {[0, 1, 2].map((i) => (
                <SkeletonPulse
                  key={i}
                  delay={0.22 + i * 0.05}
                  className="h-16 w-full rounded-xl border border-[var(--border)]"
                />
              ))}
            </div>
          </div>

          {/* Quantity + Add to Cart + Wishlist */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <SkeletonPulse delay={0.25} className="h-12 w-32 rounded-xl border border-[var(--border)]" />
            <SkeletonPulse delay={0.28} className="h-12 flex-1 min-w-[180px] rounded-xl" />
            <SkeletonPulse delay={0.3} className="h-12 w-12 shrink-0 rounded-xl border border-[var(--border)]" />
          </div>

          {/* Allowed payment methods footer */}
          <div className="pt-4 border-t border-[var(--border)]">
            <SkeletonPulse delay={0.32} className="h-3.5 w-60 rounded" />
          </div>
        </div>
      </div>

      {/* Similar Products Skeleton */}
      <section className="space-y-4">
        <SkeletonPulse delay={0.15} className="h-7 w-48 rounded-md" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="liquid-glass rounded-2xl p-3 space-y-2.5">
              <SkeletonPulse delay={0.18 + i * 0.06} className="aspect-[4/3] w-full rounded-xl" />
              <SkeletonPulse delay={0.2 + i * 0.06} className="h-4 w-4/5 rounded" />
              <SkeletonPulse delay={0.22 + i * 0.06} className="h-4 w-2/5 rounded" />
            </div>
          ))}
        </div>
      </section>
    </motion.div>
  );
}
