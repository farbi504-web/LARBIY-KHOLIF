import type {
  CartItem,
  Lang,
  Order,
  OrderItemSnapshot,
  OrderStatus,
  PaymentMethod,
  Product,
  ProductPlan,
} from './types.ts';

export const ALL_PAYMENT_METHODS: PaymentMethod[] = ['cod', 'ccp', 'chargily'];

export const ALL_ORDER_STATUSES: OrderStatus[] = [
  'pending',
  'pending_confirmation',
  'confirmed',
  'processing',
  'ready_shipping',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
  'failed_delivery',
];

export const ALLOWED_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['pending_confirmation', 'confirmed', 'cancelled'],
  pending_confirmation: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['ready_shipping', 'cancelled'],
  ready_shipping: ['shipped', 'cancelled'],
  shipped: ['delivered', 'failed_delivery', 'returned'],
  delivered: ['returned'],
  failed_delivery: ['shipped', 'returned', 'cancelled'],
  returned: [],
  cancelled: [],
};

export function canTransitionOrderStatus(current: OrderStatus, target: OrderStatus): boolean {
  if (current === target) return true;
  const allowed = ALLOWED_STATUS_TRANSITIONS[current] || [];
  return allowed.includes(target);
}

export function calculateProfitMargin(
  sellingPrice: number,
  costPrice?: number | null,
): { marginPct: number; profitDzd: number } | null {
  const sell = Number(sellingPrice) || 0;
  if (costPrice == null || costPrice <= 0 || sell <= 0) {
    return null;
  }
  const cost = Number(costPrice);
  const profitDzd = Math.round(sell - cost);
  const marginPct = Math.round(((sell - cost) / sell) * 100);
  return { marginPct, profitDzd };
}

export function resolveItemUnitPrice(product: Product, planId?: string): {
  price: number;
  oldPrice: number | null;
  plan?: ProductPlan;
} {
  if (planId && Array.isArray(product.plans) && product.plans.length > 0) {
    const found = product.plans.find((p) => p.id === planId);
    if (found) {
      return {
        price: Math.max(0, Number(found.price) || 0),
        oldPrice: found.oldPrice != null ? Number(found.oldPrice) : null,
        plan: found,
      };
    }
  }
  return {
    price: Math.max(0, Number(product.price) || 0),
    oldPrice: product.old != null ? Number(product.old) : null,
  };
}

export function computeAllowedPayments(items: CartItem[]): {
  methods: PaymentMethod[];
  conflict: boolean;
  hasDigital: boolean;
} {
  if (!items.length) {
    return { methods: [], conflict: false, hasDigital: false };
  }

  let hasDigital = false;
  let allowed = new Set<PaymentMethod>(ALL_PAYMENT_METHODS);

  for (const item of items) {
    if (item.product.type === 'digital') {
      hasDigital = true;
    }
    const itemPays = new Set<PaymentMethod>(
      Array.isArray(item.product.pays) && item.product.pays.length > 0
        ? item.product.pays
        : item.product.type === 'digital'
          ? ['ccp', 'chargily']
          : ['cod', 'ccp', 'chargily'],
    );
    allowed = new Set([...allowed].filter((m) => itemPays.has(m)));
  }

  if (hasDigital) {
    allowed.delete('cod');
  }

  const methods = ALL_PAYMENT_METHODS.filter((m) => allowed.has(m));
  return {
    methods,
    conflict: methods.length === 0,
    hasDigital,
  };
}

export function requiresBillRef(items: CartItem[]): boolean {
  return items.some((item) => Boolean(item.product.needsRef));
}

export function calculateCartTotals(items: CartItem[]): {
  subtotal: number;
  savings: number;
  itemCount: number;
} {
  let subtotal = 0;
  let savings = 0;
  let itemCount = 0;

  for (const item of items) {
    const qty = Math.max(1, Math.floor(item.qty || 1));
    const { price, oldPrice } = resolveItemUnitPrice(item.product, item.planId);
    subtotal += price * qty;
    if (oldPrice && oldPrice > price) {
      savings += (oldPrice - price) * qty;
    }
    itemCount += qty;
  }

  return { subtotal, savings, itemCount };
}

export function normalizeAlgerianPhone(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+213')) {
    return digits.slice(1);
  }
  if (digits.startsWith('00213')) {
    return digits.slice(2);
  }
  if (digits.startsWith('0') && digits.length >= 9) {
    return '213' + digits.slice(1);
  }
  return digits;
}

export function isValidAlgerianPhone(phone: string): boolean {
  const clean = phone.replace(/[\s\-().]/g, '');
  return /^(?:\+?213|0)(?:5|6|7)\d{8}$/.test(clean) || /^(?:\+?213|0)\d{8,9}$/.test(clean);
}

export function formatWhatsAppDeliveryUrl(
  order: Pick<Order, 'code' | 'customerName' | 'customerPhone' | 'deliveryData' | 'lang' | 'items'>,
  fallbackLang: Lang = 'ar',
): string {
  const lang = order.lang || fallbackLang;
  const waPhone = normalizeAlgerianPhone(order.customerPhone);
  const itemNames = order.items
    .map((it) => `${it.name[lang] || it.name.ar}${it.planLabel ? ` (${it.planLabel[lang] || it.planLabel.ar})` : ''} ×${it.qty}`)
    .join('، ');

  const text =
    lang === 'fr'
      ? [
          `Bonjour ${order.customerName},`,
          `Votre commande Librairie Slimi N° ${order.code} (${itemNames}) est prête.`,
          order.deliveryData ? `Informations de livraison :\n${order.deliveryData}` : '',
          `Merci pour votre confiance !`,
        ]
          .filter(Boolean)
          .join('\n\n')
      : [
          `مرحبًا ${order.customerName}،`,
          `طلبك من مكتبة سليمي رقم ${order.code} (${itemNames}) جاهز للتسليم.`,
          order.deliveryData ? `بيانات التسليم:\n${order.deliveryData}` : '',
          `شكرًا لثقتك بنا!`,
        ]
          .filter(Boolean)
          .join('\n\n');

  return `https://wa.me/${encodeURIComponent(waPhone)}?text=${encodeURIComponent(text)}`;
}

