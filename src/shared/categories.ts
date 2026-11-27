import type { CategoryIconName, CategoryItem, Lang, PublicSettings } from './types.ts';

export const CATEGORY_ICONS: CategoryIconName[] = [
  'book',
  'shopping',
  'sparkles',
  'puzzle',
  'smartphone',
  'badge',
  'gamepad',
  'receipt',
  'package',
  'laptop',
];

export type CategoryGroupKey = 'retail' | 'digital';

export const DIGITAL_CATEGORY_IDS = new Set<string>(['subs', 'games', 'bills']);

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  {
    id: 'books',
    name: {
      ar: 'الكتب والروايات',
      fr: 'Livres & Ouvrages',
    },
    desc: {
      ar: 'روايات، كتب ثقافية ودينية، ومراجع دراسية وجامعية بالعربية والفرنسية.',
      fr: 'Romans, livres culturels, manuels scolaires et ouvrages universitaires.',
    },
    icon: 'book',
    img: '/src/assets/images/cat_books_editorial_1795531176077.jpg',
    sortOrder: 1,
    active: true,
  },
  {
    id: 'shop',
    name: {
      ar: 'الأدوات المدرسية والمكتبية',
      fr: 'Fournitures Scolaires & Bureau',
    },
    desc: {
      ar: 'دفاتر، أقلام، حقائب مدرسية ولوازم مكتبية عملية لكل المراحل.',
      fr: 'Cahiers, stylos, cartables et fournitures bureautiques de qualité.',
    },
    icon: 'shopping',
    img: '/src/assets/images/cat_shop_stationery_v2_1795424961761.jpg',
    sortOrder: 2,
    active: true,
  },
  {
    id: 'cosmetics',
    name: {
      ar: 'مستحضرات التجميل والعناية',
      fr: 'Cosmétiques & Soins',
    },
    desc: {
      ar: 'منتجات العناية بالبشرة والشعر ومستحضرات التجميل اليومية المختارة بعناية.',
      fr: 'Soins du visage, du corps et produits de beauté sélectionnés avec soin.',
    },
    icon: 'sparkles',
    img: '/src/assets/images/cat_cosmetics_care_1795531176007.jpg',
    sortOrder: 3,
    active: true,
  },
  {
    id: 'toys',
    name: {
      ar: 'ألعاب الأطفال',
      fr: 'Jeux & Jouets Enfants',
    },
    desc: {
      ar: 'ألعاب تعليمية وترفيهية آمنة تنمّي مهارات الأطفال وخيالهم.',
      fr: 'Jeux éducatifs, ludiques et jouets créatifs adaptés à chaque âge.',
    },
    icon: 'puzzle',
    img: '/src/assets/images/cat_toys_kids_v2_1795425777381.jpg',
    sortOrder: 4,
    active: true,
  },
  {
    id: 'accessories',
    name: {
      ar: 'إكسسوارات الهاتف',
      fr: 'Accessoires Téléphone',
    },
    desc: {
      ar: 'أغطية حماية، زجاج واقٍ، شواحن، كابلات وسماعات للهواتف الذكية.',
      fr: 'Coques, verres trempés, chargeurs, câbles et écouteurs pour smartphones.',
    },
    icon: 'smartphone',
    img: '/src/assets/images/cat_phone_accessories_v2_1795425777578.jpg',
    sortOrder: 5,
    active: true,
  },
  {
    id: 'subs',
    name: {
      ar: 'الاشتراكات الرقمية',
      fr: 'Abonnements Numériques',
    },
    desc: {
      ar: 'تفعيل اشتراكات التطبيقات والمنصات الرقمية بباقات مرنة ومتابعة مباشرة.',
      fr: 'Activation d’abonnements et services applicatifs avec suivi dédié.',
    },
    icon: 'badge',
    img: '/src/assets/images/cat_subs_digital_v2_1795424961980.jpg',
    sortOrder: 6,
    active: true,
  },
  {
    id: 'games',
    name: {
      ar: 'شحن الألعاب والتطبيقات',
      fr: 'Recharge Jeux & Applications',
    },
    desc: {
      ar: 'بطاقات ورصيد شحن الألعاب والتطبيقات الرقمية بخطوات واضحة.',
      fr: 'Cartes cadeaux et recharges de jeux et applications en toute simplicité.',
    },
    icon: 'gamepad',
    img: '/src/assets/images/cat_games_topup_v2_1795424961879.jpg',
    sortOrder: 7,
    active: true,
  },
];

