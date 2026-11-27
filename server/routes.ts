import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import {
  addProductReview,
  audit,
  getDbBackend,
  getLastPgError,
  getProductReviews,
  getSetting,
  row,
  rows,
  run,
  setSetting,
  withTransaction,
} from './db.ts';
import { SQLITE_TO_PG_TABLES, parseSafeDatabaseTarget } from './pgHelpers.ts';
import {
  ADMIN_COOKIE,
  CUSTOMER_COOKIE,
  clearSessionCookie,
  createSession,
  deleteSession,
  getSession,
  hashPassword,
  isOwnerEnvPasswordSet,
  ownerNeedsClaim,
  rateLimit,
  resolveAdminUserFromSession,
  setSessionCookie,
  verifyAdminLogin,
  verifyPassword,
} from './auth.ts';
import { clearAdminAiHistory, getAdminAiHistory, runAdminAiTurn } from './adminAi.ts';
import { parseGeminiErrorMessage } from '../src/shared/aiHelpers.ts';
import { computeReviewStats, validateReviewInput } from '../src/shared/reviews.ts';
import {
  calculateCartTotals,
  computeAllowedPayments,
  formatOrdersCsv,
  isValidAlgerianPhone,
  requiresBillRef,
  resolveItemUnitPrice,
} from '../src/shared/commerce.ts';
import { CATEGORY_ICONS } from '../src/shared/categories.ts';
import type {
  AdminCustomerSummary,
  AdminReviewEntry,
  AdminSettings,
  AnnouncementConfig,
  AuditEntry,
  CartItem,
  CategoryIconName,
  CategoryId,
  CategoryItem,
  Customer,
  DatabaseConnectionConfig,
  DatabaseStatusSnapshot,
  Lang,
  Order,
  OrderItemSnapshot,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Product,
  ProductPlan,
  ProductType,
  PublicSettings,
  StaffPermission,
  StaffUser,
  SubscriptionRecord,
} from '../src/shared/types.ts';

const ALLOWED_IMAGE_SLOTS = new Set([
  'logo',
  'facade',
  'facade2',
  'in1',
  'svc_subs',
  'svc_games',
  'svc_bills',
  'svc_shop',
  'gallery',
  'product',
  'category',
]);

const BRAND_IMAGE_PATH = path.resolve('public/brand/logo.svg');

function getClientIp(req: Request): string {
  const fwd = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return fwd || req.ip || req.socket.remoteAddress || '';
}

