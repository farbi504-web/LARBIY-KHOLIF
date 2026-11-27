import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCartTotals,
  computeAllowedPayments,
  formatOrdersCsv,
  formatWhatsAppDeliveryUrl,
  isValidAlgerianPhone,
  normalizeAlgerianPhone,
  requiresBillRef,
} from './commerce.ts';
import type { CartItem, Order, Product } from './types.ts';

function makeProduct(overrides: Partial<Product>): Product {
  return {
    id: 'p1',
    cat: 'shop',
    type: 'physical',
    name: { ar: 'دفتر', fr: 'Cahier' },
    desc: { ar: '', fr: '' },
    price: 500,
    old: null,
    avail: true,
    img: '',
    needsRef: false,
    pays: ['cod', 'ccp', 'chargily'],
    plans: [],
    featured: false,
    salesCount: 0,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

test('computeAllowedPayments blocks COD when any item is digital', () => {
  const phys = makeProduct({ id: 'p1', type: 'physical', pays: ['cod', 'ccp', 'chargily'] });
  const dig = makeProduct({ id: 'p2', type: 'digital', cat: 'subs', pays: ['cod', 'ccp', 'chargily'] });
  const res = computeAllowedPayments([
    { product: phys, qty: 1 },
    { product: dig, qty: 1 },
  ]);
  assert.deepEqual(res.methods, ['ccp', 'chargily']);
  assert.equal(res.hasDigital, true);
  assert.equal(res.conflict, false);
});

test('computeAllowedPayments detects pay_mix conflict when items share zero payment methods', () => {
  const codOnly = makeProduct({ id: 'p1', type: 'physical', pays: ['cod'] });
  const digCcp = makeProduct({ id: 'p2', type: 'digital', cat: 'games', pays: ['ccp'] });
  const res = computeAllowedPayments([
    { product: codOnly, qty: 1 },
    { product: digCcp, qty: 1 },
  ]);
  assert.deepEqual(res.methods, []);
  assert.equal(res.conflict, true);
});

test('calculateCartTotals respects plan override prices and savings', () => {
  const subProduct = makeProduct({
    id: 'sub1',
    cat: 'subs',
    type: 'digital',
    price: 1500,
    old: 2000,
    plans: [
      { id: '1m', label: { ar: 'شهر واحد', fr: '1 mois' }, price: 1500, oldPrice: 2000 },
      { id: '3m', label: { ar: '3 أشهر', fr: '3 mois' }, price: 4000, oldPrice: 5500 },
    ],
  });
  const items: CartItem[] = [{ product: subProduct, planId: '3m', qty: 2 }];
  const totals = calculateCartTotals(items);
  assert.equal(totals.subtotal, 8000);
  assert.equal(totals.savings, 3000);
  assert.equal(totals.itemCount, 2);
});

test('requiresBillRef returns true only when a cart item has needsRef', () => {
  const normal = makeProduct({ id: 'p1', needsRef: false });
  const bill = makeProduct({ id: 'p2', cat: 'bills', type: 'digital', needsRef: true });
  assert.equal(requiresBillRef([{ product: normal, qty: 1 }]), false);
  assert.equal(requiresBillRef([{ product: normal, qty: 1 }, { product: bill, qty: 1 }]), true);
});

test('Algerian phone validation and WhatsApp normalization', () => {
  assert.equal(isValidAlgerianPhone('0772 82 72 62'), true);
  assert.equal(isValidAlgerianPhone('+213550123456'), true);
  assert.equal(isValidAlgerianPhone('123'), false);
  assert.equal(normalizeAlgerianPhone('0772 82 72 62'), '213772827262');
});

test('formatWhatsAppDeliveryUrl embeds order code and delivery credentials in customer language', () => {
  const url = formatWhatsAppDeliveryUrl({
    code: 'SLM-1042',
    customerName: 'Amine',
    customerPhone: '0772827262',
    deliveryData: 'email: test@example.com / pass: 1234',
    lang: 'fr',
    items: [
      {
        productId: 'p1',
        name: { ar: 'كانفا برو', fr: 'Canva Pro' },
        type: 'digital',
        cat: 'subs',
        unitPrice: 1200,
        qty: 1,
        needsRef: false,
        pays: ['ccp'],
      },
    ],
  });
  assert.match(url, /^https:\/\/wa\.me\/213772827262\?text=/);
  assert.match(decodeURIComponent(url), /SLM-1042/);
  assert.match(decodeURIComponent(url), /Canva Pro/);
  assert.match(decodeURIComponent(url), /test@example\.com/);
});

test('formatOrdersCsv includes UTF-8 BOM and protects formula cells', () => {
  const order: Order = {
    id: 'o1',
    code: 'SLM-1001',
    customerId: null,
    customerName: '=CMD()',
    customerPhone: '0772827262',
    wilaya: 'Tipaza',
    address: 'Hatatba',
    items: [
      {
        productId: 'p1',
        name: { ar: 'قلم', fr: 'Stylo' },
        type: 'physical',
        cat: 'shop',
        unitPrice: 150,
        qty: 2,
        needsRef: false,
        pays: ['cod'],
      },
    ],
    subtotal: 300,
    paymentMethod: 'cod',
    paymentStatus: 'unpaid',
    status: 'pending',
    billRef: '',
    proofMediaId: '',
    deliveryData: '',
    chargilyCheckoutId: '',
    notes: '',
    lang: 'ar',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
  const csv = formatOrdersCsv([order]);
  assert.equal(csv.startsWith('\uFEFF'), true);
  assert.match(csv, /'=CMD\(\)/);
  assert.match(csv, /SLM-1001/);
});
