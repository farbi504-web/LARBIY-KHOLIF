export type Lang = 'ar' | 'fr';

export type CategoryId = string;

export type CategoryIconName =
  | 'book'
  | 'puzzle'
  | 'gamepad'
  | 'badge'
  | 'receipt'
  | 'smartphone'
  | 'package'
  | 'sparkles'
  | 'shopping'
  | 'laptop';

export type ProductType = 'physical' | 'digital';

export type PaymentMethod = 'cod' | 'ccp' | 'chargily';

export type OrderStatus =
  | 'pending'
  | 'pending_confirmation'
  | 'confirmed'
  | 'processing'
  | 'ready_shipping'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'failed_delivery';

export type PaymentStatus = 'unpaid' | 'pending_review' | 'paid' | 'failed';

export type LocalizedText = {
  ar: string;
  fr: string;
};

export interface CategoryItem {
  id: string;
  name: LocalizedText;
  desc: LocalizedText;
  icon: CategoryIconName;
  img: string;
  sortOrder: number;
  active: boolean;
  createdAt?: string;
  productCount?: number;
}

export interface ProductPlan {
  id: string;
  label: LocalizedText;
  price: number;
  oldPrice?: number | null;
}

export interface Product {
  id: string;
  cat: CategoryId;
  type: ProductType;
  name: LocalizedText;
  desc: LocalizedText;
  price: number;
  old: number | null;
  avail: boolean;
  img: string;
  needsRef: boolean;
  pays: PaymentMethod[];
  plans: ProductPlan[];
  featured: boolean;
  salesCount: number;
  rating?: number;
  reviewsCount?: number;
  sku?: string;
  costPrice?: number | null;
  stock?: number;
  lowStockThreshold?: number;
  gallery?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryLog {
  id: number;
  productId: string;
  changeAmount: number;
  previousStock: number;
  newStock: number;
  reason: string;
  actorUsername: string;
  createdAt: string;
}

export interface ProductReview {
  id: string;
  productId: string;
  authorName: string;
  rating: number;
  comment: string;
  approved?: boolean;
  adminReply?: string;
  isVerifiedPurchase?: boolean;
  createdAt: string;
}

export interface ProductReviewsData {
  reviews: ProductReview[];
  averageRating: number;
  totalReviews: number;
  distribution: Record<number, number>;
}

export interface CartItem {
  product: Product;
  planId?: string;
  qty: number;
}

export interface OrderItemSnapshot {
  productId: string;
  name: LocalizedText;
  type: ProductType;
  cat: CategoryId;
  planId?: string;
  planLabel?: LocalizedText;
  unitPrice: number;
  qty: number;
  needsRef: boolean;
  pays: PaymentMethod[];
}

export interface OrderStatusHistoryEntry {
  status: OrderStatus;
  timestamp: string;
  actor: string;
  note?: string;
}

export interface Order {
  id: string;
  code: string;
  customerId: string | null;
  customerName: string;
  customerPhone: string;
  wilaya: string;
  address: string;
  items: OrderItemSnapshot[];
  subtotal: number;
  deliveryFee?: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: OrderStatus;
  statusHistory?: OrderStatusHistoryEntry[];
  internalNotes?: string;
  trackingNumber?: string;
  deliveryProvider?: string;
  billRef: string;
  proofMediaId: string;
  deliveryData: string;
  chargilyCheckoutId: string;
  notes: string;
  lang: Lang;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
}

export interface SubscriptionRecord {
  id: string;
  orderId: string | null;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  serviceName: string;
  planLabel: string;
  accountInfo: string;
  startDate: string;
  endDate: string;
  status: 'active' | 'expiring' | 'expired' | 'cancelled';
  notes: string;
  createdAt: string;
}

export type StaffPermission =
  | 'orders'
  | 'products'
  | 'subscriptions'
  | 'settings'
  | 'staff'
  | 'audit'
  | 'reports';

export interface StaffUser {
  id: string;
  username: string;
  displayName: string;
  role: 'owner' | 'staff';
  permissions: StaffPermission[];
  active: boolean;
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  actorUsername: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  details: Record<string, unknown>;
  ip: string;
  createdAt: string;
}

export interface AnnouncementConfig {
  enabled: boolean;
  tone: 'navy' | 'crimson' | 'emerald' | 'amber';
  mode: 'ticker' | 'static';
  speed: 'slow' | 'normal' | 'fast';
  dismissible: boolean;
  ctaLabel?: LocalizedText;
  ctaTarget?: '' | 'shop' | 'track' | 'contact';
}

export interface PublicSettings {
  storeName: LocalizedText;
  address: LocalizedText;
  phone: string;
  whatsapp: string;
  ccpRip: string;
  ccpName: string;
  workingHours: LocalizedText;
  announcement: LocalizedText;
  announcementConfig?: AnnouncementConfig;
  logo: string;
  facade: string;
  facade2: string;
  in1: string;
  svc_subs: string;
  svc_games: string;
  svc_bills: string;
  svc_shop: string;
  vid: string;
  gallery: string[];
  chargilyEnabled: boolean;
  chargilyMode: 'test' | 'live';
  deliveryProvider: 'none' | 'yalidine' | 'zrexpress' | 'maystro' | 'custom';
  deliveryEnabled: boolean;
  deliveryApiId: string;
  facebook: string;
}

export interface AdminSettings extends PublicSettings {
  chargilySecretMasked: string;
  chargilyKeyFromEnv: boolean;
  deliveryTokenMasked: string;
  deliveryKeyFromEnv: boolean;
}

export interface AdminAiActionSummary {
  tool: string;
  label: string;
  ok: boolean;
  mutated?: boolean;
}

export interface AdminAiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: AdminAiActionSummary[];
  createdAt: string;
}

export type AdminTimeframe = 'today' | '7d' | '30d' | 'all';

export interface AdminReviewEntry extends ProductReview {
  productName: LocalizedText;
  productCat: CategoryId;
}

export interface AdminCustomerSummary extends Customer {
  ordersCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}
