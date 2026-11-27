import React from 'react';
import { MessageCircle } from 'lucide-react';
import { TX } from '../shared/i18n.ts';
import { normalizeAlgerianPhone } from '../shared/commerce.ts';
import type { Lang, PublicSettings } from '../shared/types.ts';

interface FloatingActionButtonProps {
  lang: Lang;
  settings: PublicSettings;
}

export function FloatingActionButton({ lang, settings }: FloatingActionButtonProps) {
  const t = TX[lang];
  const rawWhatsapp = settings.whatsapp || settings.phone || '213772827262';
  const normalized = normalizeAlgerianPhone(rawWhatsapp) || '213772827262';
  const href = `https://wa.me/${encodeURIComponent(normalized)}?text=${encodeURIComponent(t.contact.whatsappPrefill)}`;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t.contact.chatWhatsapp}
      title={t.contact.chatWhatsapp}
      className="fixed bottom-18 md:bottom-6 end-4 z-40 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[#15803D] px-3.5 sm:px-4 text-sm font-bold text-white border border-black/10 shadow-md hover:bg-[#166534] transition-colors"
    >
      <MessageCircle className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
      <span className="hidden sm:inline whitespace-nowrap">{t.contact.chatWhatsapp}</span>
    </a>
  );
}