function getBaseUrl(req: Request): string {
  const rawEnv = (process.env.PUBLIC_URL || process.env.APP_URL || '').trim().replace(/\/+$/, '');
  if (rawEnv && !rawEnv.includes('MY_APP_URL')) {
    try {
      const parsed = new URL(rawEnv);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {
      // Ignore malformed PUBLIC_URL and fall back to proxy/host headers
    }
  }
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http')
    .split(',')[0]
    .trim()
    .toLowerCase();
  const safeProto = proto === 'https' ? 'https' : 'http';
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000')
    .split(',')[0]
    .trim();
  return `${safeProto}://${host}`;
}

function maskSecret(val: string): string {
  const clean = (val || '').trim();
  if (!clean) return '';
  if (clean.length <= 4) return '••••';
  return '••••••••' + clean.slice(-4);
}

function isMaskedValue(val: string): boolean {
  return val.includes('••••');
}

function detectImageMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // JPEG
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  // PNG
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image/png';
  // GIF
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return 'image/gif';
  // WEBP (RIFF....WEBP)
  if (
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

function detectVideoMime(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  // MP4 / ISO BMFF (`ftyp` at offset 4)
  if (buf.subarray(4, 8).toString('ascii') === 'ftyp') return 'video/mp4';
  // WebM / EBML (0x1A 0x45 0xDF 0xA3)
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video/webm';
  return null;
}

interface DbProductRow {
  id: string;
  cat: CategoryId;
  type: ProductType;
  name_json: string;
  desc_json: string;
  price: number;
  old_price: number | null;
  avail: number;
  img: string;
  needs_ref: number;
  pays_json: string;
  plans_json: string;
  featured: number;
  sales_count: number;
  created_at: string;
  updated_at: string;
}

function mapProduct(r: DbProductRow): Product {
  return {
    id: r.id,
    cat: r.cat,
    type: r.type,
    name: JSON.parse(r.name_json),
    desc: JSON.parse(r.desc_json),
    price: Number(r.price),
    old: r.old_price != null ? Number(r.old_price) : null,
    avail: Boolean(r.avail),
    img: r.img || '',
    needsRef: Boolean(r.needs_ref),
    pays: JSON.parse(r.pays_json || '["cod","ccp","chargily"]'),
    plans: JSON.parse(r.plans_json || '[]'),
    featured: Boolean(r.featured),
    salesCount: Number(r.sales_count || 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

interface DbCategoryRow {
  id: string;
  name_json: string;
  desc_json: string;
  icon: string;
  img: string;
  sort_order: number;
  active: number;
  created_at: string;
  product_count?: number;
}

function mapCategory(r: DbCategoryRow): CategoryItem {
  const icon = CATEGORY_ICONS.includes(r.icon as CategoryIconName)
    ? (r.icon as CategoryIconName)
    : 'package';
  return {
    id: r.id,
    name: JSON.parse(r.name_json),
    desc: JSON.parse(r.desc_json),
    icon,
    img: r.img || '',
    sortOrder: Number(r.sort_order || 0),
    active: Boolean(r.active),
    createdAt: r.created_at,
    ...(r.product_count !== undefined ? { productCount: Number(r.product_count) } : {}),
  };
}

function isSafeImageRef(val: string): boolean {
  if (!val) return true;
  if (/^\/media\/[a-f0-9]{18}$/i.test(val)) return true;
  if (/^\/src\/assets\/images\/[a-z0-9_.-]+\.(?:jpg|jpeg|png|webp)$/i.test(val)) return true;
  if (/^\/brand\/[a-z0-9_.-]+\.(?:svg|png|jpg)$/i.test(val)) return true;
  return false;
}

interface DbOrderRow {
  id: string;
  code: string;
  customer_id: string | null;
  customer_name: string;
  customer_phone: string;
  wilaya: string;
  address: string;
  items_json: string;
  subtotal: number;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  status: OrderStatus;
  bill_ref: string;
  proof_media_id: string;
  delivery_data: string;
  chargily_checkout_id: string;
  notes: string;
  lang: Lang;
  created_at: string;
  updated_at: string;
}

function mapOrder(r: DbOrderRow): Order {
  return {
    id: r.id,
    code: r.code,
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    wilaya: r.wilaya,
    address: r.address,
    items: JSON.parse(r.items_json || '[]'),
    subtotal: Number(r.subtotal),
    paymentMethod: r.payment_method,
    paymentStatus: r.payment_status,
    status: r.status,
    billRef: r.bill_ref || '',
    proofMediaId: r.proof_media_id || '',
    deliveryData: r.delivery_data || '',
    chargilyCheckoutId: r.chargily_checkout_id || '',
    notes: r.notes || '',
    lang: r.lang || 'ar',
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

interface PrivateIntegrations {
  chargilySecretKey: string;
  chargilyMode: 'test' | 'live';
  deliveryProvider: 'none' | 'yalidine' | 'zrexpress' | 'maystro' | 'custom';
  deliveryToken: string;
  deliveryApiId: string;
  deliveryEnabled: boolean;
}

async function getIntegrations(): Promise<PrivateIntegrations> {
  const stored = await getSetting<Partial<PrivateIntegrations>>('integrations', {});
  return {
    chargilySecretKey: (process.env.CHARGILY_SECRET_KEY || stored.chargilySecretKey || '').trim(),
    chargilyMode:
      process.env.CHARGILY_MODE === 'live'
        ? 'live'
        : process.env.CHARGILY_MODE === 'test'
          ? 'test'
          : stored.chargilyMode === 'live'
            ? 'live'
            : 'test',
    deliveryProvider: stored.deliveryProvider || 'none',
    deliveryToken: (process.env.DELIVERY_TOKEN || stored.deliveryToken || '').trim(),
    deliveryApiId: (process.env.DELIVERY_API_ID || stored.deliveryApiId || '').trim(),
    deliveryEnabled: stored.deliveryEnabled !== undefined ? Boolean(stored.deliveryEnabled) : false,
  };
}

function normalizeAnnouncementConfig(
  raw: Partial<AnnouncementConfig> | undefined,
): AnnouncementConfig {
  const validTones = new Set(['navy', 'crimson', 'emerald', 'amber']);
  const validModes = new Set(['ticker', 'static']);
  const validSpeeds = new Set(['slow', 'normal', 'fast']);
  const validTargets = new Set(['', 'shop', 'track', 'contact']);
  return {
    enabled: raw?.enabled !== undefined ? Boolean(raw.enabled) : true,
    tone: validTones.has(String(raw?.tone)) ? (raw!.tone as AnnouncementConfig['tone']) : 'navy',
    mode: validModes.has(String(raw?.mode)) ? (raw!.mode as AnnouncementConfig['mode']) : 'ticker',
    speed: validSpeeds.has(String(raw?.speed)) ? (raw!.speed as AnnouncementConfig['speed']) : 'normal',
    dismissible: Boolean(raw?.dismissible),
    ctaLabel: {
      ar: String(raw?.ctaLabel?.ar || '').trim().slice(0, 60),
      fr: String(raw?.ctaLabel?.fr || '').trim().slice(0, 60),
    },
    ctaTarget: validTargets.has(String(raw?.ctaTarget || ''))
      ? ((raw?.ctaTarget || '') as AnnouncementConfig['ctaTarget'])
      : '',
  };
}

async function getPublicSettings(): Promise<PublicSettings> {
  const cfg = await getSetting<PublicSettings>('store_config', {
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
    announcement: {
      ar: 'مرحباً بكم في مكتبة سليمي · كتب، أدوات مدرسية، تجميل، ألعاب، إكسسوارات وخدمات رقمية',
      fr: 'Bienvenue à la Librairie Slimi · Livres, papeterie, cosmétiques, jouets, accessoires & numérique',
    },
    announcementConfig: normalizeAnnouncementConfig({
      enabled: true,
      tone: 'navy',
      mode: 'ticker',
      speed: 'normal',
      dismissible: false,
      ctaLabel: { ar: 'تصفح المتجر', fr: 'Boutique' },
      ctaTarget: 'shop',
    }),
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
  });

  const defaultAnnouncement = {
    ar: 'مرحباً بكم في مكتبة سليمي · كتب، أدوات مدرسية، تجميل، ألعاب، إكسسوارات وخدمات رقمية',
    fr: 'Bienvenue à la Librairie Slimi · Livres, papeterie, cosmétiques, jouets, accessoires & numérique',
  };

  const resolvedAnnouncement =
    cfg.announcement && (cfg.announcement.ar || cfg.announcement.fr)
      ? cfg.announcement
      : defaultAnnouncement;

  const resolvedConfig = normalizeAnnouncementConfig(cfg.announcementConfig);
  resolvedConfig.mode = 'ticker';
  if (!resolvedConfig.ctaLabel?.ar && !resolvedConfig.ctaLabel?.fr) {
    resolvedConfig.ctaLabel = { ar: 'تصفح المتجر', fr: 'Boutique' };
    resolvedConfig.ctaTarget = 'shop';
  }

  const integrations = await getIntegrations();
  return {
    ...cfg,
    facebook: cfg.facebook || 'https://www.facebook.com/slimi.bookstore',
    announcement: resolvedAnnouncement,
    announcementConfig: resolvedConfig,
    chargilyEnabled: Boolean(integrations.chargilySecretKey),
    chargilyMode: integrations.chargilyMode,
    deliveryProvider: integrations.deliveryProvider,
    deliveryEnabled: integrations.deliveryEnabled,
    deliveryApiId: integrations.deliveryApiId,
  };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

type AsyncRouteHandler = (req: Request, res: Response, next: NextFunction) => Promise<void> | void;

function asyncHandler(fn: AsyncRouteHandler) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

function requireAdmin(permission?: StaffPermission) {
  return asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const sess = await getSession(req, 'admin');
    if (!sess) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const user = await resolveAdminUserFromSession(sess);
    if (!user) {
      res.status(401).json({ error: 'Invalid or inactive session' });
      return;
    }
    if (permission && user.role !== 'owner' && !user.permissions.includes(permission)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    (req as Request & { adminUser?: StaffUser }).adminUser = user;
    next();
  });
}

function getAdminUser(req: Request): StaffUser {
  return (req as Request & { adminUser: StaffUser }).adminUser;
}

export function registerRoutes(app: Express): void {
  // Brand assets
  app.get(
    ['/brand/logo.png', '/brand/mark.png'],
    asyncHandler(async (_req, res) => {
      const cfg = await getPublicSettings();
      if (cfg.logo && cfg.logo.startsWith('/media/')) {
        const mediaId = cfg.logo.slice('/media/'.length);
        if (/^[a-f0-9]{18}$/i.test(mediaId)) {
          const rec = await row<{ mime: string; data: Buffer | Uint8Array }>(
            'SELECT mime, data FROM media WHERE id = ?',
            mediaId,
          );
          if (rec) {
            res.setHeader('Content-Type', rec.mime);
            res.setHeader('Cache-Control', 'public, max-age=3600');
            res.send(Buffer.isBuffer(rec.data) ? rec.data : Buffer.from(rec.data));
            return;
          }
        }
      }
      if (fs.existsSync(BRAND_IMAGE_PATH)) {
        res.setHeader('Content-Type', 'image/svg+xml');
        res.setHeader('Cache-Control', 'public, max-age=86400');
        res.sendFile(BRAND_IMAGE_PATH);
        return;
      }
      res.status(404).end();
    }),
  );

  // Media & Video serving with HTTP Range support (for iOS Safari video playback)
  app.get(
    '/media/:id',
    asyncHandler(async (req, res) => {
      const id = String(req.params.id || '').toLowerCase();
      if (!/^[a-f0-9]{18}$/.test(id)) {
        res.status(404).json({ error: 'Media not found' });
        return;
      }
      const rec = await row<{ mime: string; size: number; data: Buffer | Uint8Array }>(
        'SELECT mime, size, data FROM media WHERE id = ?',
        id,
      );
      if (!rec) {
        res.status(404).json({ error: 'Media not found' });
        return;
      }
      const buf = Buffer.isBuffer(rec.data) ? rec.data : Buffer.from(rec.data);
      const total = buf.length;
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Type', rec.mime);

      const range = req.headers.range;
      if (range && range.startsWith('bytes=')) {
        const [startStr, endStr] = range.replace('bytes=', '').split('-');
        const start = startStr ? Math.max(0, parseInt(startStr, 10)) : 0;
        const end = endStr ? Math.min(total - 1, parseInt(endStr, 10)) : total - 1;
        if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
          res.status(416).setHeader('Content-Range', `bytes */${total}`).end();
          return;
        }
        const chunk = buf.subarray(start, end + 1);
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${total}`);
        res.setHeader('Content-Length', String(chunk.length));
        res.send(chunk);
        return;
      }

      res.setHeader('Content-Length', String(total));
      res.send(buf);
    }),
  );

  // Health check for deployment readiness probes
  app.get('/api/health', async (_req, res) => {
    try {
      await row('SELECT 1 as ok');
      res.json({
        ok: true,
        status: 'healthy',
        database: getDbBackend(),
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({ ok: false, status: 'unhealthy' });
    }
  });

  // SEO endpoints
  app.get('/robots.txt', (req, res) => {
    const base = getBaseUrl(req);
    res.type('text/plain').send(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /api/',
        'Disallow: /admin',
        `Sitemap: ${base}/sitemap.xml`,
      ].join('\n'),
    );
  });

  app.get(
    '/sitemap.xml',
    asyncHandler(async (req, res) => {
      const base = getBaseUrl(req);
      const products = await rows<{ id: string; updated_at: string }>(
        'SELECT id, updated_at FROM products WHERE avail = 1 ORDER BY updated_at DESC LIMIT 200',
      );
      const urls = [
        { loc: `${base}/`, lastmod: new Date().toISOString().slice(0, 10) },
        ...products.map((p) => ({
          loc: `${base}/#product=${encodeURIComponent(p.id)}`,
          lastmod: (p.updated_at || new Date().toISOString()).slice(0, 10),
        })),
      ];
      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls
          .map(
            (u) =>
              `  <url><loc>${escapeHtml(u.loc)}</loc><lastmod>${escapeHtml(u.lastmod)}</lastmod></url>`,
          )
          .join('\n') +
        `\n</urlset>`;
      res.type('application/xml').send(xml);
    }),
  );

  // Storefront Bootstrap & Catalog
  app.get(
    '/api/store/bootstrap',
    asyncHandler(async (req, res) => {
      const settings = await getPublicSettings();
      const categoryRows = await rows<DbCategoryRow>(
        'SELECT * FROM categories WHERE active = 1 ORDER BY sort_order ASC, created_at ASC',
      );
      const categories = categoryRows.map(mapCategory);
      const productRows = await rows<DbProductRow>(
        'SELECT * FROM products ORDER BY featured DESC, sales_count DESC, created_at DESC',
      );
      const products = productRows.map(mapProduct);

      const custSess = await getSession(req, 'customer');
      let customer: Customer | null = null;
      if (custSess) {
        const cRow = await row<{ id: string; name: string; phone: string; email: string; created_at: string }>(
          'SELECT id, name, phone, email, created_at FROM customers WHERE id = ?',
          custSess.subject_id,
        );
        if (cRow) {
          customer = {
            id: cRow.id,
            name: cRow.name,
            phone: cRow.phone,
            email: cRow.email,
            createdAt: cRow.created_at,
          };
        }
      }

      res.json({ settings, categories, products, customer });
    }),
  );

  app.get(
    '/api/categories',
    asyncHandler(async (_req, res) => {
      const categoryRows = await rows<DbCategoryRow>(
        'SELECT * FROM categories WHERE active = 1 ORDER BY sort_order ASC, created_at ASC',
      );
      res.json({ categories: categoryRows.map(mapCategory) });
    }),
  );

  app.get(
    '/api/products',
    asyncHandler(async (_req, res) => {
      const productRows = await rows<DbProductRow>(
        'SELECT * FROM products ORDER BY featured DESC, sales_count DESC, created_at DESC',
      );
      res.json({ products: productRows.map(mapProduct) });
    }),
  );

  app.get(
    '/api/products/:id',
    asyncHandler(async (req, res) => {
      const rec = await row<DbProductRow>('SELECT * FROM products WHERE id = ?', String(req.params.id));
      if (!rec) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      const reviewsData = await getProductReviews(rec.id);
      const prod = mapProduct(rec);
      prod.rating = reviewsData.averageRating;
      prod.reviewsCount = reviewsData.totalReviews;
      res.json({ product: prod, reviewsData });
    }),
  );

  // Product Reviews: Fetch all reviews and rating stats
  app.get(
    '/api/products/:id/reviews',
    asyncHandler(async (req, res) => {
      const pid = String(req.params.id || '');
      const data = await getProductReviews(pid);
      res.json(data);
    }),
  );

  // Product Reviews: Add customer review
  app.post(
    '/api/products/:id/reviews',
    rateLimit('product-review', 12, 60_000),
    asyncHandler(async (req, res) => {
      const pid = String(req.params.id || '');
      const prod = await row<{ id: string }>('SELECT id FROM products WHERE id = ?', pid);
      if (!prod) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      const body = req.body || {};
      const check = validateReviewInput(body);
      if (!check.ok) {
        res.status(400).json({ error: check.error });
        return;
      }

      const review = await addProductReview(pid, check.authorName, check.rating, check.comment);
      const updatedStats = await getProductReviews(pid);
      res.status(201).json({ review, ...updatedStats });
    }),
  );

  // Customer proof of payment upload (CCP / BaridiMob receipt image, up to 5MB)
  app.post(
    '/api/upload/proof',
    rateLimit('proof-upload', 20, 60_000),
    express.json({ limit: '7mb' }),
    asyncHandler(async (req, res) => {
      const { dataUrl } = req.body || {};
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
        res.status(400).json({ error: 'Invalid image payload' });
        return;
      }
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx === -1) {
        res.status(400).json({ error: 'Malformed data URL' });
        return;
      }
      const buf = Buffer.from(dataUrl.slice(commaIdx + 1), 'base64');
      if (buf.length === 0 || buf.length > 5 * 1024 * 1024) {
        res.status(400).json({ error: 'Image must be under 5MB' });
        return;
      }
      const mime = detectImageMime(buf);
      if (!mime) {
        res.status(400).json({ error: 'Unsupported image format (JPEG, PNG, WEBP, GIF only)' });
        return;
      }
      const id = crypto.randomBytes(9).toString('hex');
      await run(
        'INSERT INTO media (id, mime, size, data, created_at) VALUES (?, ?, ?, ?, ?)',
        id,
        mime,
        buf.length,
        buf,
        new Date().toISOString(),
      );
      res.status(201).json({ id, url: `/media/${id}` });
    }),
  );

  // Create order (server re-computes prices, validates payment intersection & billRef)
  app.post(
    '/api/orders',
    rateLimit('create-order', 15, 60_000),
    asyncHandler(async (req, res) => {
      const body = req.body || {};
      const customerName = String(body.customerName || '').trim();
      const customerPhone = String(body.customerPhone || '').trim();
      const wilaya = String(body.wilaya || 'Tipaza').trim();
      const address = String(body.address || '').trim();
      const paymentMethod = String(body.paymentMethod || '') as PaymentMethod;
      const billRef = String(body.billRef || '').trim();
      const proofMediaId = String(body.proofMediaId || '').trim();
      const notes = String(body.notes || '').trim();
      const lang: Lang = body.lang === 'fr' ? 'fr' : 'ar';
      const rawItems = Array.isArray(body.items) ? body.items : [];

      if (!customerName || customerName.length < 2) {
        res.status(400).json({ error: 'Customer name is required' });
        return;
      }
      if (!isValidAlgerianPhone(customerPhone)) {
        res.status(400).json({ error: 'Valid Algerian phone number is required' });
        return;
      }
      if (!rawItems.length) {
        res.status(400).json({ error: 'Cart is empty' });
        return;
      }
      if (!['cod', 'ccp', 'chargily'].includes(paymentMethod)) {
        res.status(400).json({ error: 'Invalid payment method' });
        return;
      }

      const cartItems: CartItem[] = [];
      const snapshots: OrderItemSnapshot[] = [];

      for (const entry of rawItems) {
        const pid = String(entry?.productId || '');
        const qty = Math.max(1, Math.min(99, Math.floor(Number(entry?.qty) || 1)));
        const planId = entry?.planId ? String(entry.planId) : undefined;
        const pRow = await row<DbProductRow>('SELECT * FROM products WHERE id = ?', pid);
        if (!pRow) {
          res.status(400).json({ error: `Product ${pid} does not exist` });
          return;
        }
        const product = mapProduct(pRow);
        if (!product.avail) {
          res.status(400).json({ error: `Product ${product.name.ar} is currently unavailable` });
          return;
        }
        const { price, plan } = resolveItemUnitPrice(product, planId);
        cartItems.push({ product, planId: plan?.id, qty });
        snapshots.push({
          productId: product.id,
          name: product.name,
          type: product.type,
          cat: product.cat,
          planId: plan?.id,
          planLabel: plan?.label,
          unitPrice: price,
          qty,
          needsRef: product.needsRef,
          pays: product.pays,
        });
      }

      const payCheck = computeAllowedPayments(cartItems);
      if (payCheck.conflict || !payCheck.methods.includes(paymentMethod)) {
        res.status(400).json({ error: 'Selected payment method is not valid for these cart items' });
        return;
      }

      if (requiresBillRef(cartItems) && !billRef) {
        res.status(400).json({ error: 'Bill reference / Account ID is required for bill services' });
        return;
      }

      if (paymentMethod === 'ccp' && proofMediaId && !/^[a-f0-9]{18}$/.test(proofMediaId)) {
        res.status(400).json({ error: 'Invalid proof media reference' });
        return;
      }

      const totals = calculateCartTotals(cartItems);
      const custSess = await getSession(req, 'customer');
      const orderId = crypto.randomUUID();
      const shortNum = crypto.randomInt(1000, 9999);
      const code = `SLM-${shortNum}${crypto.randomBytes(1).toString('hex').toUpperCase()}`;
      const now = new Date().toISOString();
      const paymentStatus: PaymentStatus = paymentMethod === 'ccp' && proofMediaId ? 'pending_review' : 'unpaid';

      let chargilyCheckoutId = '';
      let checkoutUrl = '';

      if (paymentMethod === 'chargily') {
        const integrations = await getIntegrations();
        if (integrations.chargilySecretKey) {
          const endpoint =
            integrations.chargilyMode === 'live'
              ? 'https://pay.chargily.net/api/v2/checkouts'
              : 'https://pay.chargily.net/test/api/v2/checkouts';
          const base = getBaseUrl(req);
          try {
            const cgResp = await fetch(endpoint, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${integrations.chargilySecretKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                amount: Math.round(totals.subtotal),
                currency: 'dzd',
                success_url: `${base}/#track=${encodeURIComponent(code)}`,
                failure_url: `${base}/#track=${encodeURIComponent(code)}`,
                webhook_endpoint: `${base}/api/chargily/webhook`,
                metadata: { orderCode: code, orderId },
              }),
              signal: AbortSignal.timeout(12_000),
            });
            if (!cgResp.ok) {
              res.status(502).json({ error: 'Chargily payment gateway returned an error. Please retry.' });
              return;
            }
            const cgData = (await cgResp.json()) as { id?: string; checkout_url?: string };
            chargilyCheckoutId = cgData.id || '';
            checkoutUrl = cgData.checkout_url || '';
            if (!checkoutUrl) {
              res.status(502).json({ error: 'Chargily checkout URL unavailable. Please retry.' });
              return;
            }
          } catch {
            res.status(502).json({ error: 'Unable to reach Chargily payment gateway. Please retry.' });
            return;
          }
        }
      }

      const created = await withTransaction(async () => {
        await run(
          `INSERT INTO orders (
            id, code, customer_id, customer_name, customer_phone, wilaya, address,
            items_json, subtotal, payment_method, payment_status, status,
            bill_ref, proof_media_id, delivery_data, chargily_checkout_id, notes, lang, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          orderId,
          code,
          custSess?.subject_id || null,
          customerName,
          customerPhone,
          wilaya,
          address,
          JSON.stringify(snapshots),
          totals.subtotal,
          paymentMethod,
          paymentStatus,
          'pending',
          billRef,
          proofMediaId,
          '',
          chargilyCheckoutId,
          notes,
          lang,
          now,
          now,
        );

        for (const item of cartItems) {
          await run('UPDATE products SET sales_count = sales_count + ? WHERE id = ?', item.qty, item.product.id);
        }

        return row<DbOrderRow>('SELECT * FROM orders WHERE id = ?', orderId);
      });

      res.status(201).json({
        order: created ? mapOrder(created) : null,
        checkoutUrl,
      });
    }),
  );

  // Public Order Tracking (requires code + matching phone suffix/digits)
  app.post(
    '/api/orders/track',
    rateLimit('track-order', 30, 60_000),
    asyncHandler(async (req, res) => {
      const code = String(req.body?.code || '').trim().toUpperCase();
      const phone = String(req.body?.phone || '').replace(/\D/g, '');
      if (!code || !phone) {
        res.status(400).json({ error: 'Order code and phone number are required' });
        return;
      }
      const rec = await row<DbOrderRow>('SELECT * FROM orders WHERE UPPER(code) = ?', code);
      if (!rec) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      const storedDigits = rec.customer_phone.replace(/\D/g, '');
      if (storedDigits.slice(-8) !== phone.slice(-8)) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      res.json({ order: mapOrder(rec) });
    }),
  );

  // Chargily Pay Webhook (HMAC-SHA256 verified)
  app.post(
    '/api/chargily/webhook',
    express.raw({ type: 'application/json' }),
    asyncHandler(async (req, res) => {
      const { chargilySecretKey } = await getIntegrations();
      if (!chargilySecretKey) {
        res.status(503).json({ error: 'Chargily secret key not configured' });
        return;
      }
      const signature = String(req.headers.signature || '').trim().toLowerCase();
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));
      const computed = crypto.createHmac('sha256', chargilySecretKey).update(rawBody).digest('hex');
      const sigBuf = Buffer.from(signature, 'utf8');
      const compBuf = Buffer.from(computed, 'utf8');
      if (!signature || sigBuf.length !== compBuf.length || !crypto.timingSafeEqual(sigBuf, compBuf)) {
        res.status(403).json({ error: 'Invalid webhook signature' });
        return;
      }
      try {
        const event = JSON.parse(rawBody.toString('utf8'));
        const orderId = event?.data?.metadata?.orderId;
        const checkoutId = String(event?.data?.id || '');
        const status = String(event?.type || '');
        if (orderId) {
          const existingOrder = await row<{ id: string; chargily_checkout_id: string; payment_status: string }>(
            'SELECT id, chargily_checkout_id, payment_status FROM orders WHERE id = ?',
            String(orderId),
          );
          if (existingOrder) {
            const checkoutMatches =
              !existingOrder.chargily_checkout_id || !checkoutId || existingOrder.chargily_checkout_id === checkoutId;
            if (checkoutMatches) {
              if (status === 'checkout.paid') {
                await run(
                  "UPDATE orders SET payment_status = 'paid', status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END, updated_at = ? WHERE id = ?",
                  new Date().toISOString(),
                  existingOrder.id,
                );
              } else if (
                (status === 'checkout.failed' || status === 'checkout.canceled' || status === 'checkout.expired') &&
                existingOrder.payment_status !== 'paid'
              ) {
                await run(
                  "UPDATE orders SET payment_status = 'failed', updated_at = ? WHERE id = ?",
                  new Date().toISOString(),
                  existingOrder.id,
                );
              }
            }
          }
        }
        res.json({ received: true });
      } catch {
        res.status(400).json({ error: 'Invalid JSON payload' });
      }
    }),
  );

  // Customer Accounts
  app.post(
    '/api/customer/register',
    rateLimit('cust-register', 10, 60_000),
    asyncHandler(async (req, res) => {
      const name = String(req.body?.name || '').trim();
      const phone = String(req.body?.phone || '').trim();
      const email = String(req.body?.email || '').trim();
      const password = String(req.body?.password || '');

      if (!name || !isValidAlgerianPhone(phone) || password.length < 6) {
        res.status(400).json({ error: 'Valid name, Algerian phone, and password (6+ chars) required' });
        return;
      }

      const exists = await row('SELECT id FROM customers WHERE phone = ?', phone);
      if (exists) {
        res.status(409).json({ error: 'Phone number already registered' });
        return;
      }

      const id = crypto.randomUUID();
      const now = new Date().toISOString();
      await run(
        'INSERT INTO customers (id, name, phone, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        id,
        name,
        phone,
        email,
        hashPassword(password),
        now,
      );
      const token = await createSession('customer', id, phone, 'customer');
      setSessionCookie(res, req, CUSTOMER_COOKIE, token);
      res.status(201).json({ customer: { id, name, phone, email, createdAt: now } });
    }),
  );

  app.post(
    '/api/customer/login',
    rateLimit('cust-login', 12, 60_000),
    asyncHandler(async (req, res) => {
      const phone = String(req.body?.phone || '').trim();
      const password = String(req.body?.password || '');
      const cust = await row<{
        id: string;
        name: string;
        phone: string;
        email: string;
        password_hash: string;
        created_at: string;
      }>('SELECT * FROM customers WHERE phone = ?', phone);

      if (!cust || !verifyPassword(password, cust.password_hash)) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
      const token = await createSession('customer', cust.id, cust.phone, 'customer');
      setSessionCookie(res, req, CUSTOMER_COOKIE, token);
      res.json({
        customer: {
          id: cust.id,
          name: cust.name,
          phone: cust.phone,
          email: cust.email,
          createdAt: cust.created_at,
        },
      });
    }),
  );

  app.post(
    '/api/customer/logout',
    asyncHandler(async (req, res) => {
      const sess = await getSession(req, 'customer');
      if (sess) await deleteSession(sess.token);
      clearSessionCookie(res, req, CUSTOMER_COOKIE);
      res.json({ ok: true });
    }),
  );

  app.get(
    '/api/customer/orders',
    asyncHandler(async (req, res) => {
      const sess = await getSession(req, 'customer');
      if (!sess) {
        res.status(401).json({ error: 'Sign in required' });
        return;
      }
      const cust = await row<{ phone: string }>('SELECT phone FROM customers WHERE id = ?', sess.subject_id);
      if (!cust) {
        res.status(401).json({ error: 'Account not found' });
        return;
      }
      const list = await rows<DbOrderRow>(
        'SELECT * FROM orders WHERE customer_id = ? OR customer_phone = ? ORDER BY created_at DESC',
        sess.subject_id,
        cust.phone,
      );
      res.json({ orders: list.map(mapOrder) });
    }),
  );

  // Admin Auth
  app.get(
    '/api/admin/status',
    asyncHandler(async (req, res) => {
      const sess = await getSession(req, 'admin');
      const user = sess ? await resolveAdminUserFromSession(sess) : null;
      res.json({
        authenticated: Boolean(user),
        needsClaim: await ownerNeedsClaim(),
        envPasswordActive: isOwnerEnvPasswordSet(),
        user,
        token: sess?.token || null,
      });
    }),
  );

  // One-time atomic first-run owner claim when OWNER_PASSWORD env is unset
  app.post(
    '/api/admin/claim',
    rateLimit('admin-claim', 10, 60_000),
    asyncHandler(async (req, res) => {
      if (isOwnerEnvPasswordSet()) {
        res.status(403).json({ error: 'Owner password is managed by environment variable' });
        return;
      }
      const password = String(req.body?.password || '');
      if (password.length < 8) {
        res.status(400).json({ error: 'Password must be at least 8 characters' });
        return;
      }

      const claimed = await withTransaction(async () => {
        const existingOwner = await row<{ id: string }>(
          'SELECT id FROM users WHERE username = ? AND role = ?',
          'owner',
          'owner',
        );
        if (existingOwner) return null;

        const id = 'owner-db';
        const now = new Date().toISOString();
        const allPerms: StaffPermission[] = ['orders', 'products', 'subscriptions', 'settings', 'staff', 'audit'];
        await run(
          `INSERT INTO users (id, username, display_name, role, password_hash, permissions_json, active, created_at)
           VALUES (?, 'owner', 'المالك | Owner', 'owner', ?, ?, 1, ?)`,
          id,
          hashPassword(password),
          JSON.stringify(allPerms),
          now,
        );
        const token = await createSession('admin', id, 'owner', 'owner');
        await audit('owner', 'owner', 'claim_owner', 'user', id, {}, getClientIp(req));
        return { id, now, allPerms, token };
      });

      if (!claimed) {
        res.status(403).json({ error: 'Owner account is already claimed' });
        return;
      }

      setSessionCookie(res, req, ADMIN_COOKIE, claimed.token);
      res.status(201).json({
        token: claimed.token,
        user: {
          id: claimed.id,
          username: 'owner',
          displayName: 'المالك | Owner',
          role: 'owner',
          permissions: claimed.allPerms,
          active: true,
          createdAt: claimed.now,
        },
      });
    }),
  );

  app.post(
    '/api/login',
    rateLimit('admin-login', 12, 60_000),
    asyncHandler(async (req, res) => {
      const username = String(req.body?.username || '').trim();
      const password = String(req.body?.password || '');
      if (!username || !password) {
        res.status(400).json({ error: 'Username and password required' });
        return;
      }
      const user = await verifyAdminLogin(username, password);
      if (!user) {
        res.status(401).json({ error: 'Invalid username or password' });
        return;
      }
      const token = await createSession('admin', user.id, user.username, user.role);
      setSessionCookie(res, req, ADMIN_COOKIE, token);
      await audit(user.username, user.role, 'login', 'session', user.id, {}, getClientIp(req));
      res.json({ user, token });
    }),
  );

  app.post(
    '/api/logout',
    asyncHandler(async (req, res) => {
      const sess = await getSession(req, 'admin');
      if (sess) await deleteSession(sess.token);
      await run("DELETE FROM sessions WHERE kind = 'admin'");
      clearSessionCookie(res, req, ADMIN_COOKIE);
      res.json({ ok: true });
    }),
  );

  // Admin Dashboard KPIs (accessible to owner and all active staff, including revenue)
  app.get(
    '/api/admin/dashboard',
    requireAdmin(),
    asyncHandler(async (_req, res) => {
      const allOrders = await rows<DbOrderRow>('SELECT * FROM orders ORDER BY created_at DESC');
      const revenue = allOrders
        .filter((o) => o.status !== 'cancelled' && (o.payment_status === 'paid' || o.status === 'delivered' || o.status === 'confirmed'))
        .reduce((acc, o) => acc + Number(o.subtotal), 0);
      const pendingOrders = allOrders.filter((o) => o.status === 'pending' || o.status === 'processing').length;
      const totalProductsRow = await row<{ cnt: number | string }>('SELECT COUNT(*) as cnt FROM products');
      const totalProducts = Number(totalProductsRow?.cnt || 0);

      const now = Date.now();
      const sevenDays = now + 7 * 86400_000;
      const subs = await rows<{ end_date: string; status: string }>('SELECT end_date, status FROM subscriptions');
      const expiringSubs = subs.filter((s) => {
        if (s.status === 'cancelled' || s.status === 'expired') return false;
        const t = new Date(s.end_date).getTime();
        return !Number.isNaN(t) && t <= sevenDays;
      }).length;

      res.json({
        kpis: {
          totalRevenue: revenue,
          totalOrders: allOrders.length,
          pendingOrders,
          expiringSubs,
          totalProducts,
        },
        recentOrders: allOrders.slice(0, 8).map(mapOrder),
      });
    }),
  );

  // Admin Orders
  app.get(
    '/api/admin/orders',
    requireAdmin('orders'),
    asyncHandler(async (_req, res) => {
      const list = await rows<DbOrderRow>('SELECT * FROM orders ORDER BY created_at DESC');
      res.json({ orders: list.map(mapOrder) });
    }),
  );

  app.get(
    '/api/admin/orders/export',
    requireAdmin('orders'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const list = (await rows<DbOrderRow>('SELECT * FROM orders ORDER BY created_at DESC')).map(mapOrder);
      const csv = formatOrdersCsv(list);
      await audit(actor.username, actor.role, 'export_orders_csv', 'orders', 'all', { count: list.length }, getClientIp(req));
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="slimi-orders.csv"');
      res.send(csv);
    }),
  );

  app.patch(
    '/api/admin/orders/:id',
    requireAdmin('orders'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const id = String(req.params.id);
      const existing = await row<DbOrderRow>('SELECT * FROM orders WHERE id = ?', id);
      if (!existing) {
        res.status(404).json({ error: 'Order not found' });
        return;
      }
      const status = req.body?.status ? (String(req.body.status) as OrderStatus) : existing.status;
      const paymentStatus = req.body?.paymentStatus
        ? (String(req.body.paymentStatus) as PaymentStatus)
        : existing.payment_status;
      const deliveryData =
        req.body?.deliveryData !== undefined ? String(req.body.deliveryData) : existing.delivery_data;
      const notes = req.body?.notes !== undefined ? String(req.body.notes) : existing.notes;
      const now = new Date().toISOString();

      await run(
        'UPDATE orders SET status = ?, payment_status = ?, delivery_data = ?, notes = ?, updated_at = ? WHERE id = ?',
        status,
        paymentStatus,
        deliveryData,
        notes,
        now,
        id,
      );
      await audit(actor.username, actor.role, 'update_order', 'order', existing.code, { status, paymentStatus }, getClientIp(req));
      const updated = await row<DbOrderRow>('SELECT * FROM orders WHERE id = ?', id);
      res.json({ order: updated ? mapOrder(updated) : null });
    }),
  );

  // Bulk Order Status Update
  app.patch(
    '/api/admin/orders/bulk-status',
    requireAdmin('orders'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const ids = Array.isArray(req.body?.ids)
        ? req.body.ids.map((v: unknown) => String(v || '').trim()).filter(Boolean).slice(0, 100)
        : [];
      const status = String(req.body?.status || '') as OrderStatus;
      const validStatuses: OrderStatus[] = ['pending', 'confirmed', 'processing', 'delivered', 'cancelled'];
      if (ids.length === 0 || !validStatuses.includes(status)) {
        res.status(400).json({ error: 'Valid order IDs and target status are required' });
        return;
      }
      const now = new Date().toISOString();
      const updatedCount = await withTransaction(async () => {
        let count = 0;
        for (const id of ids) {
          const result = await run('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?', status, now, id);
          count += Number(result.changes || 0);
        }
        return count;
      });
      await audit(
        actor.username,
        actor.role,
        'bulk_update_order_status',
        'orders',
        String(updatedCount),
        { status, count: updatedCount },
        getClientIp(req),
      );
      res.json({ ok: true, updatedCount });
    }),
  );

  // Admin Customers Directory (never exposes password_hash)
  app.get(
    '/api/admin/customers',
    requireAdmin('orders'),
    asyncHandler(async (_req, res) => {
      const customerRows = await rows<{
        id: string;
        name: string;
        phone: string;
        email: string;
        created_at: string;
      }>('SELECT id, name, phone, email, created_at FROM customers ORDER BY created_at DESC');

      const allOrders = await rows<{
        customer_id: string | null;
        customer_phone: string;
        subtotal: number;
        status: OrderStatus;
        created_at: string;
      }>('SELECT customer_id, customer_phone, subtotal, status, created_at FROM orders ORDER BY created_at DESC');

      const customers: AdminCustomerSummary[] = customerRows.map((c) => {
        const custOrders = allOrders.filter(
          (o) => o.customer_id === c.id || (o.customer_phone && o.customer_phone === c.phone),
        );
        const totalSpent = custOrders
          .filter((o) => o.status !== 'cancelled')
          .reduce((sum, o) => sum + Number(o.subtotal || 0), 0);
        return {
          id: c.id,
          name: c.name,
          phone: c.phone,
          email: c.email || '',
          createdAt: c.created_at,
          ordersCount: custOrders.length,
          totalSpent,
          lastOrderAt: custOrders[0]?.created_at || null,
        };
      });

      res.json({ customers });
    }),
  );

  // Admin Reviews Moderation
  app.get(
    '/api/admin/reviews',
    requireAdmin('products'),
    asyncHandler(async (_req, res) => {
      const list = await rows<{
        id: string;
        product_id: string;
        author_name: string;
        rating: number;
        comment: string;
        created_at: string;
        product_name_json: string | null;
        product_cat: string | null;
      }>(
        `SELECT r.id, r.product_id, r.author_name, r.rating, r.comment, r.created_at,
                p.name_json as product_name_json, p.cat as product_cat
         FROM reviews r
         LEFT JOIN products p ON p.id = r.product_id
         ORDER BY r.created_at DESC`,
      );

      const reviews: AdminReviewEntry[] = list.map((r) => {
        let productName = { ar: r.product_id, fr: r.product_id };
        if (r.product_name_json) {
          try {
            productName = JSON.parse(r.product_name_json);
          } catch {
            // keep fallback
          }
        }
        return {
          id: r.id,
          productId: r.product_id,
          authorName: r.author_name,
          rating: Number(r.rating),
          comment: r.comment || '',
          createdAt: r.created_at,
          productName,
          productCat: r.product_cat || 'shop',
        };
      });

      const stats = computeReviewStats(reviews);
      res.json({ reviews, ...stats });
    }),
  );

  app.delete(
    '/api/admin/reviews/:id',
    requireAdmin('products'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const id = String(req.params.id || '').trim();
      const existing = await row<{ id: string; product_id: string }>('SELECT id, product_id FROM reviews WHERE id = ?', id);
      if (!existing) {
        res.status(404).json({ error: 'Review not found' });
        return;
      }
      await run('DELETE FROM reviews WHERE id = ?', id);
      await audit(actor.username, actor.role, 'delete_review', 'review', id, { productId: existing.product_id }, getClientIp(req));
      res.json({ ok: true });
    }),
  );

  // Admin Categories CRUD
  app.get(
    '/api/admin/categories',
    requireAdmin('products'),
    asyncHandler(async (_req, res) => {
      const list = await rows<DbCategoryRow>(
        `SELECT c.*, COALESCE(pc.cnt, 0) as product_count
         FROM categories c
         LEFT JOIN (SELECT cat, COUNT(*) as cnt FROM products GROUP BY cat) pc ON pc.cat = c.id
         ORDER BY c.sort_order ASC, c.created_at ASC`,
      );
      res.json({ categories: list.map(mapCategory) });
    }),
  );

  app.post(
    '/api/admin/categories',
    requireAdmin('products'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const body = req.body || {};
      const nameAr = String(body.name?.ar || body.nameAr || '').trim().slice(0, 100);
      const nameFr = String(body.name?.fr || body.nameFr || nameAr).trim().slice(0, 100);
      const descAr = String(body.desc?.ar || body.descAr || '').trim().slice(0, 320);
      const descFr = String(body.desc?.fr || body.descFr || descAr).trim().slice(0, 320);
      const icon = CATEGORY_ICONS.includes(body.icon as CategoryIconName)
        ? (body.icon as CategoryIconName)
        : 'package';
      const img = String(body.img || '').trim();
      const active = body.active !== undefined ? Boolean(body.active) : true;
      const maxOrderRow = await row<{ m: number | string | null }>('SELECT MAX(sort_order) as m FROM categories');
      const maxOrder = Number(maxOrderRow?.m ?? 0);
      const sortOrder =
        body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))
          ? Math.max(0, Math.min(999, Math.floor(Number(body.sortOrder))))
          : maxOrder + 1;

      if (!nameAr) {
        res.status(400).json({ error: 'Arabic category name is required' });
        return;
      }
      if (!isSafeImageRef(img)) {
        res.status(400).json({ error: 'Invalid category image reference' });
        return;
      }

      const id = 'cat_' + crypto.randomBytes(4).toString('hex');
      const now = new Date().toISOString();
      await run(
        `INSERT INTO categories (id, name_json, desc_json, icon, img, sort_order, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        JSON.stringify({ ar: nameAr, fr: nameFr }),
        JSON.stringify({ ar: descAr, fr: descFr }),
        icon,
        img,
        sortOrder,
        active ? 1 : 0,
        now,
      );
      await audit(actor.username, actor.role, 'create_category', 'category', id, { name: nameAr }, getClientIp(req));
      const created = await row<DbCategoryRow>('SELECT *, 0 as product_count FROM categories WHERE id = ?', id);
      res.status(201).json({ category: created ? mapCategory(created) : null });
    }),
  );

  app.put(
    '/api/admin/categories/:id',
    requireAdmin('products'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const id = String(req.params.id);
      if (!/^[a-z0-9_-]{2,40}$/i.test(id)) {
        res.status(400).json({ error: 'Invalid category id' });
        return;
      }
      const existing = await row<DbCategoryRow>('SELECT * FROM categories WHERE id = ?', id);
      if (!existing) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }
      const prev = mapCategory(existing);
      const body = req.body || {};
      const nameAr = String(body.name?.ar ?? prev.name.ar).trim().slice(0, 100);
      const nameFr = String(body.name?.fr ?? prev.name.fr).trim().slice(0, 100) || nameAr;
      const descAr = String(body.desc?.ar ?? prev.desc.ar).trim().slice(0, 320);
      const descFr = String(body.desc?.fr ?? prev.desc.fr).trim().slice(0, 320);
      const icon = CATEGORY_ICONS.includes(body.icon as CategoryIconName)
        ? (body.icon as CategoryIconName)
        : prev.icon;
      const img = body.img !== undefined ? String(body.img || '').trim() : prev.img;
      const sortOrder =
        body.sortOrder !== undefined && Number.isFinite(Number(body.sortOrder))
          ? Math.max(0, Math.min(999, Math.floor(Number(body.sortOrder))))
          : prev.sortOrder;
      const active = body.active !== undefined ? Boolean(body.active) : prev.active;

      if (!nameAr) {
        res.status(400).json({ error: 'Arabic category name is required' });
        return;
      }
      if (!isSafeImageRef(img)) {
        res.status(400).json({ error: 'Invalid category image reference' });
        return;
      }

      await run(
        `UPDATE categories
         SET name_json = ?, desc_json = ?, icon = ?, img = ?, sort_order = ?, active = ?
         WHERE id = ?`,
        JSON.stringify({ ar: nameAr, fr: nameFr }),
        JSON.stringify({ ar: descAr, fr: descFr }),
        icon,
        img,
        sortOrder,
        active ? 1 : 0,
        id,
      );
      await audit(actor.username, actor.role, 'update_category', 'category', id, { name: nameAr }, getClientIp(req));
      const updated = await row<DbCategoryRow>(
        `SELECT c.*, COALESCE((SELECT COUNT(*) FROM products WHERE cat = c.id), 0) as product_count
         FROM categories c WHERE c.id = ?`,
        id,
      );
      res.json({ category: updated ? mapCategory(updated) : null });
    }),
  );

  app.delete(
    '/api/admin/categories/:id',
    requireAdmin('products'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const id = String(req.params.id);
      if (!/^[a-z0-9_-]{2,40}$/i.test(id)) {
        res.status(400).json({ error: 'Invalid category id' });
        return;
      }
      const usedRow = await row<{ cnt: number | string }>('SELECT COUNT(*) as cnt FROM products WHERE cat = ?', id);
      const used = Number(usedRow?.cnt || 0);
      if (used > 0) {
        res.status(400).json({
          error: 'لا يمكن حذف قسم يحتوي على منتجات. انقل أو احذف المنتجات المرتبطة به أولًا.',
        });
        return;
      }
      await run('DELETE FROM categories WHERE id = ?', id);
      await audit(actor.username, actor.role, 'delete_category', 'category', id, {}, getClientIp(req));
      res.json({ ok: true });
    }),
  );

  // Admin Products CRUD
  app.get(
    '/api/admin/products',
    requireAdmin('products'),
    asyncHandler(async (_req, res) => {
      const list = await rows<DbProductRow>('SELECT * FROM products ORDER BY created_at DESC');
      res.json({ products: list.map(mapProduct) });
    }),
  );

  app.post(
    '/api/admin/products',
    requireAdmin('products'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const body = req.body || {};
      const requestedCat = String(body.cat || '').trim();
      const validCat = await row<{ id: string }>('SELECT id FROM categories WHERE id = ?', requestedCat);
      const firstCat = await row<{ id: string }>('SELECT id FROM categories ORDER BY sort_order ASC LIMIT 1');
      const cat = (validCat?.id || firstCat?.id || 'shop') as CategoryId;
      const type = (body.type === 'digital' ? 'digital' : 'physical') as ProductType;
      const name = {
        ar: String(body.name?.ar || body.nameAr || '').trim(),
        fr: String(body.name?.fr || body.nameFr || body.name?.ar || '').trim(),
      };
      const desc = {
        ar: String(body.desc?.ar || body.descAr || '').trim(),
        fr: String(body.desc?.fr || body.descFr || '').trim(),
      };
      const price = Math.max(0, Number(body.price) || 0);
      const old = body.old != null && body.old !== '' ? Math.max(0, Number(body.old)) : null;
      const avail = body.avail !== undefined ? Boolean(body.avail) : true;
      const img = String(body.img || '').trim();
      const needsRef = Boolean(body.needsRef);
      const featured = Boolean(body.featured);
      const rawPays = Array.isArray(body.pays) ? body.pays : type === 'digital' ? ['ccp', 'chargily'] : ['cod', 'ccp', 'chargily'];
      const pays: PaymentMethod[] = rawPays.filter((p: string): p is PaymentMethod =>
        ['cod', 'ccp', 'chargily'].includes(p),
      );
      const plans: ProductPlan[] = Array.isArray(body.plans)
        ? body.plans
            .filter((pl: ProductPlan) => pl && (pl.label?.ar || pl.label?.fr))
            .map((pl: ProductPlan) => ({
              id: String(pl.id || crypto.randomBytes(4).toString('hex')),
              label: { ar: String(pl.label?.ar || ''), fr: String(pl.label?.fr || pl.label?.ar || '') },
              price: Math.max(0, Number(pl.price) || 0),
              oldPrice: pl.oldPrice != null ? Math.max(0, Number(pl.oldPrice)) : null,
            }))
        : [];

      if (!name.ar) {
        res.status(400).json({ error: 'Arabic product name is required' });
        return;
      }

      const id = 'prd_' + crypto.randomBytes(6).toString('hex');
      const now = new Date().toISOString();
      await run(
        `INSERT INTO products (
          id, cat, type, name_json, desc_json, price, old_price, avail, img,
          needs_ref, pays_json, plans_json, featured, sales_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        id,
        cat,
        type,
        JSON.stringify(name),
        JSON.stringify(desc),
        price,
        old,
        avail ? 1 : 0,
        img,
        needsRef ? 1 : 0,
        JSON.stringify(pays.length ? pays : ['ccp']),
        JSON.stringify(plans),
        featured ? 1 : 0,
        now,
        now,
      );
      await audit(actor.username, actor.role, 'create_product', 'product', id, { name: name.ar, price }, getClientIp(req));
      const created = await row<DbProductRow>('SELECT * FROM products WHERE id = ?', id);
      res.status(201).json({ product: created ? mapProduct(created) : null });
    }),
  );

  app.put(
    '/api/admin/products/:id',
    requireAdmin('products'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const id = String(req.params.id);
      const existing = await row<DbProductRow>('SELECT * FROM products WHERE id = ?', id);
      if (!existing) {
        res.status(404).json({ error: 'Product not found' });
        return;
      }
      const prev = mapProduct(existing);
      const body = req.body || {};
      const requestedCat = String(body.cat || '').trim();
      const validCat = requestedCat
        ? await row<{ id: string }>('SELECT id FROM categories WHERE id = ?', requestedCat)
        : undefined;
      const cat = (validCat?.id || prev.cat) as CategoryId;
      const type = (body.type === 'digital' || body.type === 'physical' ? body.type : prev.type) as ProductType;
      const name = {
        ar: String(body.name?.ar ?? prev.name.ar).trim(),
        fr: String(body.name?.fr ?? prev.name.fr).trim(),
      };
      const desc = {
        ar: String(body.desc?.ar ?? prev.desc.ar).trim(),
        fr: String(body.desc?.fr ?? prev.desc.fr).trim(),
      };
      const price = body.price !== undefined ? Math.max(0, Number(body.price) || 0) : prev.price;
      const old = body.old !== undefined ? (body.old != null && body.old !== '' ? Math.max(0, Number(body.old)) : null) : prev.old;
      const avail = body.avail !== undefined ? Boolean(body.avail) : prev.avail;
      const img = body.img !== undefined ? String(body.img || '').trim() : prev.img;
      const needsRef = body.needsRef !== undefined ? Boolean(body.needsRef) : prev.needsRef;
      const featured = body.featured !== undefined ? Boolean(body.featured) : prev.featured;
      const pays: PaymentMethod[] = Array.isArray(body.pays)
        ? body.pays.filter((p: string): p is PaymentMethod => ['cod', 'ccp', 'chargily'].includes(p))
        : prev.pays;
      const plans: ProductPlan[] = Array.isArray(body.plans)
        ? body.plans.map((pl: ProductPlan) => ({
            id: String(pl.id || crypto.randomBytes(4).toString('hex')),
            label: { ar: String(pl.label?.ar || ''), fr: String(pl.label?.fr || pl.label?.ar || '') },
            price: Math.max(0, Number(pl.price) || 0),
            oldPrice: pl.oldPrice != null ? Math.max(0, Number(pl.oldPrice)) : null,
          }))
        : prev.plans;

      const now = new Date().toISOString();
      await run(
        `UPDATE products SET
          cat = ?, type = ?, name_json = ?, desc_json = ?, price = ?, old_price = ?,
          avail = ?, img = ?, needs_ref = ?, pays_json = ?, plans_json = ?, featured = ?, updated_at = ?
         WHERE id = ?`,
        cat,
        type,
        JSON.stringify(name),
        JSON.stringify(desc),
        price,
        old,
        avail ? 1 : 0,
        img,
        needsRef ? 1 : 0,
        JSON.stringify(pays.length ? pays : ['ccp']),
        JSON.stringify(plans),
        featured ? 1 : 0,
        now,
        id,
      );
      await audit(actor.username, actor.role, 'update_product', 'product', id, { name: name.ar }, getClientIp(req));
      const updated = await row<DbProductRow>('SELECT * FROM products WHERE id = ?', id);
      res.json({ product: updated ? mapProduct(updated) : null });
    }),
  );

  app.delete(
    '/api/admin/products/:id',
    requireAdmin('products'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const id = String(req.params.id);
      await run('DELETE FROM products WHERE id = ?', id);
      await audit(actor.username, actor.role, 'delete_product', 'product', id, {}, getClientIp(req));
      res.json({ ok: true });
    }),
  );

  // Admin Subscriptions tracker
  app.get(
    '/api/admin/subscriptions',
    requireAdmin('subscriptions'),
    asyncHandler(async (_req, res) => {
      const list = await rows<{
        id: string;
        order_id: string | null;
        order_code: string;
        customer_name: string;
        customer_phone: string;
        service_name: string;
        plan_label: string;
        account_info: string;
        start_date: string;
        end_date: string;
        status: 'active' | 'expiring' | 'expired' | 'cancelled';
        notes: string;
        created_at: string;
      }>('SELECT * FROM subscriptions ORDER BY end_date ASC');

      const subscriptions: SubscriptionRecord[] = list.map((s) => ({
        id: s.id,
        orderId: s.order_id,
        orderCode: s.order_code,
        customerName: s.customer_name,
        customerPhone: s.customer_phone,
        serviceName: s.service_name,
        planLabel: s.plan_label,
        accountInfo: s.account_info,
        startDate: s.start_date,
        endDate: s.end_date,
        status: s.status,
        notes: s.notes,
        createdAt: s.created_at,
      }));
      res.json({ subscriptions });
    }),
  );

  app.post(
    '/api/admin/subscriptions',
    requireAdmin('subscriptions'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const body = req.body || {};
      const id = 'sub_' + crypto.randomBytes(6).toString('hex');
      const now = new Date().toISOString();
      const startDate = String(body.startDate || now.slice(0, 10));
      const endDate = String(body.endDate || now.slice(0, 10));
      await run(
        `INSERT INTO subscriptions (
          id, order_id, order_code, customer_name, customer_phone, service_name,
          plan_label, account_info, start_date, end_date, status, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        body.orderId ? String(body.orderId) : null,
        String(body.orderCode || ''),
        String(body.customerName || '').trim(),
        String(body.customerPhone || '').trim(),
        String(body.serviceName || '').trim(),
        String(body.planLabel || '').trim(),
        String(body.accountInfo || '').trim(),
        startDate,
        endDate,
        String(body.status || 'active'),
        String(body.notes || ''),
        now,
      );
      await audit(actor.username, actor.role, 'create_subscription', 'subscription', id, {}, getClientIp(req));
      res.status(201).json({ id });
    }),
  );

  app.patch(
    '/api/admin/subscriptions/:id',
    requireAdmin('subscriptions'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const id = String(req.params.id);
      const body = req.body || {};
      await run(
        'UPDATE subscriptions SET status = COALESCE(?, status), end_date = COALESCE(?, end_date), account_info = COALESCE(?, account_info), notes = COALESCE(?, notes) WHERE id = ?',
        body.status ?? null,
        body.endDate ?? null,
        body.accountInfo ?? null,
        body.notes ?? null,
        id,
      );
      await audit(actor.username, actor.role, 'update_subscription', 'subscription', id, { status: body.status }, getClientIp(req));
      res.json({ ok: true });
    }),
  );

  app.delete(
    '/api/admin/subscriptions/:id',
    requireAdmin('subscriptions'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const id = String(req.params.id);
      await run('DELETE FROM subscriptions WHERE id = ?', id);
      await audit(actor.username, actor.role, 'delete_subscription', 'subscription', id, {}, getClientIp(req));
      res.json({ ok: true });
    }),
  );

  // Admin Staff & Permissions
  app.get(
    '/api/admin/staff',
    requireAdmin('staff'),
    asyncHandler(async (_req, res) => {
      const list = await rows<{
        id: string;
        username: string;
        display_name: string;
        role: 'owner' | 'staff';
        permissions_json: string;
        active: number;
        created_at: string;
      }>("SELECT id, username, display_name, role, permissions_json, active, created_at FROM users WHERE role = 'staff' ORDER BY created_at DESC");
      const staff: StaffUser[] = list.map((u) => ({
        id: u.id,
        username: u.username,
        displayName: u.display_name,
        role: u.role,
        permissions: JSON.parse(u.permissions_json || '[]'),
        active: Boolean(u.active),
        createdAt: u.created_at,
      }));
      res.json({ staff });
    }),
  );

  app.post(
    '/api/admin/staff',
    requireAdmin('staff'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const username = String(req.body?.username || '').trim().toLowerCase();
      const displayName = String(req.body?.displayName || username).trim();
      const password = String(req.body?.password || '');
      const permissions = Array.isArray(req.body?.permissions) ? req.body.permissions : ['orders'];

      if (!/^[a-z0-9_.-]{3,32}$/.test(username) || username === 'owner') {
        res.status(400).json({ error: 'Valid staff username (3-32 chars, not owner) required' });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters' });
        return;
      }
      if (await row('SELECT id FROM users WHERE username = ?', username)) {
        res.status(409).json({ error: 'Username already exists' });
        return;
      }
      const id = 'stf_' + crypto.randomBytes(6).toString('hex');
      const now = new Date().toISOString();
      await run(
        `INSERT INTO users (id, username, display_name, role, password_hash, permissions_json, active, created_at)
         VALUES (?, ?, ?, 'staff', ?, ?, 1, ?)`,
        id,
        username,
        displayName,
        hashPassword(password),
        JSON.stringify(permissions),
        now,
      );
      await audit(actor.username, actor.role, 'create_staff', 'user', id, { username }, getClientIp(req));
      res.status(201).json({ id });
    }),
  );

  app.patch(
    '/api/admin/staff/:id',
    requireAdmin('staff'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const id = String(req.params.id);
      const existing = await row<{ id: string; permissions_json: string; active: number }>(
        "SELECT id, permissions_json, active FROM users WHERE id = ? AND role = 'staff'",
        id,
      );
      if (!existing) {
        res.status(404).json({ error: 'Staff member not found' });
        return;
      }
      const perms = Array.isArray(req.body?.permissions)
        ? JSON.stringify(req.body.permissions)
        : existing.permissions_json;
      const active = req.body?.active !== undefined ? (req.body.active ? 1 : 0) : Number(existing.active);
      await run('UPDATE users SET permissions_json = ?, active = ? WHERE id = ?', perms, active, id);
      if (req.body?.password && String(req.body.password).length >= 6) {
        await run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(String(req.body.password)), id);
      }
      await audit(actor.username, actor.role, 'update_staff', 'user', id, { active }, getClientIp(req));
      res.json({ ok: true });
    }),
  );

  app.delete(
    '/api/admin/staff/:id',
    requireAdmin('staff'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const id = String(req.params.id);
      await run("DELETE FROM users WHERE id = ? AND role = 'staff'", id);
      await audit(actor.username, actor.role, 'delete_staff', 'user', id, {}, getClientIp(req));
      res.json({ ok: true });
    }),
  );

  // Admin Settings (never leaks Chargily secret)
  app.get(
    '/api/admin/settings',
    requireAdmin('settings'),
    asyncHandler(async (_req, res) => {
      const pub = await getPublicSettings();
      const integrations = await getIntegrations();
      const settings: AdminSettings = {
        ...pub,
        chargilySecretMasked: maskSecret(integrations.chargilySecretKey),
        chargilyKeyFromEnv: Boolean(process.env.CHARGILY_SECRET_KEY),
        deliveryTokenMasked: maskSecret(integrations.deliveryToken),
        deliveryKeyFromEnv: Boolean(process.env.DELIVERY_TOKEN),
      };
      res.json({ settings });
    }),
  );

  app.put(
    '/api/admin/settings',
    requireAdmin('settings'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const body = req.body || {};
      const prevPub = await getPublicSettings();
      const nextPub: PublicSettings = {
        ...prevPub,
        storeName: body.storeName || prevPub.storeName,
        address: body.address || prevPub.address,
        phone: body.phone !== undefined ? String(body.phone) : prevPub.phone,
        whatsapp: body.whatsapp !== undefined ? String(body.whatsapp) : prevPub.whatsapp,
        ccpRip: body.ccpRip !== undefined ? String(body.ccpRip) : prevPub.ccpRip,
        ccpName: body.ccpName !== undefined ? String(body.ccpName) : prevPub.ccpName,
        workingHours: body.workingHours || prevPub.workingHours,
        announcement: {
          ar: String(body.announcement?.ar ?? prevPub.announcement?.ar ?? '').trim().slice(0, 260),
          fr: String(body.announcement?.fr ?? prevPub.announcement?.fr ?? '').trim().slice(0, 260),
        },
        announcementConfig: body.announcementConfig
          ? normalizeAnnouncementConfig(body.announcementConfig)
          : normalizeAnnouncementConfig(prevPub.announcementConfig),
        gallery: Array.isArray(body.gallery) ? body.gallery.slice(0, 8) : prevPub.gallery,
        deliveryProvider: ['none', 'yalidine', 'zrexpress', 'maystro', 'custom'].includes(body.deliveryProvider)
          ? body.deliveryProvider
          : prevPub.deliveryProvider,
        deliveryEnabled: body.deliveryEnabled !== undefined ? Boolean(body.deliveryEnabled) : prevPub.deliveryEnabled,
        deliveryApiId: body.deliveryApiId !== undefined ? String(body.deliveryApiId).trim() : prevPub.deliveryApiId,
        facebook: body.facebook !== undefined ? String(body.facebook).trim() : (prevPub.facebook || 'https://www.facebook.com/slimi.bookstore'),
      };
      await setSetting('store_config', nextPub);

      const prevInt = await getSetting<Partial<PrivateIntegrations>>('integrations', {});
      const nextInt: PrivateIntegrations = {
        chargilySecretKey:
          typeof body.chargilySecretKey === 'string' && body.chargilySecretKey.trim() && !isMaskedValue(body.chargilySecretKey)
            ? body.chargilySecretKey.trim()
            : (prevInt.chargilySecretKey || ''),
        chargilyMode: body.chargilyMode === 'live' ? 'live' : 'test',
        deliveryProvider: ['none', 'yalidine', 'zrexpress', 'maystro', 'custom'].includes(body.deliveryProvider)
          ? body.deliveryProvider
          : (prevInt.deliveryProvider || 'none'),
        deliveryToken:
          typeof body.deliveryToken === 'string' && body.deliveryToken.trim() && !isMaskedValue(body.deliveryToken)
            ? body.deliveryToken.trim()
            : (prevInt.deliveryToken || ''),
        deliveryApiId: body.deliveryApiId !== undefined ? String(body.deliveryApiId).trim() : (prevInt.deliveryApiId || ''),
        deliveryEnabled: body.deliveryEnabled !== undefined ? Boolean(body.deliveryEnabled) : (prevInt.deliveryEnabled || false),
      };
      await setSetting('integrations', nextInt);
      await audit(actor.username, actor.role, 'update_settings', 'settings', 'store_config', {}, getClientIp(req));
      res.json({ ok: true });
    }),
  );

  // Real Integration Readiness Check (non-secret status of DB, Gemini, Chargily, Delivery)
  app.get(
    '/api/admin/integrations/status',
    requireAdmin(),
    asyncHandler(async (_req, res) => {
      const integrations = await getIntegrations();
      let dbConnected = false;
      try {
        await row('SELECT 1 as ok');
        dbConnected = true;
      } catch {
        dbConnected = false;
      }
      const geminiKey = (process.env.GEMINI_API_KEY || '').trim();
      res.json({
        database: {
          backend: getDbBackend(),
          connected: dbConnected,
          databaseUrlConfigured: Boolean((process.env.DATABASE_URL || '').trim()),
        },
        chargily: {
          configured: Boolean(integrations.chargilySecretKey),
          mode: integrations.chargilyMode,
          fromEnv: Boolean(process.env.CHARGILY_SECRET_KEY),
        },
        delivery: {
          provider: integrations.deliveryProvider,
          enabled: integrations.deliveryEnabled,
          configured: Boolean(integrations.deliveryToken && (integrations.deliveryApiId || integrations.deliveryProvider === 'maystro')),
          fromEnv: Boolean(process.env.DELIVERY_TOKEN),
        },
        gemini: {
          configured: Boolean(geminiKey && geminiKey !== 'MY_GEMINI_API_KEY'),
        },
      });
    }),
  );

  // Real Delivery Carrier API Connection Test
  app.post(
    '/api/admin/delivery/test',
    requireAdmin('settings'),
    rateLimit('delivery-test', 15, 60_000),
    asyncHandler(async (req, res) => {
      const integrations = await getIntegrations();
      const body = req.body || {};
      const provider = ['none', 'yalidine', 'zrexpress', 'maystro', 'custom'].includes(body.provider)
        ? (body.provider as PrivateIntegrations['deliveryProvider'])
        : integrations.deliveryProvider;
      const apiId =
        typeof body.apiId === 'string' && body.apiId.trim()
          ? body.apiId.trim()
          : integrations.deliveryApiId;
      const token =
        typeof body.token === 'string' && body.token.trim() && !isMaskedValue(body.token)
          ? body.token.trim()
          : integrations.deliveryToken;

      if (provider === 'none') {
        res.status(400).json({ ok: false, error: 'Delivery provider is set to none' });
        return;
      }
      if (!token || (provider !== 'maystro' && !apiId)) {
        res.status(400).json({ ok: false, error: 'API ID and API Token are required' });
        return;
      }
      if (provider === 'custom') {
        res.json({
          ok: true,
          verifiedLocally: true,
          message: 'Custom carrier credentials are present; no built-in remote endpoint configured to ping.',
        });
        return;
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);
      try {
        let upstream: globalThis.Response;
        if (provider === 'yalidine') {
          upstream = await fetch('https://api.yalidine.app/v1/wilayas/?page_size=1', {
            method: 'GET',
            headers: {
              'X-API-ID': apiId,
              'X-API-TOKEN': token,
              Accept: 'application/json',
            },
            signal: controller.signal,
          });
        } else if (provider === 'zrexpress') {
          upstream = await fetch('https://procolis.com/api_v1/token', {
            method: 'GET',
            headers: {
              token,
              key: apiId,
              Accept: 'application/json',
            },
            signal: controller.signal,
          });
        } else {
          upstream = await fetch('https://backend.maystro-delivery.com/api/shared/wilayas/', {
            method: 'GET',
            headers: {
              Authorization: `Token ${token}`,
              Accept: 'application/json',
            },
            signal: controller.signal,
          });
        }

        if (!upstream.ok) {
          res.status(502).json({
            ok: false,
            status: upstream.status,
            error: `Carrier API rejected credentials or returned HTTP ${upstream.status}`,
          });
          return;
        }

        res.json({
          ok: true,
          status: upstream.status,
          provider,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Network error';
        res.status(502).json({
          ok: false,
          error: `Could not reach ${provider} API: ${msg}`,
        });
      } finally {
        clearTimeout(timer);
      }
    }),
  );

  const DEFAULT_DB_CONFIG: DatabaseConnectionConfig = {
    provider: 'supabase',
    projectName: 'Librairie Slimi',
    projectRef: '',
    region: 'eu-west-1',
    host: 'aws-0-eu-west-1.pooler.supabase.com',
    port: 6543,
    databaseName: 'postgres',
    poolMode: 'transaction',
    sslEnabled: true,
    poolMax: 10,
  };

  async function buildDatabaseStatusSnapshot(): Promise<DatabaseStatusSnapshot> {
    const storedConfig = await getSetting<Partial<DatabaseConnectionConfig>>('database_config', {});
    const config: DatabaseConnectionConfig = {
      provider: storedConfig.provider === 'postgres' ? 'postgres' : 'supabase',
      projectName: String(storedConfig.projectName || DEFAULT_DB_CONFIG.projectName).slice(0, 80),
      projectRef: String(storedConfig.projectRef || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 48),
      region: String(storedConfig.region || DEFAULT_DB_CONFIG.region).slice(0, 48),
      host: String(storedConfig.host || DEFAULT_DB_CONFIG.host).slice(0, 120),
      port: Math.max(1, Math.min(65535, Number(storedConfig.port || DEFAULT_DB_CONFIG.port))),
      databaseName: String(storedConfig.databaseName || DEFAULT_DB_CONFIG.databaseName).slice(0, 64),
      poolMode:
        storedConfig.poolMode === 'session' || storedConfig.poolMode === 'direct'
          ? storedConfig.poolMode
          : 'transaction',
      sslEnabled: storedConfig.sslEnabled !== undefined ? Boolean(storedConfig.sslEnabled) : true,
      poolMax: Math.max(2, Math.min(30, Number(storedConfig.poolMax || DEFAULT_DB_CONFIG.poolMax))),
    };

    const databaseUrl = (process.env.DATABASE_URL || '').trim();
    const target = databaseUrl ? parseSafeDatabaseTarget(databaseUrl) : null;

    const startedAt = Date.now();
    let connected = false;
    try {
      await row('SELECT 1 as ok');
      connected = true;
    } catch {
      connected = false;
    }
    const latencyMs = Math.max(0, Date.now() - startedAt);

    const tables: Array<{ table: string; rows: number }> = [];
    if (connected) {
      for (const spec of SQLITE_TO_PG_TABLES) {
        try {
          const rec = await row<{ cnt: number | string }>(`SELECT COUNT(*) as cnt FROM ${spec.table}`);
          tables.push({ table: spec.table, rows: Number(rec?.cnt || 0) });
        } catch {
          tables.push({ table: spec.table, rows: 0 });
        }
      }
    }

    return {
      activeBackend: getDbBackend(),
      connected,
      latencyMs,
      databaseUrlConfigured: Boolean(databaseUrl),
      pgError: getLastPgError(),
      target,
      config,
      tables,
    };
  }

  // Admin Database Connection Status & Metadata (never accepts or exposes raw passwords)
  app.get(
    '/api/admin/database/status',
    requireAdmin('settings'),
    asyncHandler(async (_req, res) => {
      const snapshot = await buildDatabaseStatusSnapshot();
      res.json(snapshot);
    }),
  );

  app.put(
    '/api/admin/database/config',
    requireAdmin('settings'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const body = req.body || {};
      const poolMode =
        body.poolMode === 'session' || body.poolMode === 'direct' ? body.poolMode : 'transaction';
      const defaultPort = poolMode === 'transaction' ? 6543 : 5432;
      const nextConfig: DatabaseConnectionConfig = {
        provider: body.provider === 'postgres' ? 'postgres' : 'supabase',
        projectName: String(body.projectName || 'Librairie Slimi').trim().slice(0, 80) || 'Librairie Slimi',
        projectRef: String(body.projectRef || '').trim().replace(/[^a-z0-9_-]/gi, '').slice(0, 48),
        region: String(body.region || 'eu-west-1').trim().slice(0, 48) || 'eu-west-1',
        host: String(body.host || '').trim().slice(0, 120),
        port: Math.max(1, Math.min(65535, Number(body.port || defaultPort))),
        databaseName: String(body.databaseName || 'postgres').trim().slice(0, 64) || 'postgres',
        poolMode,
        sslEnabled: body.sslEnabled !== undefined ? Boolean(body.sslEnabled) : true,
        poolMax: Math.max(2, Math.min(30, Number(body.poolMax || 10))),
      };
      await setSetting('database_config', nextConfig);
      await audit(
        actor.username,
        actor.role,
        'update_database_config',
        'settings',
        'database_config',
        { provider: nextConfig.provider, region: nextConfig.region, poolMode: nextConfig.poolMode },
        getClientIp(req),
      );
      const snapshot = await buildDatabaseStatusSnapshot();
      res.json({ ok: true, ...snapshot });
    }),
  );

  app.post(
    '/api/admin/database/verify',
    requireAdmin('settings'),
    rateLimit('admin-db-verify', 20, 60_000),
    asyncHandler(async (_req, res) => {
      const snapshot = await buildDatabaseStatusSnapshot();
      res.json(snapshot);
    }),
  );

  // Admin Media Image Upload (stored as BYTEA in PostgreSQL, up to 5MB)
  app.post(
    '/api/admin/media',
    requireAdmin(),
    rateLimit('admin-media', 30, 60_000),
    express.json({ limit: '7mb' }),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const slot = String(req.body?.slot || 'product');
      if (!ALLOWED_IMAGE_SLOTS.has(slot)) {
        res.status(400).json({ error: 'Invalid media slot' });
        return;
      }
      const dataUrl = String(req.body?.dataUrl || '');
      const commaIdx = dataUrl.indexOf(',');
      if (!dataUrl.startsWith('data:') || commaIdx === -1) {
        res.status(400).json({ error: 'Invalid data URL' });
        return;
      }
      const buf = Buffer.from(dataUrl.slice(commaIdx + 1), 'base64');
      if (buf.length === 0 || buf.length > 5 * 1024 * 1024) {
        res.status(400).json({ error: 'Image must be <= 5MB' });
        return;
      }
      const mime = detectImageMime(buf);
      if (!mime) {
        res.status(400).json({ error: 'Unsupported image format' });
        return;
      }
      const id = crypto.randomBytes(9).toString('hex');
      const url = `/media/${id}`;
      await run(
        'INSERT INTO media (id, mime, size, data, created_at) VALUES (?, ?, ?, ?, ?)',
        id,
        mime,
        buf.length,
        buf,
        new Date().toISOString(),
      );

      if (slot !== 'product' && slot !== 'category') {
        const cfg = await getPublicSettings();
        if (slot === 'gallery') {
          const nextGallery = [...(cfg.gallery || []), url].slice(0, 8);
          await setSetting('store_config', { ...cfg, gallery: nextGallery });
        } else {
          await setSetting('store_config', { ...cfg, [slot]: url });
          if (slot.startsWith('svc_')) {
            const catId = slot.slice(4);
            await run('UPDATE categories SET img = ? WHERE id = ?', url, catId);
          }
        }
      }
      await audit(actor.username, actor.role, 'upload_media', 'media', id, { slot, size: buf.length }, getClientIp(req));
      res.status(201).json({ id, url });
    }),
  );

  // Admin Video Upload (raw MP4 or WebM up to 12MB)
  app.post(
    '/api/admin/video',
    requireAdmin('settings'),
    rateLimit('admin-video', 10, 60_000),
    express.raw({ type: ['video/mp4', 'video/webm', 'application/octet-stream'], limit: '12mb' }),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (buf.length === 0 || buf.length > 12 * 1024 * 1024) {
        res.status(400).json({ error: 'Video must be between 1 byte and 12MB' });
        return;
      }
      const mime = detectVideoMime(buf);
      if (!mime) {
        res.status(400).json({ error: 'Only MP4 and WebM video files are allowed' });
        return;
      }
      const id = crypto.randomBytes(9).toString('hex');
      const url = `/media/${id}`;
      await run(
        'INSERT INTO media (id, mime, size, data, created_at) VALUES (?, ?, ?, ?, ?)',
        id,
        mime,
        buf.length,
        buf,
        new Date().toISOString(),
      );
      const cfg = await getPublicSettings();
      await setSetting('store_config', { ...cfg, vid: url });
      await audit(actor.username, actor.role, 'upload_video', 'media', id, { mime, size: buf.length }, getClientIp(req));
      res.status(201).json({ id, url });
    }),
  );

  app.delete(
    '/api/admin/media/:id',
    requireAdmin('settings'),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const id = String(req.params.id);
      if (!/^[a-f0-9]{18}$/.test(id)) {
        res.status(400).json({ error: 'Invalid media id' });
        return;
      }
      const targetUrl = `/media/${id}`;
      const cfg = await getPublicSettings();
      const updatedCfg: PublicSettings = {
        ...cfg,
        logo: cfg.logo === targetUrl ? '' : cfg.logo,
        facade: cfg.facade === targetUrl ? '' : cfg.facade,
        facade2: cfg.facade2 === targetUrl ? '' : cfg.facade2,
        in1: cfg.in1 === targetUrl ? '' : cfg.in1,
        svc_subs: cfg.svc_subs === targetUrl ? '' : cfg.svc_subs,
        svc_games: cfg.svc_games === targetUrl ? '' : cfg.svc_games,
        svc_bills: cfg.svc_bills === targetUrl ? '' : cfg.svc_bills,
        svc_shop: cfg.svc_shop === targetUrl ? '' : cfg.svc_shop,
        vid: cfg.vid === targetUrl ? '' : cfg.vid,
        gallery: (cfg.gallery || []).filter((g) => g !== targetUrl),
      };
      await withTransaction(async () => {
        await setSetting('store_config', updatedCfg);
        await run("UPDATE categories SET img = '' WHERE img = ?", targetUrl);
        await run('DELETE FROM media WHERE id = ?', id);
      });
      await audit(actor.username, actor.role, 'delete_media', 'media', id, {}, getClientIp(req));
      res.json({ ok: true });
    }),
  );

  // Admin Audit Log
  app.get(
    '/api/admin/audit',
    requireAdmin('audit'),
    asyncHandler(async (_req, res) => {
      const list = await rows<{
        id: number;
        actor_username: string;
        actor_role: string;
        action: string;
        target_type: string;
        target_id: string;
        details_json: string;
        ip: string;
        created_at: string;
      }>('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 150');

      const logs: AuditEntry[] = list.map((l) => ({
        id: l.id,
        actorUsername: l.actor_username,
        actorRole: l.actor_role,
        action: l.action,
        targetType: l.target_type,
        targetId: l.target_id,
        details: JSON.parse(l.details_json || '{}'),
        ip: l.ip,
        createdAt: l.created_at,
      }));
      res.json({ logs });
    }),
  );

  // Admin AI Copilot (Manager Assistant with site-control tools)
  app.get(
    '/api/admin/ai/history',
    requireAdmin(),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      res.json({ messages: await getAdminAiHistory(actor.id) });
    }),
  );

  app.delete(
    '/api/admin/ai/history',
    requireAdmin(),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      await clearAdminAiHistory(actor.id);
      res.json({ ok: true });
    }),
  );

  app.post(
    '/api/admin/ai/chat',
    requireAdmin(),
    rateLimit('admin-ai', 25, 60_000),
    asyncHandler(async (req, res) => {
      const actor = getAdminUser(req);
      const message = String(req.body?.message || '').trim();
      const lang: Lang = req.body?.lang === 'fr' ? 'fr' : 'ar';
      const activeTab = String(req.body?.activeTab || 'dashboard').slice(0, 32);

      if (!message || message.length > 4000) {
        res.status(400).json({ error: 'Message must be between 1 and 4000 characters' });
        return;
      }

      try {
        const result = await runAdminAiTurn({
          actor,
          message,
          lang,
          activeTab,
          ip: getClientIp(req),
        });
        res.json(result);
      } catch (err: unknown) {
        const errObj = err as { status?: number; message?: string };
        const msg = errObj?.message || 'AI assistant request failed';
        const rawStatus = typeof errObj?.status === 'number' ? errObj.status : 500;
        const parsed = parseGeminiErrorMessage(msg, rawStatus, lang);
        res.status(parsed.status).json({ error: parsed.message });
      }
    }),
  );
}