function escapeCsvCell(value: string | number | null | undefined): string {
  let str = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  if (/[",\n\r;]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function formatOrdersCsv(orders: Order[]): string {
  const headers = [
    'Code',
    'Date',
    'Customer',
    'Phone',
    'Wilaya',
    'Address',
    'Items',
    'Subtotal_DZD',
    'Payment_Method',
    'Payment_Status',
    'Order_Status',
    'Bill_Ref',
    'Delivery_Data',
  ];

  const rows = orders.map((o) => {
    const itemsText = o.items
      .map((i: OrderItemSnapshot) => `${i.name.ar}${i.planLabel ? ` (${i.planLabel.ar})` : ''} x${i.qty}`)
      .join(' | ');
    return [
      o.code,
      o.createdAt,
      o.customerName,
      o.customerPhone,
      o.wilaya,
      o.address,
      itemsText,
      o.subtotal,
      o.paymentMethod,
      o.paymentStatus,
      o.status,
      o.billRef,
      o.deliveryData,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
}

export function formatPriceDzd(amount: number, lang: Lang): string {
  const rounded = Math.round(Number(amount) || 0);
  const formatted = rounded.toLocaleString('fr-DZ').replace(/\u202f|\u00a0/g, ' ');
  return lang === 'fr' ? `${formatted} DA` : `${formatted} دج`;
}

export const ALGERIAN_WILAYAS = [
  'Tipaza (تيبازة)',
  'Alger (الجزائر)',
  'Blida (البليدة)',
  'Boumerdès (بومرداس)',
  'Oran (وهران)',
  'Constantine (قسنطينة)',
  'Sétif (سطيف)',
  'Tizi Ouzou (تيزي وزو)',
  'Chlef (الشلف)',
  'Batna (باتنة)',
  'Béjaïa (بجاية)',
  'Biskra (بسكرة)',
  'Béchar (بشار)',
  'Bouira (البويرة)',
  'Tamanrasset (تمنراست)',
  'Tébessa (تبسة)',
  'Tlemcen (تلمسان)',
  'Tiaret (تيارت)',
  'Djelfa (الجلفة)',
  'Jijel (جيجل)',
  'Saïda (سعيدة)',
  'Skikda (سكيكدة)',
  'Sidi Bel Abbès (سيدي بلعباس)',
  'Annaba (عنابة)',
  'Guelma (قالمة)',
  'Médéa (المدية)',
  'Mostaganem (مستغانم)',
  'M\'Sila (المسيلة)',
  'Mascara (معسكر)',
  'Ouargla (ورقلة)',
  'El Bayadh (الأبيض)',
  'Illizi (إليزي)',
  'Bordj Bou Arréridj (برج بوعريريج)',
  'El Tarf (الطارف)',
  'Tindouf (تندوف)',
  'Tissemsilt (تسمسيلت)',
  'El Oued (الوادي)',
  'Khenchela (خنشلة)',
  'Souk Ahras (سوق أهراس)',
  'Mila (ميلة)',
  'Aïn Defla (عين الدفلى)',
  'Naâma (نعامة)',
  'Aïn Témouchent (عين تموشنت)',
  'Ghardaïa (غرداية)',
  'Relizane (غليزان)',
  'Timimoun (تيميمون)',
  'Bordj Badji Mokhtar (برج باجي مختار)',
  'Ouled Djellal (أولاد جلال)',
  'Béni Abbès (بني عباس)',
  'In Salah (عين صالح)',
  'In Guezzam (عين قزام)',
  'Touggourt (تقرت)',
  'Djanet (جانت)',
  'El M\'Ghair (المغير)',
  'El Meniaa (المنيعة)',
  'Adrar (أدرار)',
  'Laghouat (الأغواط)',
  'Oum El Bouaghi (أم البواقي)',
];

export function calculateShippingFee(
  wilaya: string,
  deliveryProvider?: string,
  deliveryEnabled?: boolean,
): {
  fee: number;
  providerLabel: string;
} {
  if (!deliveryEnabled || !deliveryProvider || deliveryProvider === 'none') {
    return { fee: 0, providerLabel: 'شحن يدوي' };
  }

  const w = (wilaya || '').trim().toLowerCase();
  const isZoneA = ['tipaza', 'تيبازة', 'alger', 'الجزائر', 'blida', 'البليدة', 'boumerdes', 'بومرداس'].some((z) =>
    w.includes(z),
  );
  const isZoneC = ['adrar', 'أدرار', 'tamanrasset', 'تمنراست', 'illizi', 'إليزي', 'tindouf', 'تندوف', 'bechar', 'بشار'].some(
    (z) => w.includes(z),
  );

  const baseFee = isZoneC ? 1000 : isZoneA ? 400 : 600;
  const providerLabel =
    deliveryProvider === 'yalidine'
      ? 'Yalidine Express'
      : deliveryProvider === 'zrexpress'
        ? 'ZR Express'
        : deliveryProvider === 'maystro'
          ? 'Maystro Delivery'
          : 'شحن سريع';

  return { fee: baseFee, providerLabel };
}
