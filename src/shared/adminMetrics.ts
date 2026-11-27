import type {
  AdminReviewEntry,
  AdminTimeframe,
  CategoryItem,
  Order,
  PaymentMethod,
  Product,
  SubscriptionRecord,
} from './types.ts';

export interface PaymentChannelStat {
  method: PaymentMethod;
  ordersCount: number;
  revenue: number;
  sharePct: number;
}

export interface CategoryPerformanceStat {
  categoryId: string;
  category: CategoryItem;
  productsCount: number;
  unitsSold: number;
  revenue: number;
}

export interface AdminDashboardMetrics {
  timeframe: AdminTimeframe;
  confirmedRevenue: number;
  grossOrderValue: number;
  avgOrderValue: number;
  totalOrders: number;
  deliveredOrders: number;
  pendingOrders: number;
  processingOrders: number;
  cancelledOrders: number;
  pendingReviewProofs: number;
  fulfillmentRate: number;
  physicalOrders: number;
  digitalOrders: number;
  physicalRevenue: number;
  digitalRevenue: number;
  paymentBreakdown: PaymentChannelStat[];
  categoryPerformance: CategoryPerformanceStat[];
  lowStockProducts: Product[];
  expiringSubscriptions: SubscriptionRecord[];
  activeSubscriptions: number;
  averageRating: number;
  totalReviews: number;
}

export function filterOrdersByTimeframe(
  orders: Order[],
  timeframe: AdminTimeframe,
  nowMs = Date.now(),
): Order[] {
  if (timeframe === 'all') return orders;

  const nowDate = new Date(nowMs);
  let cutoffMs = 0;

  if (timeframe === 'today') {
    const startOfDay = new Date(nowDate);
    startOfDay.setHours(0, 0, 0, 0);
    cutoffMs = startOfDay.getTime();
  } else if (timeframe === '7d') {
    cutoffMs = nowMs - 7 * 86_400_000;
  } else if (timeframe === '30d') {
    cutoffMs = nowMs - 30 * 86_400_000;
  }

  return orders.filter((order) => {
    const ts = new Date(order.createdAt).getTime();
    return Number.isFinite(ts) && ts >= cutoffMs;
  });
}

export function getExpiringSubscriptions(
  subscriptions: SubscriptionRecord[],
  nowMs = Date.now(),
  withinDays = 7,
): SubscriptionRecord[] {
  const cutoffMs = nowMs + withinDays * 86_400_000;
  return subscriptions.filter((sub) => {
    if (sub.status === 'cancelled' || sub.status === 'expired') return false;
    const endTs = new Date(sub.endDate).getTime();
    return Number.isFinite(endTs) && endTs <= cutoffMs;
  });
}

