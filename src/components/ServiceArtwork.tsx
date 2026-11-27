import React from 'react';
import type { CategoryId } from '../shared/types.ts';

export function SlimiLogoMark({
  logoUrl,
  size = 38,
  variant = 'auto',
  className = '',
}: {
  logoUrl?: string;
  size?: number;
  variant?: 'auto' | 'dark' | 'light';
  className?: string;
}) {
  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt="Librairie Slimi"
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        className={`rounded-lg object-cover border border-[var(--border)] bg-[#FFFFFF] dark:bg-[#15171D] shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  const pageWingClass =
    variant === 'dark'
      ? 'fill-[#FFFFFF]'
      : variant === 'light'
        ? 'fill-[#111318]'
        : 'fill-[#111318] dark:fill-[#FFFFFF]';

  const lowerRightClass =
    variant === 'dark'
      ? 'fill-[#1E2129]'
      : variant === 'light'
        ? 'fill-[#111318]'
        : 'fill-[#111318] dark:fill-[#1E2129]';

  const containerClass =
    variant === 'dark'
      ? 'bg-[#15171D] border-white/15'
      : variant === 'light'
        ? 'bg-[#FFFFFF] border-[var(--border)]'
        : 'bg-[#FFFFFF] dark:bg-[#15171D] border-[var(--border)]';

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl border ${containerClass} ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 120 120"
        fill="none"
        className="h-[82%] w-[82%]"
        aria-hidden="true"
      >
        <path
          d="M16 26L23 29.5V88L60 105L97 88V29.5L104 26V92.5L60 112L16 92.5V26Z"
          fill="#D7193F"
        />
        <path d="M27 11L60 27L93 11V24L60 40L27 24V11Z" className={pageWingClass} />
        <path d="M27 83L60 99L93 83V70L60 86L27 70V83Z" className={pageWingClass} />
        <polygon points="27,28 53,40 27,52" fill="#8C1732" />
        <polygon points="27,53 54,66 27,77" fill="#74BFCF" />
        <polygon points="93,28 67,40 93,52" fill="#74BFCF" />
        <polygon points="93,53 66,66 93,77" className={lowerRightClass} />
        <path d="M27 32L93 62.5V74L27 44V32Z" fill="#D7193F" />
        <polygon points="48,59 60,64.5 48,70" fill="#FFFFFF" />
        <polygon points="72,41 60,46.5 72,52" fill="#FFFFFF" />
      </svg>
    </span>
  );
}

const CATEGORY_STUDIO_IMAGES: Record<string, string> = {
  books: '/src/assets/images/cat_books_editorial_1795531176077.jpg',
  shop: '/src/assets/images/cat_shop_stationery_v2_1795424961761.jpg',
  cosmetics: '/src/assets/images/cat_cosmetics_care_1795531176007.jpg',
  toys: '/src/assets/images/cat_toys_kids_v2_1795425777381.jpg',
  accessories: '/src/assets/images/cat_phone_accessories_v2_1795425777578.jpg',
  subs: '/src/assets/images/cat_subs_digital_v2_1795424961980.jpg',
  games: '/src/assets/images/cat_games_topup_v2_1795424961879.jpg',
  bills: '/src/assets/images/cat_bills_payment_v2_1795424962290.jpg',
};

export function ServiceSvgIllustration({
  cat,
  customImg,
  className = 'w-full h-full',
}: {
  cat: CategoryId;
  customImg?: string;
  className?: string;
}) {
  const [imgFailed, setImgFailed] = React.useState(false);
  const src = customImg || CATEGORY_STUDIO_IMAGES[cat] || '';

  if (src && !imgFailed) {
    return (
      <img
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setImgFailed(true)}
        className={`object-cover ${className}`}
      />
    );
  }

  if (cat === 'books') {
    return (
      <svg viewBox="0 0 280 180" fill="none" className={className} aria-hidden="true">
        <rect width="280" height="180" fill="#F5F6FA" className="dark:fill-[#15171D]" />
        <path d="M24 148H256" stroke="#111318" strokeOpacity="0.16" strokeWidth="1.5" />
        <rect x="64" y="42" width="46" height="106" rx="4" fill="#111318" />
        <rect x="70" y="54" width="34" height="8" rx="2" fill="#D7193F" />
        <rect x="114" y="30" width="48" height="118" rx="4" fill="#D7193F" />
        <rect x="122" y="44" width="32" height="6" rx="2" fill="#FFFFFF" fillOpacity="0.85" />
        <rect x="166" y="52" width="44" height="96" rx="4" fill="#74BFCF" />
        <rect x="174" y="64" width="28" height="5" rx="2" fill="#111318" fillOpacity="0.6" />
      </svg>
    );
  }

  if (cat === 'cosmetics') {
    return (
      <svg viewBox="0 0 280 180" fill="none" className={className} aria-hidden="true">
        <rect width="280" height="180" fill="#F5F6FA" className="dark:fill-[#15171D]" />
        <path d="M36 146H244" stroke="#111318" strokeOpacity="0.16" strokeWidth="1.5" />
        <rect x="78" y="68" width="48" height="78" rx="8" fill="#111318" />
        <rect x="92" y="44" width="20" height="24" rx="4" fill="#D7193F" />
        <rect x="140" y="96" width="62" height="50" rx="8" fill="#D7193F" />
        <rect x="140" y="86" width="62" height="12" rx="4" fill="#111318" />
      </svg>
    );
  }

  if (cat === 'shop') {
    return (
      <svg viewBox="0 0 280 180" fill="none" className={className} aria-hidden="true">
        <rect width="280" height="180" fill="#F5F6FA" className="dark:fill-[#0B2D5B]" />
        <path d="M24 148H256" stroke="#17243B" strokeOpacity="0.14" strokeWidth="1.5" />
        {/* Notebook */}
        <rect x="74" y="28" width="88" height="120" rx="6" fill="#0B2D5B" />
        <rect x="82" y="28" width="3" height="120" fill="#17243B" fillOpacity="0.45" />
        <rect x="98" y="48" width="48" height="14" rx="2" fill="#D7193F" />
        <rect x="98" y="72" width="40" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.8" />
        <rect x="98" y="82" width="30" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.55" />
        {/* Pen */}
        <g transform="translate(182 34) rotate(10)">
          <rect x="0" y="0" width="14" height="84" rx="3" fill="#17243B" />
          <rect x="0" y="16" width="14" height="6" fill="#D7193F" />
          <polygon points="0,84 14,84 7,104" fill="#D7193F" />
        </g>
        {/* Ruler */}
        <rect x="38" y="118" width="64" height="20" rx="3" fill="#74BFCF" />
        <path d="M48 118V125M58 118V123M68 118V125M78 118V123M88 118V125" stroke="#17243B" strokeWidth="1.5" />
      </svg>
    );
  }

  if (cat === 'toys') {
    return (
      <svg viewBox="0 0 280 180" fill="none" className={className} aria-hidden="true">
        <rect width="280" height="180" fill="#F5F6FA" className="dark:fill-[#0B2D5B]" />
        <rect x="64" y="96" width="52" height="52" rx="8" fill="#0B2D5B" />
        <rect x="124" y="96" width="52" height="52" rx="8" fill="#D7193F" />
        <rect x="94" y="40" width="52" height="52" rx="8" fill="#17243B" />
        <circle cx="198" cy="122" r="24" fill="#74BFCF" />
        <polygon points="198,54 222,94 174,94" fill="#D7193F" />
      </svg>
    );
  }

  if (cat === 'subs') {
    return (
      <svg viewBox="0 0 280 180" fill="none" className={className} aria-hidden="true">
        <rect width="280" height="180" fill="#F5F6FA" className="dark:fill-[#0B2D5B]" />
        <rect x="54" y="34" width="172" height="112" rx="10" fill="#17243B" />
        <rect x="54" y="34" width="172" height="24" rx="10" fill="#0B2D5B" />
        <rect x="54" y="48" width="172" height="10" fill="#0B2D5B" />
        <circle cx="72" cy="46" r="3" fill="#D7193F" />
        <circle cx="83" cy="46" r="3" fill="#74BFCF" />
        <rect x="74" y="76" width="34" height="34" rx="8" fill="#D7193F" />
        <path d="M87 86L99 93L87 100V86Z" fill="#FFFFFF" />
        <rect x="122" y="80" width="84" height="8" rx="3" fill="#FFFFFF" />
        <rect x="122" y="96" width="58" height="6" rx="3" fill="#74BFCF" />
        <rect x="74" y="124" width="132" height="5" rx="2.5" fill="#FFFFFF" fillOpacity="0.2" />
        <rect x="74" y="124" width="90" height="5" rx="2.5" fill="#D7193F" />
      </svg>
    );
  }

  if (cat === 'games') {
    return (
      <svg viewBox="0 0 280 180" fill="none" className={className} aria-hidden="true">
        <rect width="280" height="180" fill="#F5F6FA" className="dark:fill-[#0B2D5B]" />
        <path
          d="M84 54C72 54 62 63 60 75L53 113C50 126 60 137 73 137C81 137 89 132 93 125L101 112H179L187 125C191 132 199 137 207 137C220 137 230 126 227 113L220 75C218 63 208 54 196 54H84Z"
          fill="#17243B"
        />
        <path d="M98 76V96M88 86H108" stroke="#D7193F" strokeWidth="5.5" strokeLinecap="round" />
        <circle cx="178" cy="76" r="5" fill="#D7193F" />
        <circle cx="192" cy="86" r="5" fill="#74BFCF" />
        <circle cx="178" cy="96" r="5" fill="#FFFFFF" />
        <circle cx="164" cy="86" r="5" fill="#0B2D5B" />
        <rect x="126" y="83" width="28" height="5" rx="2.5" fill="#FFFFFF" fillOpacity="0.4" />
      </svg>
    );
  }

  if (cat === 'accessories') {
    return (
      <svg viewBox="0 0 280 180" fill="none" className={className} aria-hidden="true">
        <rect width="280" height="180" fill="#F5F6FA" className="dark:fill-[#0B2D5B]" />
        <rect x="86" y="24" width="66" height="132" rx="12" fill="#0B2D5B" />
        <rect x="94" y="34" width="50" height="112" rx="8" fill="#17243B" />
        <rect x="102" y="42" width="18" height="18" rx="4" fill="#FFFFFF" fillOpacity="0.2" />
        <rect x="142" y="72" width="48" height="68" rx="8" fill="#D7193F" />
        <rect x="152" y="82" width="28" height="4" rx="2" fill="#FFFFFF" fillOpacity="0.8" />
      </svg>
    );
  }

  if (cat === 'bills') {
    return (
      <svg viewBox="0 0 280 180" fill="none" className={className} aria-hidden="true">
        <rect width="280" height="180" fill="#F5F6FA" className="dark:fill-[#0B2D5B]" />
        <path
          d="M84 24H196V148L182 139L168 148L154 139L140 148L126 139L112 148L98 139L84 148V24Z"
          fill="#FFFFFF"
          stroke="#17243B"
          strokeWidth="2.5"
        />
        <rect x="102" y="42" width="76" height="10" rx="3" fill="#0B2D5B" />
        <rect x="102" y="62" width="54" height="6" rx="2" fill="#4A5873" fillOpacity="0.45" />
        <rect x="102" y="76" width="66" height="6" rx="2" fill="#4A5873" fillOpacity="0.45" />
        <line x1="102" y1="96" x2="178" y2="96" stroke="#DCE1EC" strokeWidth="1.5" />
        <rect x="102" y="108" width="42" height="10" rx="2" fill="#D7193F" />
        <circle cx="174" cy="112" r="15" fill="#0B2D5B" />
        <path d="M167 112L172 117L182 107" stroke="#74BFCF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  // Generic dynamic custom category geometric backdrop
  return (
    <svg viewBox="0 0 280 180" fill="none" className={className} aria-hidden="true">
      <rect width="280" height="180" fill="#F5F6FA" className="dark:fill-[#0B2D5B]" />
      <rect x="64" y="42" width="152" height="96" rx="14" fill="#17243B" />
      <path d="M98 62H182L168 106H112L98 62Z" fill="#0B2D5B" />
      <rect x="116" y="74" width="48" height="12" rx="4" fill="#D7193F" />
      <circle cx="140" cy="114" r="7" fill="#74BFCF" />
    </svg>
  );
}
