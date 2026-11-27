import { useEffect } from 'react';
import { TX } from '../shared/i18n.ts';
import { formatPriceDzd } from '../shared/commerce.ts';
import { DEFAULT_CATEGORIES, resolveCategoryLabel } from '../shared/categories.ts';
import type { CategoryItem, Lang, Product, PublicSettings } from '../shared/types.ts';

interface ProductMetaProps {
  lang: Lang;
  product: Product | null;
  settings?: PublicSettings;
  categories?: CategoryItem[];
}

const DEFAULT_TITLE =
  'مكتبة سليمي | Librairie Slimi — كتب، أدوات مدرسية، تجميل، ألعاب، إكسسوارات وخدمات رقمية';
const DEFAULT_DESC =
  'مكتبة سليمي في حطاطبة، تيبازة — كتب، مستلزمات مدرسية ومكتبية، مستحضرات تجميل، ألعاب أطفال، إكسسوارات الهاتف، اشتراكات رقمية وشحن الألعاب والتطبيقات.';
const DEFAULT_OG_TITLE = 'مكتبة سليمي | Librairie Slimi';
const DEFAULT_OG_DESC =
  'كتب، أدوات مدرسية ومكتبية، مستحضرات تجميل، ألعاب أطفال، إكسسوارات الهاتف وخدمات رقمية — حطاطبة، تيبازة.';
const DEFAULT_IMAGE = '/src/assets/images/hero_bookstore_editorial_1795529055490.jpg';

function upsertMeta(attr: 'name' | 'property', key: string, value: string): void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', value);
}

function resolveAbsoluteUrl(pathOrUrl: string): string {
  if (!pathOrUrl) return `${window.location.origin}${DEFAULT_IMAGE}`;
  if (/^https?:\/\//i.test(pathOrUrl) || pathOrUrl.startsWith('data:')) {
    return pathOrUrl;
  }
  const normalized = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${window.location.origin}${normalized}`;
}

export function ProductMeta({ lang, product, settings, categories = DEFAULT_CATEGORIES }: ProductMetaProps) {
  useEffect(() => {
    const storeName = settings?.storeName?.[lang] || TX[lang].brand;

    if (!product) {
      document.title = DEFAULT_TITLE;
      upsertMeta('name', 'description', DEFAULT_DESC);
      upsertMeta('property', 'og:type', 'website');
      upsertMeta('property', 'og:title', DEFAULT_OG_TITLE);
      upsertMeta('property', 'og:description', DEFAULT_OG_DESC);
      upsertMeta('property', 'og:image', resolveAbsoluteUrl(DEFAULT_IMAGE));
      upsertMeta('name', 'twitter:title', DEFAULT_OG_TITLE);
      upsertMeta('name', 'twitter:description', DEFAULT_OG_DESC);
      upsertMeta('name', 'twitter:image', resolveAbsoluteUrl(DEFAULT_IMAGE));
      return;
    }

    const name = (product.name[lang] || product.name.ar || product.name.fr || '').trim();
    const rawDesc = (product.desc[lang] || product.desc.ar || product.desc.fr || '').trim();
    const priceText = formatPriceDzd(product.price, lang);
    const catLabel = resolveCategoryLabel(categories, product.cat, lang, TX[lang].services.items);
    const summaryDesc = rawDesc
      ? rawDesc.replace(/\s+/g, ' ').slice(0, 155)
      : `${name} — ${priceText} · ${catLabel} · ${storeName}`;

    const fullTitle = `${name} (${priceText}) | ${storeName}`;
    const imageUrl = resolveAbsoluteUrl(product.img || DEFAULT_IMAGE);

    document.title = fullTitle;
    upsertMeta('name', 'description', summaryDesc);
    upsertMeta('property', 'og:type', 'product');
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', summaryDesc);
    upsertMeta('property', 'og:image', imageUrl);
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', summaryDesc);
    upsertMeta('name', 'twitter:image', imageUrl);

    return () => {
      document.title = DEFAULT_TITLE;
      upsertMeta('name', 'description', DEFAULT_DESC);
      upsertMeta('property', 'og:type', 'website');
      upsertMeta('property', 'og:title', DEFAULT_OG_TITLE);
      upsertMeta('property', 'og:description', DEFAULT_OG_DESC);
      upsertMeta('property', 'og:image', resolveAbsoluteUrl(DEFAULT_IMAGE));
      upsertMeta('name', 'twitter:title', DEFAULT_OG_TITLE);
      upsertMeta('name', 'twitter:description', DEFAULT_OG_DESC);
      upsertMeta('name', 'twitter:image', resolveAbsoluteUrl(DEFAULT_IMAGE));
    };
  }, [lang, product, settings]);

  return null;
}