export function computeDashboardMetrics(params: {
  orders: Order[];
  products: Product[];
  categories: CategoryItem[];
  subscriptions: SubscriptionRecord[];
  reviews?: AdminReviewEntry[];
  timeframe: AdminTimeframe;
  nowMs?: number;
}): AdminDashboardMetrics {
  const {
    orders,
    products,
    categories,
    subscriptions,
    reviews = [],
    timeframe,
    nowMs = Date.now(),
  } = params;

  const scopedOrders = filterOrdersByTimeframe(orders, timeframe, nowMs);
  const nonCancelled = scopedOrders.filter((o) => o.status !== 'cancelled');
  const confirmedOrPaid = nonCancelled.filter(
    (o) => o.paymentStatus === 'paid' || o.status === 'delivered' || o.status === 'confirmed',
  );

  const confirmedRevenue = confirmedOrPaid.reduce((acc, o) => acc + Number(o.subtotal || 0), 0);
  const grossOrderValue = nonCancelled.reduce((acc, o) => acc + Number(o.subtotal || 0), 0);
  const avgOrderValue =
    nonCancelled.length > 0 ? Math.round(grossOrderValue / nonCancelled.length) : 0;

  const deliveredOrders = scopedOrders.filter((o) => o.status === 'delivered').length;
  const pendingOrders = scopedOrders.filter((o) => o.status === 'pending').length;
  const processingOrders = scopedOrders.filter(
    (o) => o.status === 'confirmed' || o.status === 'processing',
  ).length;
  const cancelledOrders = scopedOrders.filter((o) => o.status === 'cancelled').length;
  const pendingReviewProofs = orders.filter(
    (o) => o.paymentStatus === 'pending_review' && o.status !== 'cancelled',
  ).length;

  const fulfillmentRate =
    scopedOrders.length > 0 ? Math.round((deliveredOrders / scopedOrders.length) * 100) : 100;

  let physicalOrders = 0;
  let digitalOrders = 0;
  let physicalRevenue = 0;
  let digitalRevenue = 0;

  const payMap: Record<PaymentMethod, { count: number; revenue: number }> = {
    cod: { count: 0, revenue: 0 },
    ccp: { count: 0, revenue: 0 },
    chargily: { count: 0, revenue: 0 },
  };

  const catSalesMap = new Map<string, { units: number; revenue: number }>();

  for (const order of nonCancelled) {
    const subtotal = Number(order.subtotal || 0);
    const hasPhysical = order.items.some((it) => it.type === 'physical');
    const hasDigital = order.items.some((it) => it.type === 'digital');

    if (hasPhysical) {
      physicalOrders += 1;
      if (!hasDigital) physicalRevenue += subtotal;
    }
    if (hasDigital) {
      digitalOrders += 1;
      if (!hasPhysical) digitalRevenue += subtotal;
    }
    if (hasPhysical && hasDigital) {
      for (const item of order.items) {
        const lineTotal = Number(item.unitPrice || 0) * Number(item.qty || 1);
        if (item.type === 'digital') digitalRevenue += lineTotal;
        else physicalRevenue += lineTotal;
      }
    }

    const payBucket = payMap[order.paymentMethod];
    if (payBucket) {
      payBucket.count += 1;
      payBucket.revenue += subtotal;
    }

    for (const item of order.items) {
      const prev = catSalesMap.get(item.cat) || { units: 0, revenue: 0 };
      prev.units += Number(item.qty || 1);
      prev.revenue += Number(item.unitPrice || 0) * Number(item.qty || 1);
      catSalesMap.set(item.cat, prev);
    }
  }

  const totalNonCancelled = nonCancelled.length;
  const paymentBreakdown: PaymentChannelStat[] = (['cod', 'ccp', 'chargily'] as PaymentMethod[]).map(
    (method) => ({
      method,
      ordersCount: payMap[method].count,
      revenue: payMap[method].revenue,
      sharePct:
        totalNonCancelled > 0 ? Math.round((payMap[method].count / totalNonCancelled) * 100) : 0,
    }),
  );

  const categoryPerformance: CategoryPerformanceStat[] = categories
    .filter((c) => c.active)
    .map((category) => {
      const catProducts = products.filter((p) => p.cat === category.id);
      const sales = catSalesMap.get(category.id) || { units: 0, revenue: 0 };
      return {
        categoryId: category.id,
        category,
        productsCount: catProducts.length,
        unitsSold: sales.units,
        revenue: sales.revenue,
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.productsCount - a.productsCount);

  const lowStockProducts = products.filter((p) => !p.avail);
  const expiringSubscriptions = getExpiringSubscriptions(subscriptions, nowMs, 7);
  const activeSubscriptions = subscriptions.filter(
    (s) => s.status === 'active' || s.status === 'expiring',
  ).length;

  const totalReviews = reviews.length;
  const averageRating =
    totalReviews > 0
      ? Math.round((reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0) / totalReviews) * 10) /
        10
      : 0;

  return {
    timeframe,
    confirmedRevenue,
    grossOrderValue,
    avgOrderValue,
    totalOrders: scopedOrders.length,
    deliveredOrders,
    pendingOrders,
    processingOrders,
    cancelledOrders,
    pendingReviewProofs,
    fulfillmentRate,
    physicalOrders,
    digitalOrders,
    physicalRevenue,
    digitalRevenue,
    paymentBreakdown,
    categoryPerformance,
    lowStockProducts,
    expiringSubscriptions,
    activeSubscriptions,
    averageRating,
    totalReviews,
  };
}
