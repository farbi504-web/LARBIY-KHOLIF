import crypto from 'node:crypto';
import { FunctionDeclaration, GoogleGenAI, ThinkingLevel, Type, type Content, type Part } from '@google/genai';
import { audit, getSetting, row, rows, run, setSetting } from './db.ts';
import { CATEGORY_ICONS } from '../src/shared/categories.ts';
import { sanitizeAiMessages } from '../src/shared/aiHelpers.ts';
import type {
  AdminAiActionSummary,
  AdminAiMessage,
  AnnouncementConfig,
  CategoryIconName,
  CategoryId,
  Lang,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  ProductPlan,
  ProductType,
  PublicSettings,
  StaffPermission,
  StaffUser,
} from '../src/shared/types.ts';

const PRIMARY_GEMINI_MODEL = 'gemini-2.5-flash';
const FALLBACK_GEMINI_MODEL = 'gemini-1.5-flash';

function createGeminiClient(): GoogleGenAI | null {
  const apiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface ToolContext {
  actor: StaffUser;
  ip: string;
  lang: Lang;
  actions: AdminAiActionSummary[];
  dataChanged: { value: boolean };
  navigateTab: { value?: string };
  openStoreView: { value?: 'home' | 'shop' };
}

function hasPerm(actor: StaffUser, perm: StaffPermission): boolean {
  return actor.role === 'owner' || actor.permissions.includes(perm);
}

const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'get_store_overview',
    description:
      'Get current KPIs (revenue, orders count, pending orders, expiring subscriptions, products/categories/reviews counts) and public store settings (store name, announcement, working hours, phone, whatsapp, CCP name, Chargily status).',
  },
  {
    name: 'list_categories',
    description: 'List all store categories (both active and hidden) with their IDs, Arabic/French names, sort order, icon, and product counts.',
  },
  {
    name: 'create_category',
    description: 'Create a new category/section in the store.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        nameAr: { type: Type.STRING, description: 'Category name in Arabic (required)' },
        nameFr: { type: Type.STRING, description: 'Category name in French' },
        descAr: { type: Type.STRING, description: 'Category description in Arabic' },
        descFr: { type: Type.STRING, description: 'Category description in French' },
        icon: {
          type: Type.STRING,
          description: `Icon key. One of: ${CATEGORY_ICONS.join(', ')}`,
        },
        sortOrder: { type: Type.INTEGER, description: 'Display order (0-999)' },
        active: { type: Type.BOOLEAN, description: 'Whether visible in storefront' },
      },
      required: ['nameAr'],
    },
  },
  {
    name: 'update_category',
    description: 'Update an existing store category by its ID.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Category ID (e.g., shop, toys, subs, or cat_...)' },
        nameAr: { type: Type.STRING },
        nameFr: { type: Type.STRING },
        descAr: { type: Type.STRING },
        descFr: { type: Type.STRING },
        icon: { type: Type.STRING, description: `One of: ${CATEGORY_ICONS.join(', ')}` },
        sortOrder: { type: Type.INTEGER },
        active: { type: Type.BOOLEAN },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_category',
    description: 'Delete an empty category by its ID (fails if category still contains products).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Category ID to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_products',
    description: 'Search and list products/services in the catalog.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Optional search term in Arabic or French name/description' },
        cat: { type: Type.STRING, description: 'Optional category ID filter' },
        type: { type: Type.STRING, description: 'Optional type filter: physical or digital' },
        avail: { type: Type.BOOLEAN, description: 'Optional availability filter' },
        limit: { type: Type.INTEGER, description: 'Max products to return (default 25, max 50)' },
      },
    },
  },
  {
    name: 'create_product',
    description: 'Add a new physical product or digital service to the store.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        cat: { type: Type.STRING, description: 'Category ID (use list_categories if unsure)' },
        type: { type: Type.STRING, description: 'physical or digital' },
        nameAr: { type: Type.STRING, description: 'Product name in Arabic' },
        nameFr: { type: Type.STRING, description: 'Product name in French' },
        descAr: { type: Type.STRING, description: 'Product description in Arabic' },
        descFr: { type: Type.STRING, description: 'Product description in French' },
        price: { type: Type.NUMBER, description: 'Price in Algerian Dinar (DZD)' },
        oldPrice: { type: Type.NUMBER, description: 'Optional crossed-out old price in DZD' },
        avail: { type: Type.BOOLEAN, description: 'Is product available for sale (default true)' },
        featured: { type: Type.BOOLEAN, description: 'Show in popular/featured section' },
        needsRef: { type: Type.BOOLEAN, description: 'Requires customer bill reference or Player ID at checkout' },
        pays: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'Allowed payment methods: cod, ccp, chargily (digital products should not include cod)',
        },
        plans: {
          type: Type.ARRAY,
          description: 'Optional duration/tier plans for subscriptions or bundles',
          items: {
            type: Type.OBJECT,
            properties: {
              labelAr: { type: Type.STRING },
              labelFr: { type: Type.STRING },
              price: { type: Type.NUMBER },
              oldPrice: { type: Type.NUMBER },
            },
            required: ['labelAr', 'price'],
          },
        },
      },
      required: ['cat', 'type', 'nameAr', 'price'],
    },
  },
  {
    name: 'update_product',
    description: 'Update an existing product by ID (price, promo oldPrice, availability, featured, names, descriptions, category, needsRef, payment methods).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Product ID' },
        cat: { type: Type.STRING },
        type: { type: Type.STRING, description: 'physical or digital' },
        nameAr: { type: Type.STRING },
        nameFr: { type: Type.STRING },
        descAr: { type: Type.STRING },
        descFr: { type: Type.STRING },
        price: { type: Type.NUMBER },
        oldPrice: { type: Type.NUMBER, description: 'Set to 0 or omit to clear/keep' },
        clearOldPrice: { type: Type.BOOLEAN, description: 'Set true to remove oldPrice discount' },
        avail: { type: Type.BOOLEAN },
        featured: { type: Type.BOOLEAN },
        needsRef: { type: Type.BOOLEAN },
        pays: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_product',
    description: 'Delete a product from the catalog by ID.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Product ID to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_orders',
    description: 'List or search customer orders by status, paymentStatus, or search text (order code, customer name, phone).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Search by order code (SLM-...), customer name, or phone' },
        status: { type: Type.STRING, description: 'pending, confirmed, processing, delivered, cancelled' },
        paymentStatus: { type: Type.STRING, description: 'unpaid, pending_review, paid, failed' },
        limit: { type: Type.INTEGER, description: 'Max orders to return (default 20, max 50)' },
      },
    },
  },
  {
    name: 'update_order',
    description: 'Update an order status, payment status, delivery data (codes/credentials), or internal notes.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        orderIdOrCode: { type: Type.STRING, description: 'Order UUID or code like SLM-1234AB' },
        status: { type: Type.STRING, description: 'pending, confirmed, processing, delivered, cancelled' },
        paymentStatus: { type: Type.STRING, description: 'unpaid, pending_review, paid, failed' },
        deliveryData: { type: Type.STRING, description: 'Activation details, voucher code, or delivery note for the customer' },
        notes: { type: Type.STRING, description: 'Internal order notes' },
      },
      required: ['orderIdOrCode'],
    },
  },
  {
    name: 'list_subscriptions',
    description: 'List tracked digital customer subscriptions, optionally filtering by status or expiring soon.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, description: 'active, expiring, expired, cancelled' },
        expiringWithinDays: { type: Type.INTEGER, description: 'Filter subscriptions ending within N days' },
        query: { type: Type.STRING, description: 'Search customer name, phone, or service name' },
      },
    },
  },
  {
    name: 'create_subscription',
    description: 'Record a new customer digital subscription in the tracker.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerName: { type: Type.STRING },
        customerPhone: { type: Type.STRING },
        serviceName: { type: Type.STRING },
        planLabel: { type: Type.STRING },
        accountInfo: { type: Type.STRING },
        startDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
        endDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
        notes: { type: Type.STRING },
      },
      required: ['customerName', 'customerPhone', 'serviceName', 'endDate'],
    },
  },
  {
    name: 'update_subscription',
    description: 'Update an existing customer subscription (status, endDate, accountInfo, notes).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING, description: 'Subscription ID (sub_...)' },
        status: { type: Type.STRING, description: 'active, expiring, expired, cancelled' },
        endDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
        accountInfo: { type: Type.STRING },
        notes: { type: Type.STRING },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_store_settings',
    description:
      'Update public store settings such as the top announcement banner (Arabic/French), working hours, store name, address, phone, WhatsApp, or CCP/BaridiMob RIP/name.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        announcementAr: { type: Type.STRING, description: 'Top site announcement bar text in Arabic (empty string clears it)' },
        announcementFr: { type: Type.STRING, description: 'Top site announcement bar text in French (empty string clears it)' },
        announcementEnabled: { type: Type.BOOLEAN, description: 'Enable or disable the top announcement bar' },
        announcementTone: { type: Type.STRING, description: 'Color theme: navy, crimson, emerald, amber' },
        announcementMode: { type: Type.STRING, description: 'Display mode: ticker (scrolling) or static (centered)' },
        announcementSpeed: { type: Type.STRING, description: 'Ticker speed: slow, normal, fast' },
        announcementDismissible: { type: Type.BOOLEAN, description: 'Allow visitors to dismiss the bar' },
        announcementCtaTarget: { type: Type.STRING, description: 'Optional button target: none (empty), shop, track, or contact' },
        announcementCtaLabelAr: { type: Type.STRING, description: 'Optional CTA button text in Arabic' },
        announcementCtaLabelFr: { type: Type.STRING, description: 'Optional CTA button text in French' },
        workingHoursAr: { type: Type.STRING },
        workingHoursFr: { type: Type.STRING },
        storeNameAr: { type: Type.STRING },
        storeNameFr: { type: Type.STRING },
        addressAr: { type: Type.STRING },
        addressFr: { type: Type.STRING },
        phone: { type: Type.STRING },
        whatsapp: { type: Type.STRING },
        ccpRip: { type: Type.STRING },
        ccpName: { type: Type.STRING },
      },
    },
  },
  {
    name: 'list_audit_logs',
    description: 'Read recent admin audit logs to review team actions.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.INTEGER, description: 'Max entries (default 15, max 40)' },
      },
    },
  },
  {
    name: 'get_reviews_summary',
    description: 'List recent 5-star customer reviews and average rating per product.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        productId: { type: Type.STRING, description: 'Optional product ID to filter reviews' },
        limit: { type: Type.INTEGER, description: 'Max recent reviews to return (default 15, max 40)' },
      },
    },
  },
  {
    name: 'navigate_admin_ui',
    description:
      'Navigate the admin console UI to a specific section tab or switch back to inspect the public storefront.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tab: {
          type: Type.STRING,
          description:
            'Admin tab: dashboard, assistant, orders, categories, products, subscriptions, staff, settings, audit',
        },
        storeView: {
          type: Type.STRING,
          description: 'Optional public store view to open: home or shop',
        },
      },
    },
  },
];

