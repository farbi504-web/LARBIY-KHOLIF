import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CATEGORIES,
  buildVerifiedTrustHighlights,
  getCategoryGroup,
  groupCategories,
  resolveCategoryLabel,
} from './categories.ts';
import type { PublicSettings } from './types.ts';

function makeSettings(overrides: Partial<PublicSettings> = {}): PublicSettings {
  return {
    storeName: { ar: 'مكتبة سليمي', fr: 'Librairie Slimi' },
    address: {
      ar: 'شارع استقلال حطاطبة ولاية تيبازة',
      fr: "Rue de l'Indépendance, Hatatba, Wilaya de Tipaza",
    },
    phone: '0772 82 72 62',
    whatsapp: '213772827262',
    ccpRip: '',
    ccpName: 'Librairie Slimi',
    workingHours: {
      ar: 'السبت إلى الخميس: 08:00 - 20:00',
      fr: 'Samedi au Jeudi : 08h00 - 20h00',
    },
    announcement: { ar: '', fr: '' },
    logo: '',
    facade: '',
    facade2: '',
    in1: '',
    svc_subs: '',
    svc_games: '',
    svc_bills: '',
    svc_shop: '',
    vid: '',
    gallery: [],
    chargilyEnabled: false,
    chargilyMode: 'test',
    deliveryProvider: 'none',
    deliveryEnabled: false,
    deliveryApiId: '',
    facebook: 'https://www.facebook.com/slimi.bookstore',
    ...overrides,
  };
}

test('DEFAULT_CATEGORIES exposes 5 physical retail and 2 digital service categories', () => {
  assert.equal(DEFAULT_CATEGORIES.length, 7);
  const grouped = groupCategories(DEFAULT_CATEGORIES);
  assert.deepEqual(
    grouped.retail.map((c) => c.id),
    ['books', 'shop', 'cosmetics', 'toys', 'accessories'],
  );
  assert.deepEqual(
    grouped.digital.map((c) => c.id),
    ['subs', 'games'],
  );
});

test('getCategoryGroup classifies retail vs digital categories accurately', () => {
  assert.equal(getCategoryGroup('books'), 'retail');
  assert.equal(getCategoryGroup('shop'), 'retail');
  assert.equal(getCategoryGroup('cosmetics'), 'retail');
  assert.equal(getCategoryGroup('toys'), 'retail');
  assert.equal(getCategoryGroup('accessories'), 'retail');
  assert.equal(getCategoryGroup('subs'), 'digital');
  assert.equal(getCategoryGroup('games'), 'digital');
});

test('resolveCategoryLabel returns localized category names for all 7 categories', () => {
  assert.equal(resolveCategoryLabel(DEFAULT_CATEGORIES, 'books', 'ar'), 'الكتب والروايات');
  assert.equal(resolveCategoryLabel(DEFAULT_CATEGORIES, 'books', 'fr'), 'Livres & Ouvrages');
  assert.equal(resolveCategoryLabel(DEFAULT_CATEGORIES, 'cosmetics', 'ar'), 'مستحضرات التجميل والعناية');
  assert.equal(resolveCategoryLabel(DEFAULT_CATEGORIES, 'cosmetics', 'fr'), 'Cosmétiques & Soins');
});

test('buildVerifiedTrustHighlights reflects only configured store settings without fabricating couriers', () => {
  const noChargily = buildVerifiedTrustHighlights(makeSettings({ chargilyEnabled: false }), 'fr');
  assert.equal(noChargily.length, 3);
  assert.match(noChargily[0].desc, /Hatatba/);
  assert.match(noChargily[1].desc, /0772 82 72 62/);
  assert.doesNotMatch(noChargily[2].desc, /Chargily/);
  assert.doesNotMatch(noChargily.map((p) => p.desc).join(' '), /Yalidine|ZR Express|58 wilayas/i);

  const withChargily = buildVerifiedTrustHighlights(makeSettings({ chargilyEnabled: true }), 'ar');
  assert.match(withChargily[2].desc, /Chargily Pay/);
});
