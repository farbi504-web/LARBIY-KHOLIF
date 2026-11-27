import React, { useEffect, useState } from 'react';
import { ArrowUpLeft, ArrowUpRight, Megaphone, X } from 'lucide-react';
import type { AnnouncementConfig, Lang, LocalizedText } from '../shared/types.ts';

interface AnnouncementBarProps {
  lang: Lang;
  announcement: LocalizedText;
  config?: AnnouncementConfig;
  onNavigate?: (view: 'shop' | 'track' | 'contact') => void;
  preview?: boolean;
}

const TONE_CLASSES: Record<AnnouncementConfig['tone'], string> = {
  navy: 'bg-[#111318] text-[#FFFFFF] border-[#D7193F]',
  crimson: 'bg-[#D7193F] text-[#FFFFFF] border-black/15',
  emerald: 'bg-[#065F46] text-[#FFFFFF] border-emerald-300/35',
  amber: 'bg-[#B45309] text-[#FFFFFF] border-amber-200/35',
};

const ICON_CLASSES: Record<AnnouncementConfig['tone'], string> = {
  navy: 'text-[#E83556]',
  crimson: 'text-white',
  emerald: 'text-emerald-200',
  amber: 'text-amber-100',
};

export function AnnouncementBar({
  lang,
  announcement,
  config,
  onNavigate,
  preview = false,
}: AnnouncementBarProps) {
  const text = (announcement?.[lang] || announcement?.ar || announcement?.fr || '').trim();
  const enabled = config?.enabled !== undefined ? config.enabled : true;
  const tone: AnnouncementConfig['tone'] = config?.tone || 'navy';
  const mode: AnnouncementConfig['mode'] = config?.mode || 'ticker';
  const speed: AnnouncementConfig['speed'] = config?.speed || 'normal';
  const dismissible = Boolean(config?.dismissible);
  const ctaTarget = config?.ctaTarget || '';
  const ctaText = (config?.ctaLabel?.[lang] || config?.ctaLabel?.ar || config?.ctaLabel?.fr || '').trim();

  const [dismissedText, setDismissedText] = useState<string | null>(null);

  useEffect(() => {
    if (!preview && dismissedText && dismissedText !== text) {
      setDismissedText(null);
    }
  }, [text, dismissedText, preview]);

  if (!text || (!preview && (!enabled || dismissedText === text))) {
    return null;
  }

  const speedClass =
    speed === 'slow'
      ? 'slimi-ticker-slow'
      : speed === 'fast'
        ? 'slimi-ticker-fast'
        : '';

  const defaultCtaLabel =
    ctaTarget === 'shop'
      ? lang === 'fr'
        ? 'Boutique'
        : 'تصفح المتجر'
      : ctaTarget === 'track'
        ? lang === 'fr'
          ? 'Suivre'
          : 'تتبع طلبك'
        : ctaTarget === 'contact'
          ? lang === 'fr'
            ? 'Contact'
            : 'تواصل معنا'
          : '';

  const resolvedCta = ctaText || defaultCtaLabel;

  return (
    <div
      role="region"
      aria-label={lang === 'fr' ? 'Annonce' : 'إعلان المتجر'}
      className={`group relative z-40 h-8 sm:h-9 w-full border-b overflow-hidden transition-colors ${TONE_CLASSES[tone]} ${
        preview && !enabled ? 'opacity-50' : ''
      }`}
    >
      <div className="mx-auto flex h-full max-w-6xl items-center gap-2 sm:gap-3 px-3 sm:px-6">
        <span className={`inline-flex shrink-0 items-center justify-center ${ICON_CLASSES[tone]}`} aria-hidden="true">
          <Megaphone className="h-3.5 w-3.5" />
        </span>

        {mode === 'static' ? (
          <div className="flex-1 min-w-0 flex items-center justify-center text-center">
            <p className="truncate text-xs sm:text-[13px] font-bold">{text}</p>
          </div>
        ) : (
          <div dir="ltr" className="slimi-ticker relative flex-1 overflow-hidden whitespace-nowrap select-none">
            <div
              className={`slimi-ticker-track ${
                lang === 'ar' ? 'slimi-ticker-dir-rtl' : 'slimi-ticker-dir-ltr'
              } ${speedClass} items-center text-xs sm:text-[13px] font-bold`}
            >
              {[0, 1].map((copyIdx) => (
                <div
                  key={copyIdx}
                  aria-hidden={copyIdx === 1}
                  className="flex shrink-0 items-center"
                >
                  {[0, 1, 2].map((repeatIdx) => (
                    <span
                      key={repeatIdx}
                      className="inline-flex items-center pe-12"
                    >
                      <span dir={lang === 'ar' ? 'rtl' : 'ltr'}>{text}</span>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {ctaTarget && resolvedCta && (
          <button
            type="button"
            onClick={() => onNavigate?.(ctaTarget)}
            className="inline-flex h-6 sm:h-7 shrink-0 items-center gap-1 rounded-md border border-white/25 bg-white/12 hover:bg-white/20 px-2.5 text-[11px] font-bold text-white transition-colors cursor-pointer"
          >
            <span>{resolvedCta}</span>
            {lang === 'ar' ? (
              <ArrowUpLeft className="h-3 w-3 shrink-0" />
            ) : (
              <ArrowUpRight className="h-3 w-3 shrink-0" />
            )}
          </button>
        )}

        {dismissible && !preview && (
          <button
            type="button"
            onClick={() => setDismissedText(text)}
            aria-label={lang === 'fr' ? 'Fermer l’annonce' : 'إغلاق الإعلان'}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white active:scale-90 transition-all cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