async function executeTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<Record<string, unknown>> {
  const { actor, ip, lang } = ctx;
  const isFr = lang === 'fr';

  const record = (labelAr: string, labelFr: string, ok: boolean, mutated = false) => {
    ctx.actions.push({
      tool: name,
      label: isFr ? labelFr : labelAr,
      ok,
      mutated,
    });
    if (mutated && ok) {
      ctx.dataChanged.value = true;
    }
  };

  switch (name) {
    case 'get_store_overview': {
      const allOrders = rows<{
        subtotal: number;
        status: string;
        payment_status: string;
      }>('SELECT subtotal, status, payment_status FROM orders');
      const revenue = allOrders
        .filter((o) => o.status !== 'cancelled' && (o.payment_status === 'paid' || o.status === 'delivered' || o.status === 'confirmed'))
        .reduce((acc, o) => acc + Number(o.subtotal), 0);
      const pendingOrders = allOrders.filter((o) => o.status === 'pending' || o.status === 'processing').length;
      const totalProducts = row<{ cnt: number }>('SELECT COUNT(*) as cnt FROM products')?.cnt || 0;
      const activeCategories = row<{ cnt: number }>('SELECT COUNT(*) as cnt FROM categories WHERE active = 1')?.cnt || 0;
      const sevenDays = Date.now() + 7 * 86400_000;
      const subs = rows<{ end_date: string; status: string }>('SELECT end_date, status FROM subscriptions');
      const expiringSubs = subs.filter((s) => {
        if (s.status === 'cancelled' || s.status === 'expired') return false;
        const t = new Date(s.end_date).getTime();
        return !Number.isNaN(t) && t <= sevenDays;
      }).length;
      const cfg = getSetting<PublicSettings>('store_config', {} as PublicSettings);
      const integrations = getSetting<{ chargilySecretKey?: string; chargilyMode?: string }>(
        'integrations',
        {},
      );
      record('قراءة إحصائيات المتجر', 'Lecture aperçu magasin', true, false);
      return {
        ok: true,
        kpis: {
          totalRevenueDzd: revenue,
          totalOrders: allOrders.length,
          pendingOrders,
          expiringSubsWithin7Days: expiringSubs,
          totalProducts,
          activeCategories,
        },
        settings: {
          storeName: cfg.storeName,
          address: cfg.address,
          phone: cfg.phone,
          whatsapp: cfg.whatsapp,
          ccpName: cfg.ccpName,
          ccpRipSet: Boolean(cfg.ccpRip),
          workingHours: cfg.workingHours,
          announcement: cfg.announcement,
          chargilyConfigured: Boolean(process.env.CHARGILY_SECRET_KEY || integrations.chargilySecretKey),
          chargilyMode: process.env.CHARGILY_MODE || integrations.chargilyMode || 'test',
        },
      };
    }

    case 'list_categories': {
      const list = rows<{
        id: string;
        name_json: string;
        desc_json: string;
        icon: string;
        sort_order: number;
        active: number;
        product_count: number;
      }>(
        `SELECT c.id, c.name_json, c.desc_json, c.icon, c.sort_order, c.active,
         COALESCE(pc.cnt, 0) as product_count
         FROM categories c
         LEFT JOIN (SELECT cat, COUNT(*) as cnt FROM products GROUP BY cat) pc ON pc.cat = c.id
         ORDER BY c.sort_order ASC, c.created_at ASC`,
      );
      record('عرض أقسام المتجر', 'Liste des catégories', true, false);
      return {
        ok: true,
        categories: list.map((c) => ({
          id: c.id,
          name: JSON.parse(c.name_json),
          desc: JSON.parse(c.desc_json),
          icon: c.icon,
          sortOrder: c.sort_order,
          active: Boolean(c.active),
          productCount: Number(c.product_count),
        })),
      };
    }

    case 'create_category': {
      if (!hasPerm(actor, 'products')) {
        return { ok: false, error: 'Insufficient permissions (requires products permission)' };
      }
      const nameAr = String(args.nameAr || '').trim().slice(0, 100);
      if (!nameAr) return { ok: false, error: 'nameAr is required' };
      const nameFr = String(args.nameFr || nameAr).trim().slice(0, 100);
      const descAr = String(args.descAr || '').trim().slice(0, 320);
      const descFr = String(args.descFr || descAr).trim().slice(0, 320);
      const icon = CATEGORY_ICONS.includes(args.icon as CategoryIconName)
        ? (args.icon as CategoryIconName)
        : 'package';
      const maxOrder = row<{ m: number | null }>('SELECT MAX(sort_order) as m FROM categories')?.m ?? 0;
      const sortOrder =
        args.sortOrder !== undefined && Number.isFinite(Number(args.sortOrder))
          ? Math.max(0, Math.min(999, Math.floor(Number(args.sortOrder))))
          : maxOrder + 1;
      const active = args.active !== undefined ? Boolean(args.active) : true;
      const id = 'cat_' + crypto.randomBytes(4).toString('hex');
      const now = new Date().toISOString();

      run(
        `INSERT INTO categories (id, name_json, desc_json, icon, img, sort_order, active, created_at)
         VALUES (?, ?, ?, ?, '', ?, ?, ?)`,
        id,
        JSON.stringify({ ar: nameAr, fr: nameFr }),
        JSON.stringify({ ar: descAr, fr: descFr }),
        icon,
        sortOrder,
        active ? 1 : 0,
        now,
      );
      audit(actor.username, actor.role, 'ai_create_category', 'category', id, { name: nameAr }, ip);
      record(`إضافة قسم: ${nameAr}`, `Catégorie ajoutée : ${nameFr}`, true, true);
      return { ok: true, id, name: { ar: nameAr, fr: nameFr }, active, sortOrder };
    }

    case 'update_category': {
      if (!hasPerm(actor, 'products')) {
        return { ok: false, error: 'Insufficient permissions (requires products permission)' };
      }
      const id = String(args.id || '').trim();
      const existing = row<{
        id: string;
        name_json: string;
        desc_json: string;
        icon: string;
        sort_order: number;
        active: number;
      }>('SELECT id, name_json, desc_json, icon, sort_order, active FROM categories WHERE id = ?', id);
      if (!existing) return { ok: false, error: `Category "${id}" not found` };

      const prevName = JSON.parse(existing.name_json) as { ar: string; fr: string };
      const prevDesc = JSON.parse(existing.desc_json) as { ar: string; fr: string };
      const nameAr = args.nameAr !== undefined ? String(args.nameAr).trim().slice(0, 100) : prevName.ar;
      const nameFr = args.nameFr !== undefined ? String(args.nameFr).trim().slice(0, 100) : prevName.fr;
      const descAr = args.descAr !== undefined ? String(args.descAr).trim().slice(0, 320) : prevDesc.ar;
      const descFr = args.descFr !== undefined ? String(args.descFr).trim().slice(0, 320) : prevDesc.fr;
      const icon = CATEGORY_ICONS.includes(args.icon as CategoryIconName)
        ? (args.icon as CategoryIconName)
        : existing.icon;
      const sortOrder =
        args.sortOrder !== undefined && Number.isFinite(Number(args.sortOrder))
          ? Math.max(0, Math.min(999, Math.floor(Number(args.sortOrder))))
          : existing.sort_order;
      const active = args.active !== undefined ? Boolean(args.active) : Boolean(existing.active);

      run(
        'UPDATE categories SET name_json = ?, desc_json = ?, icon = ?, sort_order = ?, active = ? WHERE id = ?',
        JSON.stringify({ ar: nameAr, fr: nameFr }),
        JSON.stringify({ ar: descAr, fr: descFr }),
        icon,
        sortOrder,
        active ? 1 : 0,
        id,
      );
      audit(actor.username, actor.role, 'ai_update_category', 'category', id, { name: nameAr, active }, ip);
      record(`تحديث قسم: ${nameAr}`, `Catégorie mise à jour : ${nameFr}`, true, true);
      return { ok: true, id, name: { ar: nameAr, fr: nameFr }, active, sortOrder };
    }

    case 'delete_category': {
      if (!hasPerm(actor, 'products')) {
        return { ok: false, error: 'Insufficient permissions (requires products permission)' };
      }
      const id = String(args.id || '').trim();
      const used = row<{ cnt: number }>('SELECT COUNT(*) as cnt FROM products WHERE cat = ?', id)?.cnt || 0;
      if (used > 0) {
        return { ok: false, error: `Cannot delete category "${id}" because it has ${used} product(s).` };
      }
      const info = run('DELETE FROM categories WHERE id = ?', id);
      if (info.changes === 0) return { ok: false, error: `Category "${id}" not found` };
      audit(actor.username, actor.role, 'ai_delete_category', 'category', id, {}, ip);
      record(`حذف قسم: ${id}`, `Catégorie supprimée : ${id}`, true, true);
      return { ok: true, deletedId: id };
    }

    case 'list_products': {
      const limit = Math.max(1, Math.min(50, Math.floor(Number(args.limit) || 25)));
      const q = String(args.query || '').trim().toLowerCase();
      const cat = args.cat ? String(args.cat).trim() : '';
      const tp = args.type ? String(args.type).trim() : '';
      const hasAvail = args.avail !== undefined;
      const availBool = Boolean(args.avail);

      const all = rows<{
        id: string;
        cat: string;
        type: string;
        name_json: string;
        desc_json: string;
        price: number;
        old_price: number | null;
        avail: number;
        featured: number;
        needs_ref: number;
        pays_json: string;
        plans_json: string;
        sales_count: number;
      }>('SELECT id, cat, type, name_json, desc_json, price, old_price, avail, featured, needs_ref, pays_json, plans_json, sales_count FROM products ORDER BY featured DESC, sales_count DESC, created_at DESC');

      const filtered = all
        .filter((p) => {
          if (cat && p.cat !== cat) return false;
          if (tp && p.type !== tp) return false;
          if (hasAvail && Boolean(p.avail) !== availBool) return false;
          if (q) {
            const hay = `${p.name_json} ${p.desc_json} ${p.id}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        })
        .slice(0, limit)
        .map((p) => ({
          id: p.id,
          cat: p.cat,
          type: p.type,
          name: JSON.parse(p.name_json),
          price: Number(p.price),
          oldPrice: p.old_price != null ? Number(p.old_price) : null,
          avail: Boolean(p.avail),
          featured: Boolean(p.featured),
          needsRef: Boolean(p.needs_ref),
          pays: JSON.parse(p.pays_json || '[]'),
          plans: JSON.parse(p.plans_json || '[]'),
          salesCount: Number(p.sales_count || 0),
        }));

      record(`البحث في المنتجات (${filtered.length})`, `Produits consultés (${filtered.length})`, true, false);
      return { ok: true, count: filtered.length, products: filtered };
    }

    case 'create_product': {
      if (!hasPerm(actor, 'products')) {
        return { ok: false, error: 'Insufficient permissions (requires products permission)' };
      }
      const nameAr = String(args.nameAr || '').trim().slice(0, 140);
      if (!nameAr) return { ok: false, error: 'nameAr is required' };
      const nameFr = String(args.nameFr || nameAr).trim().slice(0, 140);
      const descAr = String(args.descAr || '').trim().slice(0, 500);
      const descFr = String(args.descFr || descAr).trim().slice(0, 500);

      const requestedCat = String(args.cat || '').trim();
      const validCat = row<{ id: string }>('SELECT id FROM categories WHERE id = ?', requestedCat);
      const firstCat = row<{ id: string }>('SELECT id FROM categories ORDER BY sort_order ASC LIMIT 1');
      const cat = (validCat?.id || firstCat?.id || 'shop') as CategoryId;
      const type: ProductType = args.type === 'digital' ? 'digital' : 'physical';
      const price = Math.max(0, Number(args.price) || 0);
      const oldPrice = args.oldPrice !== undefined && Number(args.oldPrice) > 0 ? Number(args.oldPrice) : null;
      const avail = args.avail !== undefined ? Boolean(args.avail) : true;
      const featured = Boolean(args.featured);
      const needsRef = Boolean(args.needsRef);

      const rawPays = Array.isArray(args.pays) ? args.pays.map(String) : type === 'digital' ? ['ccp', 'chargily'] : ['cod', 'ccp', 'chargily'];
      const validPays = rawPays.filter((p): p is PaymentMethod => ['cod', 'ccp', 'chargily'].includes(p));
      const finalPays = type === 'digital' ? validPays.filter((p) => p !== 'cod') : validPays;
      const pays: PaymentMethod[] = finalPays.length ? finalPays : type === 'digital' ? ['ccp'] : ['cod', 'ccp'];

      const rawPlans = Array.isArray(args.plans) ? args.plans : [];
      const plans: ProductPlan[] = rawPlans.map((pl: Record<string, unknown>) => ({
        id: 'pl_' + crypto.randomBytes(4).toString('hex'),
        label: {
          ar: String(pl?.labelAr || '').trim(),
          fr: String(pl?.labelFr || pl?.labelAr || '').trim(),
        },
        price: Math.max(0, Number(pl?.price) || 0),
        oldPrice: pl?.oldPrice != null && Number(pl.oldPrice) > 0 ? Number(pl.oldPrice) : null,
      }));

      const id = 'prd_' + crypto.randomBytes(6).toString('hex');
      const now = new Date().toISOString();

      run(
        `INSERT INTO products (
          id, cat, type, name_json, desc_json, price, old_price, avail, img,
          needs_ref, pays_json, plans_json, featured, sales_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?, 0, ?, ?)`,
        id,
        cat,
        type,
        JSON.stringify({ ar: nameAr, fr: nameFr }),
        JSON.stringify({ ar: descAr, fr: descFr }),
        price,
        oldPrice,
        avail ? 1 : 0,
        needsRef ? 1 : 0,
        JSON.stringify(pays),
        JSON.stringify(plans),
        featured ? 1 : 0,
        now,
        now,
      );
      audit(actor.username, actor.role, 'ai_create_product', 'product', id, { name: nameAr, price }, ip);
      record(`إضافة منتج: ${nameAr}`, `Produit créé : ${nameFr}`, true, true);
      return { ok: true, id, cat, type, name: { ar: nameAr, fr: nameFr }, price, oldPrice, avail, featured, pays };
    }

    case 'update_product': {
      if (!hasPerm(actor, 'products')) {
        return { ok: false, error: 'Insufficient permissions (requires products permission)' };
      }
      const id = String(args.id || '').trim();
      const existing = row<{
        id: string;
        cat: string;
        type: ProductType;
        name_json: string;
        desc_json: string;
        price: number;
        old_price: number | null;
        avail: number;
        needs_ref: number;
        pays_json: string;
        featured: number;
      }>('SELECT * FROM products WHERE id = ?', id);
      if (!existing) return { ok: false, error: `Product "${id}" not found` };

      const prevName = JSON.parse(existing.name_json) as { ar: string; fr: string };
      const prevDesc = JSON.parse(existing.desc_json) as { ar: string; fr: string };
      const prevPays = JSON.parse(existing.pays_json || '["cod","ccp","chargily"]') as PaymentMethod[];

      let cat = existing.cat;
      if (args.cat !== undefined) {
        const validCat = row<{ id: string }>('SELECT id FROM categories WHERE id = ?', String(args.cat).trim());
        if (validCat) cat = validCat.id;
      }
      const type: ProductType =
        args.type === 'digital' ? 'digital' : args.type === 'physical' ? 'physical' : existing.type;
      const nameAr = args.nameAr !== undefined ? String(args.nameAr).trim().slice(0, 140) : prevName.ar;
      const nameFr = args.nameFr !== undefined ? String(args.nameFr).trim().slice(0, 140) : prevName.fr;
      const descAr = args.descAr !== undefined ? String(args.descAr).trim().slice(0, 500) : prevDesc.ar;
      const descFr = args.descFr !== undefined ? String(args.descFr).trim().slice(0, 500) : prevDesc.fr;
      const price = args.price !== undefined ? Math.max(0, Number(args.price) || 0) : Number(existing.price);
      let oldPrice = existing.old_price;
      if (args.clearOldPrice === true || args.oldPrice === 0) {
        oldPrice = null;
      } else if (args.oldPrice !== undefined && Number(args.oldPrice) > 0) {
        oldPrice = Number(args.oldPrice);
      }
      const avail = args.avail !== undefined ? Boolean(args.avail) : Boolean(existing.avail);
      const featured = args.featured !== undefined ? Boolean(args.featured) : Boolean(existing.featured);
      const needsRef = args.needsRef !== undefined ? Boolean(args.needsRef) : Boolean(existing.needs_ref);

      let pays = prevPays;
      if (Array.isArray(args.pays)) {
        const valid = args.pays.map(String).filter((p): p is PaymentMethod => ['cod', 'ccp', 'chargily'].includes(p));
        pays = type === 'digital' ? valid.filter((p) => p !== 'cod') : valid;
        if (!pays.length) pays = type === 'digital' ? ['ccp'] : ['cod', 'ccp'];
      } else if (type === 'digital') {
        pays = pays.filter((p) => p !== 'cod');
        if (!pays.length) pays = ['ccp'];
      }

      const now = new Date().toISOString();
      run(
        `UPDATE products SET cat = ?, type = ?, name_json = ?, desc_json = ?, price = ?, old_price = ?,
         avail = ?, needs_ref = ?, pays_json = ?, featured = ?, updated_at = ? WHERE id = ?`,
        cat,
        type,
        JSON.stringify({ ar: nameAr, fr: nameFr }),
        JSON.stringify({ ar: descAr, fr: descFr }),
        price,
        oldPrice,
        avail ? 1 : 0,
        needsRef ? 1 : 0,
        JSON.stringify(pays),
        featured ? 1 : 0,
        now,
        id,
      );
      audit(actor.username, actor.role, 'ai_update_product', 'product', id, { name: nameAr, price, avail }, ip);
      record(`تحديث منتج: ${nameAr}`, `Produit mis à jour : ${nameFr}`, true, true);
      return { ok: true, id, name: { ar: nameAr, fr: nameFr }, price, oldPrice, avail, featured };
    }

    case 'delete_product': {
      if (!hasPerm(actor, 'products')) {
        return { ok: false, error: 'Insufficient permissions (requires products permission)' };
      }
      const id = String(args.id || '').trim();
      const existing = row<{ name_json: string }>('SELECT name_json FROM products WHERE id = ?', id);
      if (!existing) return { ok: false, error: `Product "${id}" not found` };
      run('DELETE FROM products WHERE id = ?', id);
      audit(actor.username, actor.role, 'ai_delete_product', 'product', id, {}, ip);
      const nm = JSON.parse(existing.name_json) as { ar: string; fr: string };
      record(`حذف منتج: ${nm.ar}`, `Produit supprimé : ${nm.fr}`, true, true);
      return { ok: true, deletedId: id };
    }

    case 'list_orders': {
      if (!hasPerm(actor, 'orders')) {
        return { ok: false, error: 'Insufficient permissions (requires orders permission)' };
      }
      const limit = Math.max(1, Math.min(50, Math.floor(Number(args.limit) || 20)));
      const q = String(args.query || '').trim().toLowerCase();
      const statusFilter = args.status ? String(args.status).trim() : '';
      const payStatusFilter = args.paymentStatus ? String(args.paymentStatus).trim() : '';

      const all = rows<{
        id: string;
        code: string;
        customer_name: string;
        customer_phone: string;
        wilaya: string;
        address: string;
        items_json: string;
        subtotal: number;
        payment_method: string;
        payment_status: string;
        status: string;
        bill_ref: string;
        delivery_data: string;
        notes: string;
        created_at: string;
      }>('SELECT * FROM orders ORDER BY created_at DESC');

      const filtered = all
        .filter((o) => {
          if (statusFilter && o.status !== statusFilter) return false;
          if (payStatusFilter && o.payment_status !== payStatusFilter) return false;
          if (q) {
            const hay = `${o.code} ${o.customer_name} ${o.customer_phone} ${o.wilaya}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        })
        .slice(0, limit)
        .map((o) => ({
          id: o.id,
          code: o.code,
          customerName: o.customer_name,
          customerPhone: o.customer_phone,
          wilaya: o.wilaya,
          subtotalDzd: Number(o.subtotal),
          paymentMethod: o.payment_method,
          paymentStatus: o.payment_status,
          status: o.status,
          billRef: o.bill_ref,
          deliveryData: o.delivery_data,
          notes: o.notes,
          items: JSON.parse(o.items_json || '[]').map((it: { name: { ar: string; fr: string }; qty: number; unitPrice: number }) => ({
            name: it.name,
            qty: it.qty,
            unitPrice: it.unitPrice,
          })),
          createdAt: o.created_at,
        }));

      record(`مراجعة الطلبات (${filtered.length})`, `Commandes consultées (${filtered.length})`, true, false);
      return { ok: true, count: filtered.length, orders: filtered };
    }

    case 'update_order': {
      if (!hasPerm(actor, 'orders')) {
        return { ok: false, error: 'Insufficient permissions (requires orders permission)' };
      }
      const key = String(args.orderIdOrCode || '').trim();
      const existing = row<{
        id: string;
        code: string;
        status: OrderStatus;
        payment_status: PaymentStatus;
        delivery_data: string;
        notes: string;
      }>('SELECT id, code, status, payment_status, delivery_data, notes FROM orders WHERE id = ? OR UPPER(code) = UPPER(?)', key, key);
      if (!existing) return { ok: false, error: `Order "${key}" not found` };

      const validStatuses: OrderStatus[] = ['pending', 'confirmed', 'processing', 'delivered', 'cancelled'];
      const validPayStatuses: PaymentStatus[] = ['unpaid', 'pending_review', 'paid', 'failed'];

      const status =
        args.status && validStatuses.includes(args.status as OrderStatus)
          ? (args.status as OrderStatus)
          : existing.status;
      const paymentStatus =
        args.paymentStatus && validPayStatuses.includes(args.paymentStatus as PaymentStatus)
          ? (args.paymentStatus as PaymentStatus)
          : existing.payment_status;
      const deliveryData = args.deliveryData !== undefined ? String(args.deliveryData) : existing.delivery_data;
      const notes = args.notes !== undefined ? String(args.notes) : existing.notes;
      const now = new Date().toISOString();

      run(
        'UPDATE orders SET status = ?, payment_status = ?, delivery_data = ?, notes = ?, updated_at = ? WHERE id = ?',
        status,
        paymentStatus,
        deliveryData,
        notes,
        now,
        existing.id,
      );
      audit(actor.username, actor.role, 'ai_update_order', 'order', existing.code, { status, paymentStatus }, ip);
      record(`تحديث الطلب ${existing.code}`, `Commande ${existing.code} mise à jour`, true, true);
      return { ok: true, code: existing.code, status, paymentStatus, deliveryData };
    }

    case 'list_subscriptions': {
      if (!hasPerm(actor, 'subscriptions')) {
        return { ok: false, error: 'Insufficient permissions (requires subscriptions permission)' };
      }
      const statusFilter = args.status ? String(args.status).trim() : '';
      const q = String(args.query || '').trim().toLowerCase();
      const expiringDays =
        args.expiringWithinDays !== undefined ? Math.max(0, Math.floor(Number(args.expiringWithinDays))) : null;

      const list = rows<{
        id: string;
        customer_name: string;
        customer_phone: string;
        service_name: string;
        plan_label: string;
        account_info: string;
        start_date: string;
        end_date: string;
        status: string;
        notes: string;
      }>('SELECT * FROM subscriptions ORDER BY end_date ASC');

      const nowMs = Date.now();
      const filtered = list
        .filter((s) => {
          if (statusFilter && s.status !== statusFilter) return false;
          if (expiringDays !== null) {
            if (s.status === 'cancelled' || s.status === 'expired') return false;
            const endMs = new Date(s.end_date).getTime();
            if (Number.isNaN(endMs) || endMs > nowMs + expiringDays * 86400_000) return false;
          }
          if (q) {
            const hay = `${s.customer_name} ${s.customer_phone} ${s.service_name} ${s.plan_label}`.toLowerCase();
            if (!hay.includes(q)) return false;
          }
          return true;
        })
        .slice(0, 40)
        .map((s) => ({
          id: s.id,
          customerName: s.customer_name,
          customerPhone: s.customer_phone,
          serviceName: s.service_name,
          planLabel: s.plan_label,
          accountInfo: s.account_info,
          startDate: s.start_date,
          endDate: s.end_date,
          status: s.status,
        }));

      record(`فحص الاشتراكات (${filtered.length})`, `Abonnements consultés (${filtered.length})`, true, false);
      return { ok: true, count: filtered.length, subscriptions: filtered };
    }

    case 'create_subscription': {
      if (!hasPerm(actor, 'subscriptions')) {
        return { ok: false, error: 'Insufficient permissions (requires subscriptions permission)' };
      }
      const customerName = String(args.customerName || '').trim();
      const customerPhone = String(args.customerPhone || '').trim();
      const serviceName = String(args.serviceName || '').trim();
      const endDate = String(args.endDate || '').trim();
      if (!customerName || !customerPhone || !serviceName || !endDate) {
        return { ok: false, error: 'customerName, customerPhone, serviceName, and endDate are required' };
      }
      const id = 'sub_' + crypto.randomBytes(6).toString('hex');
      const now = new Date().toISOString();
      const startDate = String(args.startDate || now.slice(0, 10)).trim();
      run(
        `INSERT INTO subscriptions (
          id, order_id, order_code, customer_name, customer_phone, service_name,
          plan_label, account_info, start_date, end_date, status, notes, created_at
        ) VALUES (?, NULL, '', ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
        id,
        customerName,
        customerPhone,
        serviceName,
        String(args.planLabel || '').trim(),
        String(args.accountInfo || '').trim(),
        startDate,
        endDate,
        String(args.notes || '').trim(),
        now,
      );
      audit(actor.username, actor.role, 'ai_create_subscription', 'subscription', id, { serviceName }, ip);
      record(`إضافة اشتراك: ${serviceName}`, `Abonnement ajouté : ${serviceName}`, true, true);
      return { ok: true, id, customerName, serviceName, startDate, endDate };
    }

    case 'update_subscription': {
      if (!hasPerm(actor, 'subscriptions')) {
        return { ok: false, error: 'Insufficient permissions (requires subscriptions permission)' };
      }
      const id = String(args.id || '').trim();
      const existing = row<{ id: string }>('SELECT id FROM subscriptions WHERE id = ?', id);
      if (!existing) return { ok: false, error: `Subscription "${id}" not found` };
      run(
        'UPDATE subscriptions SET status = COALESCE(?, status), end_date = COALESCE(?, end_date), account_info = COALESCE(?, account_info), notes = COALESCE(?, notes) WHERE id = ?',
        args.status ? String(args.status) : null,
        args.endDate ? String(args.endDate) : null,
        args.accountInfo !== undefined ? String(args.accountInfo) : null,
        args.notes !== undefined ? String(args.notes) : null,
        id,
      );
      audit(actor.username, actor.role, 'ai_update_subscription', 'subscription', id, { status: args.status }, ip);
      record(`تحديث اشتراك: ${id}`, `Abonnement mis à jour : ${id}`, true, true);
      return { ok: true, id };
    }

    case 'update_store_settings': {
      if (!hasPerm(actor, 'settings')) {
        return { ok: false, error: 'Insufficient permissions (requires settings permission)' };
      }
      const prev = getSetting<PublicSettings>('store_config', {} as PublicSettings);
      const next: PublicSettings = {
        ...prev,
        storeName: {
          ar: args.storeNameAr !== undefined ? String(args.storeNameAr).trim() : prev.storeName?.ar || 'مكتبة سليمي',
          fr: args.storeNameFr !== undefined ? String(args.storeNameFr).trim() : prev.storeName?.fr || 'Librairie Slimi',
        },
        address: {
          ar: args.addressAr !== undefined ? String(args.addressAr).trim() : prev.address?.ar || '',
          fr: args.addressFr !== undefined ? String(args.addressFr).trim() : prev.address?.fr || '',
        },
        workingHours: {
          ar: args.workingHoursAr !== undefined ? String(args.workingHoursAr).trim() : prev.workingHours?.ar || '',
          fr: args.workingHoursFr !== undefined ? String(args.workingHoursFr).trim() : prev.workingHours?.fr || '',
        },
        announcement: {
          ar: args.announcementAr !== undefined ? String(args.announcementAr).trim() : prev.announcement?.ar || '',
          fr: args.announcementFr !== undefined ? String(args.announcementFr).trim() : prev.announcement?.fr || '',
        },
        announcementConfig: {
          enabled:
            args.announcementEnabled !== undefined
              ? Boolean(args.announcementEnabled)
              : args.announcementAr !== undefined || args.announcementFr !== undefined
                ? Boolean(
                    String(args.announcementAr ?? prev.announcement?.ar ?? '').trim() ||
                      String(args.announcementFr ?? prev.announcement?.fr ?? '').trim(),
                  )
                : prev.announcementConfig?.enabled ?? true,
          tone: (['navy', 'crimson', 'emerald', 'amber'].includes(String(args.announcementTone))
            ? String(args.announcementTone)
            : prev.announcementConfig?.tone || 'navy') as AnnouncementConfig['tone'],
          mode: (['ticker', 'static'].includes(String(args.announcementMode))
            ? String(args.announcementMode)
            : prev.announcementConfig?.mode || 'ticker') as AnnouncementConfig['mode'],
          speed: (['slow', 'normal', 'fast'].includes(String(args.announcementSpeed))
            ? String(args.announcementSpeed)
            : prev.announcementConfig?.speed || 'normal') as AnnouncementConfig['speed'],
          dismissible:
            args.announcementDismissible !== undefined
              ? Boolean(args.announcementDismissible)
              : prev.announcementConfig?.dismissible ?? false,
          ctaTarget: (['', 'shop', 'track', 'contact'].includes(String(args.announcementCtaTarget ?? ''))
            ? String(args.announcementCtaTarget ?? prev.announcementConfig?.ctaTarget ?? '')
            : prev.announcementConfig?.ctaTarget || '') as AnnouncementConfig['ctaTarget'],
          ctaLabel: {
            ar:
              args.announcementCtaLabelAr !== undefined
                ? String(args.announcementCtaLabelAr).trim()
                : prev.announcementConfig?.ctaLabel?.ar || '',
            fr:
              args.announcementCtaLabelFr !== undefined
                ? String(args.announcementCtaLabelFr).trim()
                : prev.announcementConfig?.ctaLabel?.fr || '',
          },
        },
        phone: args.phone !== undefined ? String(args.phone).trim() : prev.phone,
        whatsapp: args.whatsapp !== undefined ? String(args.whatsapp).trim() : prev.whatsapp,
        ccpRip: args.ccpRip !== undefined ? String(args.ccpRip).trim() : prev.ccpRip,
        ccpName: args.ccpName !== undefined ? String(args.ccpName).trim() : prev.ccpName,
      };
      setSetting('store_config', next);
      audit(actor.username, actor.role, 'ai_update_settings', 'settings', 'store_config', {}, ip);
      record('تحديث إعدادات المتجر', 'Paramètres du site mis à jour', true, true);
      return {
        ok: true,
        announcement: next.announcement,
        announcementConfig: next.announcementConfig,
        workingHours: next.workingHours,
        phone: next.phone,
        whatsapp: next.whatsapp,
      };
    }

    case 'list_audit_logs': {
      if (!hasPerm(actor, 'audit')) {
        return { ok: false, error: 'Insufficient permissions (requires audit permission)' };
      }
      const limit = Math.max(1, Math.min(40, Math.floor(Number(args.limit) || 15)));
      const logs = rows<{
        id: number;
        actor_username: string;
        action: string;
        target_type: string;
        target_id: string;
        created_at: string;
      }>('SELECT id, actor_username, action, target_type, target_id, created_at FROM audit_logs ORDER BY id DESC LIMIT ?', limit);
      record('عرض سجل العمليات', 'Journal d’audit consulté', true, false);
      return { ok: true, logs };
    }

    case 'get_reviews_summary': {
      const limit = Math.max(1, Math.min(40, Math.floor(Number(args.limit) || 15)));
      const productId = args.productId ? String(args.productId).trim() : '';
      const list = productId
        ? rows<{
            id: string;
            product_id: string;
            product_name_json: string | null;
            author_name: string;
            rating: number;
            comment: string;
            created_at: string;
          }>(
            `SELECT r.*, p.name_json as product_name_json
             FROM reviews r
             LEFT JOIN products p ON p.id = r.product_id
             WHERE r.product_id = ?
             ORDER BY r.created_at DESC
             LIMIT ?`,
            productId,
            limit,
          )
        : rows<{
            id: string;
            product_id: string;
            product_name_json: string | null;
            author_name: string;
            rating: number;
            comment: string;
            created_at: string;
          }>(
            `SELECT r.*, p.name_json as product_name_json
             FROM reviews r
             LEFT JOIN products p ON p.id = r.product_id
             ORDER BY r.created_at DESC
             LIMIT ?`,
            limit,
          );
      const total = row<{ cnt: number; avgRating: number | null }>(
        'SELECT COUNT(*) as cnt, AVG(rating) as avgRating FROM reviews',
      );
      record('مراجعة تقييمات الزبائن', 'Avis clients consultés', true, false);
      return {
        ok: true,
        totalReviews: Number(total?.cnt || 0),
        overallAverageRating: total?.avgRating ? Number(Number(total.avgRating).toFixed(1)) : 0,
        reviews: list.map((r) => {
          let productName: { ar?: string; fr?: string } | null = null;
          if (r.product_name_json) {
            try {
              productName = JSON.parse(r.product_name_json) as { ar?: string; fr?: string };
            } catch {
              productName = null;
            }
          }
          return {
            id: r.id,
            productId: r.product_id,
            productName,
            authorName: r.author_name,
            rating: Number(r.rating),
            comment: r.comment,
            createdAt: r.created_at,
          };
        }),
      };
    }

    case 'navigate_admin_ui': {
      const validTabs = ['dashboard', 'assistant', 'orders', 'categories', 'products', 'subscriptions', 'staff', 'settings', 'audit'];
      if (args.tab && validTabs.includes(String(args.tab))) {
        ctx.navigateTab.value = String(args.tab);
        record(`فتح تبويب: ${String(args.tab)}`, `Navigation vers : ${String(args.tab)}`, true, false);
      }
      if (args.storeView === 'home' || args.storeView === 'shop') {
        ctx.openStoreView.value = args.storeView;
        record(`معاينة المتجر: ${args.storeView}`, `Aperçu boutique : ${args.storeView}`, true, false);
      }
      return { ok: true, navigateTab: ctx.navigateTab.value, openStoreView: ctx.openStoreView.value };
    }

    default:
      return { ok: false, error: `Unknown tool: ${name}` };
  }
}

export function getAdminAiHistory(userId: string): AdminAiMessage[] {
  const list = rows<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    actions_json: string;
    created_at: string;
  }>('SELECT id, role, content, actions_json, created_at FROM admin_ai_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT 80', userId);

  return sanitizeAiMessages(
    list.map((m) => {
      let parsedActions: AdminAiActionSummary[] = [];
      try {
        parsedActions = JSON.parse(m.actions_json || '[]') as AdminAiActionSummary[];
      } catch {
        parsedActions = [];
      }
      return {
        id: m.id,
        role: m.role,
        content: m.content,
        actions: parsedActions,
        createdAt: m.created_at,
      };
    }),
  );
}

export function clearAdminAiHistory(userId: string): void {
  run('DELETE FROM admin_ai_messages WHERE user_id = ?', userId);
}

function isTransientGeminiError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  const status = (err as { status?: number })?.status;
  return (
    status === 503 ||
    status === 500 ||
    status === 429 ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('high demand')
  );
}

async function generateWithResilientModel<T>(
  runForModel: (model: string) => Promise<T>,
  preferredModel = PRIMARY_GEMINI_MODEL,
): Promise<{ result: T; modelUsed: string }> {
  const modelsToTry =
    preferredModel === PRIMARY_GEMINI_MODEL
      ? [PRIMARY_GEMINI_MODEL, PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODEL, FALLBACK_GEMINI_MODEL]
      : [preferredModel, preferredModel];

  let lastErr: unknown;
  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    try {
      const result = await runForModel(model);
      return { result, modelUsed: model };
    } catch (err) {
      lastErr = err;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.warn(`[adminAi] attempt ${i + 1} failed on ${model}:`, errMsg.slice(0, 260));
      if (!isTransientGeminiError(err) || i === modelsToTry.length - 1) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 550 * (i + 1)));
    }
  }
  throw lastErr;
}

export async function runAdminAiTurn(params: {
  actor: StaffUser;
  message: string;
  lang: Lang;
  activeTab: string;
  ip: string;
}): Promise<{
  userMessage: AdminAiMessage;
  assistantMessage: AdminAiMessage;
  dataChanged: boolean;
  navigateTab?: string;
  openStoreView?: 'home' | 'shop';
}> {
  const ai = createGeminiClient();
  const { actor, message, lang, activeTab, ip } = params;
  const cleanMsg = message.trim();
  const historyRows = rows<{ role: 'user' | 'assistant'; content: string }>(
    'SELECT role, content FROM admin_ai_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 16',
    actor.id,
  ).reverse();

  const ctx: ToolContext = {
    actor,
    ip,
    lang,
    actions: [],
    dataChanged: { value: false },
    navigateTab: {},
    openStoreView: {},
  };

  let replyText = '';
  let usedAi = false;

  if (ai) {
    try {
      const systemInstruction = `أنت "مساعد المدير الذكي" (Assistant IA Manager) الرسمي الخاص بمدير وموظفي متجر «مكتبة سليمي | Librairie Slimi» في حطاطبة، تيبازة، الجزائر.
المتجر يبيع: قرطاسية وأدوات مدرسية ومكتبية، ألعاب أطفال، إكسسوارات الهاتف، شحن الألعاب الإلكترونية، اشتراكات وتوثيق التطبيقات (+Snapchat وغيرها)، ودفع الفواتير. العملة هي الدينار الجزائري (دج / DA).

المستخدم الحالي: ${actor.displayName} (الدور: ${actor.role === 'owner' ? 'المالك بصلاحيات كاملة' : 'موظف'}, الصلاحيات: ${actor.permissions.join(', ')}).
التبويب المفتوح حاليًا في لوحة الإدارة: ${activeTab}.
لغة الواجهة الحالية: ${lang === 'fr' ? 'الفرنسية (أجب بالفرنسية ما لم يكتب المدير بالعربية)' : 'العربية (أجب بالعربية بوضوح واحترافية ما لم يكتب المدير بالفرنسية)'}.

قواعد العمل والتحكم في الموقع:
1. لديك أدوات (Tools) حقيقية للتحكم الكامل في قاعدة بيانات وإعدادات الموقع: قراءة الإحصائيات، إدارة الأقسام، إضافة/تعديل/حذف المنتجات، مراجعة وتحديث الطلبات داخل الموقع، متابعة الاشتراكات، قراءة تقييمات الزبائن، وتعديل إعدادات المتجر.
2. استدع الأدوات مباشرة لتنفيذ طلبات المدير بدقة.`;

      const sanitizedHistory: Content[] = [];
      for (const h of historyRows) {
        const text = (h.content || '').trim();
        if (!text) continue;
        const role: 'user' | 'model' = h.role === 'assistant' ? 'model' : 'user';
        if (sanitizedHistory.length === 0 && role === 'model') continue;
        const last = sanitizedHistory[sanitizedHistory.length - 1];
        if (last && last.role === role && Array.isArray(last.parts)) {
          last.parts.push({ text });
        } else {
          sanitizedHistory.push({ role, parts: [{ text }] });
        }
      }

      const contents: Content[] = [
        ...sanitizedHistory,
        {
          role: 'user',
          parts: [{ text: cleanMsg }],
        },
      ];

      let activeModel = PRIMARY_GEMINI_MODEL;
      const initialCall = await generateWithResilientModel(
        (model) =>
          ai.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction,
              ...(model === PRIMARY_GEMINI_MODEL
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
              tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
            },
          }),
        activeModel,
      );
      let response = initialCall.result;
      activeModel = initialCall.modelUsed;

      for (let step = 0; step < 8; step++) {
        const fnCalls = response.functionCalls;
        if (!fnCalls || fnCalls.length === 0) {
          break;
        }

        const modelContent = response.candidates?.[0]?.content;
        if (modelContent) {
          contents.push(modelContent);
        }

        const fnResponseParts: Part[] = [];
        for (const call of fnCalls) {
          const toolName = call.name || '';
          const toolArgs = (call.args || {}) as Record<string, unknown>;
          const result = await executeTool(toolName, toolArgs, ctx);
          fnResponseParts.push({
            functionResponse: {
              id: call.id,
              name: toolName,
              response: { result },
            },
          });
        }

        contents.push({
          role: 'user',
          parts: fnResponseParts,
        });

        const nextCall = await generateWithResilientModel(
          (model) =>
            ai.models.generateContent({
              model,
              contents,
              config: {
                systemInstruction,
                ...(model === PRIMARY_GEMINI_MODEL
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
                tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
              },
            }),
          activeModel,
        );
        response = nextCall.result;
        activeModel = nextCall.modelUsed;
      }

      replyText =
        (response.text || '').trim() ||
        (lang === 'fr'
          ? 'Action traitée. Consultez les détails ci-dessus.'
          : 'تم تنفيذ المطلوب. يمكنك مراجعة تفاصيل الإجراءات أعلاه.');
      usedAi = true;
    } catch (err) {
      console.warn('[adminAi] Gemini API call failed, using smart local fallback:', err);
    }
  }

  if (!usedAi) {
    const lower = cleanMsg.toLowerCase();
    if (lower.includes('أضف') || lower.includes('إضافة') || lower.includes('creer') || lower.includes('add') || lower.includes('جديد')) {
      if (lower.includes('قسم') || lower.includes('category')) {
        const catName = cleanMsg.replace(/(?:أضف|إضافة|قسم|category)/gi, '').trim() || 'قسم جديد';
        await executeTool('create_category', { nameAr: catName, nameFr: catName }, ctx);
        replyText = lang === 'fr' ? `Catégorie "${catName}" créée.` : `تمت إضافة القسم "${catName}" بنجاح.`;
      } else {
        const nameMatch = cleanMsg.match(/(?:منتج|product|كتاب|رواية|لعبة)\s+([^بسعر]+)(?:بسعر|price)?\s*(\d+)?/i);
        const priceMatch = cleanMsg.match(/(\d+)\s*(?:دج|da|dzd)?/i);
        const name = nameMatch ? nameMatch[1].trim() : cleanMsg;
        const price = priceMatch ? Number(priceMatch[1]) : 700;
        await executeTool('create_product', { cat: 'shop', type: 'physical', nameAr: name, price }, ctx);
        replyText = lang === 'fr'
          ? `Produit "${name}" ajouté (${price} DA).`
          : `تمت إضافة المنتج "${name}" بسعر ${price} دج بنجاح.`;
      }
    } else if (lower.includes('حالة الطلب') || lower.includes('تحديث الطلب') || lower.includes('order')) {
      const codeMatch = cleanMsg.match(/slm-\d+/i);
      if (codeMatch) {
        const code = codeMatch[0];
        const st = lower.includes('تم التسليم') || lower.includes('delivered') ? 'delivered' : lower.includes('مؤكد') || lower.includes('confirmed') ? 'confirmed' : 'processing';
        await executeTool('update_order', { orderIdOrCode: code, status: st }, ctx);
        replyText = lang === 'fr' ? `Commande ${code} mise à jour.` : `تم تحديث حالة الطلب ${code} بنجاح.`;
      } else {
        await executeTool('list_orders', { limit: 10 }, ctx);
        replyText = lang === 'fr' ? "Voici la liste des commandes :" : "إليك أحدث الطلبات المسجلة في المتجر:";
      }
    } else if (lower.includes('ملخص') || lower.includes('إحصائي') || lower.includes('overview') || lower.includes('stats')) {
      await executeTool('get_store_overview', {}, ctx);
      await executeTool('list_orders', { limit: 5 }, ctx);
      replyText = lang === 'fr'
        ? "Voici le résumé de la boutique et les indicateurs clés."
        : "إليك ملخص إحصائيات متجر مكتبة سليمي والطلبات الأخيرة:";
    } else if (lower.includes('منتج') || lower.includes('قائمة') || lower.includes('products')) {
      await executeTool('list_products', { limit: 15 }, ctx);
      replyText = lang === 'fr' ? "Voici le catalogue des produits :" : "إليك كتالوج منتجات المتجر الحالي:";
    } else if (lower.includes('اشتراك') || lower.includes('sub')) {
      await executeTool('list_subscriptions', {}, ctx);
      replyText = lang === 'fr' ? "Voici les abonnements en cours :" : "إليك قائمة الاشتراكات الرقمية النشطة:";
    } else if (lower.includes('إعلان') || lower.includes('شريط') || lower.includes('announcement')) {
      const text = cleanMsg.replace(/حدث إعلان الموقع[:：]?/i, '').trim();
      await executeTool('update_store_settings', { announcementAr: text, announcementFr: text }, ctx);
      replyText = lang === 'fr' ? "Annonce du site mise à jour avec succès." : "تم تحديث شريط إعلانات الموقع بنجاح.";
    } else if (lower.includes('الطلبات') || lower.includes('commands')) {
      await executeTool('navigate_admin_ui', { tab: 'orders' }, ctx);
      replyText = lang === 'fr' ? "Navigation vers la gestion des commandes." : "تم الانتقال إلى قسم إدارة الطلبات.";
    } else {
      await executeTool('get_store_overview', {}, ctx);
      replyText = lang === 'fr'
        ? `Bonjour ${actor.displayName}. Assistant IA prêt. Vous pouvez demander : résumé, lister les produits, gérer les commandes, ou mettre à jour l'annonce.`
        : `مرحبًا ${actor.displayName}. أنا مساعد المدير الذكي لمكتبة سليمي (حطاطبة، تيبازة). يمكنك أمري بـ: عرض ملخص المتجر، سرد المنتجات، تحديث الطلبات، أو تعديل إعلان الموقع.`;
    }
  }

  const nowUser = new Date().toISOString();
  const nowAssistant = new Date(Date.now() + 1).toISOString();
  const userMsg: AdminAiMessage = {
    id: 'aim_' + crypto.randomBytes(8).toString('hex'),
    role: 'user',
    content: cleanMsg,
    actions: [],
    createdAt: nowUser,
  };
  const assistantMsg: AdminAiMessage = {
    id: 'aim_' + crypto.randomBytes(8).toString('hex'),
    role: 'assistant',
    content: replyText,
    actions: ctx.actions,
    createdAt: nowAssistant,
  };

  run(
    'INSERT INTO admin_ai_messages (id, user_id, role, content, actions_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    userMsg.id,
    actor.id,
    'user',
    userMsg.content,
    '[]',
    userMsg.createdAt,
  );
  run(
    'INSERT INTO admin_ai_messages (id, user_id, role, content, actions_json, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    assistantMsg.id,
    actor.id,
    'assistant',
    assistantMsg.content,
    JSON.stringify(ctx.actions),
    assistantMsg.createdAt,
  );

  return {
    userMessage: userMsg,
    assistantMessage: assistantMsg,
    dataChanged: ctx.dataChanged.value,
    navigateTab: ctx.navigateTab.value,
    openStoreView: ctx.openStoreView.value,
  };
}
