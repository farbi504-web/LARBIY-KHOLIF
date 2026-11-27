import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeDashboardMetrics,
  filterOrdersByTimeframe,
  getExpiringSubscriptions,
} from './adminMetrics.ts';
import { DEFAULT_CATEGORIES } from './categories.ts';
import type { Order, Product, SubscriptionRecord } from './types.ts';

const NOW = new Date('2026-11-24T12:00:00.000Z').getTime();

const SAMPLE_PRODUCTS: Product[] = [
  {
    id: 'p1',
    cat: 'books',
    type: 'physical',
    name: { ar: 'كتاب', fr: 'Livre' },
    desc: { ar: '', fr: '' },
    price: 1200,
    old: null,
    avail: true,
    img: '',
    needsRef: false,
    pays: ['cod', 'ccp'],
    plans: [],
    featured: true,
    salesCount: 4,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 'p2',
    cat: 'games',
    type: 'digital',
    name: { ar: 'شحن لعبة', fr: 'Recharge' },
    desc: { ar: '', fr: '' },
    price: 500,
    old: null,
    avail: false,
    img: '',
    needsRef: true,
    pays: ['ccp', 'chargily'],
    plans: [],
    featured: false,
    salesCount: 2,
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
  },
];

const SAMPLE_ORDERS: Order[] = [
  {
    id: 'o1',
    code: 'SLM-1001',
    customerId: null,
    customerName: 'Amine',
    customerPhone: '0772000001',
    wilaya: 'Tipaza',
    address: 'Hatatba',
    items: [
      {
        productId: 'p1',
        name: { ar: 'كتاب', fr: 'Livre' },
        type: 'physical',
        cat: 'books',
        unitPrice: 1200,
        qty: 2,
        needsRef: false,
        pays: ['cod', 'ccp'],
      },
    ],
    subtotal: 2400,
    paymentMethod: 'cod',
    paymentStatus: 'paid',
    status: 'delivered',
    billRef: '',
    proofMediaId: '',
    deliveryData: '',
    chargilyCheckoutId: '',
    notes: '',
    lang: 'ar',
    createdAt: '2026-11-24T09:00:00.000Z',
    updatedAt: '2026-11-24T09:00:00.000Z',
  },
  {
    id: 'o2',
    code: 'SLM-1002',
    customerId: null,
    customerName: 'Sara',
    customerPhone: '0772000002',
    wilaya: '',
    address: '',
    items: [
      {
        productId: 'p2',
        name: { ar: 'شحن لعبة', fr: 'Recharge' },
        type: 'digital',
        cat: 'games',
        unitPrice: 500,
        qty: 1,
        needsRef: true,
        pays: ['ccp'],
      },
    ],
    subtotal: 500,
    paymentMethod: 'ccp',
    paymentStatus: 'pending_review',
    status: 'pending',
    billRef: 'ID-9988',
    proofMediaId: '0123456789abcdef01',
    deliveryData: '',
    chargilyCheckoutId: '',
    notes: '',
    lang: 'ar',
    createdAt: '2026-11-20T10:00:00.000Z',
    updatedAt: '2026-11-20T10:00:00.000Z',
  },
  {
    id: 'o3',
    code: 'SLM-1003',
    customerId: null,
    customerName: 'Karim',
    customerPhone: '0772000003',
    wilaya: 'Alger',
    address: 'Hydra',
    items: [
      {
        productId: 'p1',
        name: { ar: 'كتاب', fr: 'Livre' },
        type: 'physical',
        cat: 'books',
        unitPrice: 1200,
        qty: 1,
        needsRef: false,
        pays: ['cod'],
      },
    ],
    subtotal: 1200,
    paymentMethod: 'cod',
    paymentStatus: 'unpaid',
    status: 'cancelled',
    billRef: '',
    proofMediaId: '',
    deliveryData: '',
    chargilyCheckoutId: '',
    notes: '',
    lang: 'fr',
    createdAt: '2026-10-10T10:00:00.000Z',
    updatedAt: '2026-10-10T10:00:00.000Z',
  },
];

const SAMPLE_SUBS: SubscriptionRecord[] = [
  {
    id: 's1',
    orderId: null,
    orderCode: '',
    customerName: 'Amine',
    customerPhone: '0772000001',
    serviceName: 'Canva Pro',
    planLabel: '1 mois',
    accountInfo: 'amine@mail.com',
    startDate: '2026-11-01',
    endDate: '2026-11-27',
    status: 'active',
    notes: '',
    createdAt: '2026-11-01T10:00:00.000Z',
  },
  {
    id: 's2',
    orderId: null,
    orderCode: '',
    customerName: 'Old',
    customerPhone: '0772000009',
    serviceName: 'Netflix',
    planLabel: '1 mois',
    accountInfo: '',
    startDate: '2026-09-01',
    endDate: '2026-10-01',
    status: 'expired',
    notes: '',
    createdAt: '2026-09-01T10:00:00.000Z',
  },
];

test('filterOrdersByTimeframe filters today, 7d, 30d, and all accurately', () => {
  assert.equal(filterOrdersByTimeframe(SAMPLE_ORDERS, 'today', NOW).length, 1);
  assert.equal(filterOrdersByTimeframe(SAMPLE_ORDERS, '7d', NOW).length, 2);
  assert.equal(filterOrdersByTimeframe(SAMPLE_ORDERS, '30d', NOW).length, 2);
  assert.equal(filterOrdersByTimeframe(SAMPLE_ORDERS, 'all', NOW).length, 3);
});

test('getExpiringSubscriptions ignores expired/cancelled and detects within 7 days', () => {
  const expiring = getExpiringSubscriptions(SAMPLE_SUBS, NOW, 7);
  assert.equal(expiring.length, 1);
  assert.equal(expiring[0].id, 's1');
});

test('computeDashboardMetrics calculates revenue, pending CCP proofs, low stock, and category stats', () => {
  const metrics = computeDashboardMetrics({
    orders: SAMPLE_ORDERS,
    products: SAMPLE_PRODUCTS,
    categories: DEFAULT_CATEGORIES,
    subscriptions: SAMPLE_SUBS,
    reviews: [
      {
        id: 'r1',
        productId: 'p1',
        productName: { ar: 'كتاب', fr: 'Livre' },
        productCat: 'books',
        authorName: 'Sara',
        rating: 5,
        comment: 'Top',
        createdAt: '2026-11-24T10:00:00.000Z',
      },
    ],
    timeframe: 'all',
    nowMs: NOW,
  });

  assert.equal(metrics.confirmedRevenue, 2400);
  assert.equal(metrics.grossOrderValue, 2900);
  assert.equal(metrics.pendingOrders, 1);
  assert.equal(metrics.pendingReviewProofs, 1);
  assert.equal(metrics.deliveredOrders, 1);
  assert.equal(metrics.cancelledOrders, 1);
  assert.equal(metrics.physicalRevenue, 2400);
  assert.equal(metrics.digitalRevenue, 500);
  assert.equal(metrics.lowStockProducts.length, 1);
  assert.equal(metrics.expiringSubscriptions.length, 1);
  assert.equal(metrics.averageRating, 5);
  assert.equal(metrics.categoryPerformance[0].categoryId, 'books');
  assert.equal(metrics.categoryPerformance[0].revenue, 2400);
});
