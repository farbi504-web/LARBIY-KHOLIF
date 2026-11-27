import React, { useEffect, useRef, useState } from 'react';

interface LazyImageProps {
  src?: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallback?: React.ReactNode;
  referrerPolicy?: React.HTMLAttributeReferrerPolicy;
}

export function LazyImage({
  src,
  alt,
  className = 'aspect-[4/3] w-full overflow-hidden rounded-[17px] bg-[var(--surface-alt)]',
  imgClassName = 'h-full w-full object-cover',
  fallback,
  referrerPolicy = 'no-referrer',
}: LazyImageProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) {
      setInView(true);
      return;
    }

    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            setInView(true);
            observer.unobserve(el);
          }
        });
      },
      { rootMargin: '250px' },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
    };
  }, []);

  if (!src || error) {
    return <div className={className}>{fallback}</div>;
  }

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`}>
      {/* Blurred / Pulse placeholder while loading */}
      {!loaded && (
        <div className="absolute inset-0 z-10 animate-pulse bg-[var(--surface-alt)] backdrop-blur-xl transition-opacity duration-300" />
      )}

      {inView && (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          referrerPolicy={referrerPolicy}
          onLoad={() => setLoaded(true)}
          onError={() => setError(true)}
          className={`${imgClassName} transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            loaded ? 'opacity-100 blur-0 scale-100' : 'opacity-0 blur-md scale-95'
          }`}
        />
      )}
    </div>
  );
}