export function getCategoryGroup(catId: string): CategoryGroupKey {
  return DIGITAL_CATEGORY_IDS.has(catId) ? 'digital' : 'retail';
}

export function groupCategories(categories: CategoryItem[]): {
  retail: CategoryItem[];
  digital: CategoryItem[];
} {
  const source = (categories.length ? categories : DEFAULT_CATEGORIES)
    .filter((c) => c.active)
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  const retail: CategoryItem[] = [];
  const digital: CategoryItem[] = [];

  for (const cat of source) {
    if (getCategoryGroup(cat.id) === 'digital') {
      digital.push(cat);
    } else {
      retail.push(cat);
    }
  }

  return { retail, digital };
}

export function resolveCategoryLabel(
  categories: CategoryItem[],
  catId: string,
  lang: Lang,
  fallbackItems?: Record<string, { title: string; desc: string }>,
): string {
  const found = categories.find((c) => c.id === catId);
  if (found) {
    return (found.name[lang] || found.name.ar || found.name.fr || catId).trim();
  }
  return fallbackItems?.[catId]?.title || catId;
}

export interface VerifiedTrustPoint {
  id: 'store' | 'hours' | 'payments';
  title: string;
  desc: string;
}

export function buildVerifiedTrustHighlights(
  settings: PublicSettings,
  lang: Lang,
): VerifiedTrustPoint[] {
  const address = (settings.address?.[lang] || settings.address?.ar || settings.address?.fr || '').trim();
  const hours = (
    settings.workingHours?.[lang] ||
    settings.workingHours?.ar ||
    settings.workingHours?.fr ||
    ''
  ).trim();

  const paymentParts: string[] = [];
  if (settings.ccpRip?.trim() || settings.ccpName?.trim()) {
    paymentParts.push('CCP / BaridiMob');
  }
  if (settings.chargilyEnabled) {
    paymentParts.push('Chargily Pay');
  }

  const storePoint: VerifiedTrustPoint = {
    id: 'store',
    title: lang === 'fr' ? 'Magasin physique à Hatatba' : 'متجرنا الفعلي في حطاطبة',
    desc:
      address ||
      (lang === 'fr'
        ? 'Librairie Slimi — Hatatba, Tipaza.'
        : 'مكتبة سليمي — حطاطبة، تيبازة.'),
  };

  const hoursPoint: VerifiedTrustPoint = {
    id: 'hours',
    title: lang === 'fr' ? 'Accueil & assistance directe' : 'استقبال ومتابعة مباشرة',
    desc: hours
      ? `${hours}${settings.phone ? ` · ${settings.phone}` : ''}`
      : settings.phone || '',
  };

  const paymentPoint: VerifiedTrustPoint = {
    id: 'payments',
    title: lang === 'fr' ? 'Modes de paiement configurés' : 'خيارات الدفع المعتمدة',
    desc:
      paymentParts.length > 0
        ? lang === 'fr'
          ? `Selon chaque produit : paiement à la livraison (articles physiques) ou ${paymentParts.join(' et ')}.`
          : `حسب نوع المنتج: الدفع عند الاستلام للمنتجات المادية أو عبر ${paymentParts.join(' و ')}.`
        : lang === 'fr'
          ? 'Les modes de paiement disponibles sont indiqués sur chaque fiche produit.'
          : 'تُعرض طرق الدفع المتاحة بوضوح في صفحة كل منتج وعند إتمام الطلب.',
  };

  return [storePoint, hoursPoint, paymentPoint];
}
