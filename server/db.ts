import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import type { PublicSettings } from '../src/shared/types.ts';
import { DEFAULT_CATEGORIES } from '../src/shared/categories.ts';
import { computeReviewStats } from '../src/shared/reviews.ts';

const dataDir = path.resolve(process.env.DATA_DIR || './data');
fs.mkdirSync(dataDir, { recursive: true });

export const dbPath = path.join(dataDir, 'slimi.sqlite');
export const db = new DatabaseSync(dbPath);

db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 5000;');
db.exec('PRAGMA foreign_keys = ON;');

export function run(sql: string, ...params: SQLInputValue[]) {
  return db.prepare(sql).run(...params);
}

export function row<T = Record<string, unknown>>(sql: string, ...params: SQLInputValue[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}

export function rows<T = Record<string, unknown>>(sql: string, ...params: SQLInputValue[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}

export function addCol(table: string, col: string, def: string): void {
  if (!/^[a-z_][a-z0-9_]*$/i.test(table) || !/^[a-z_][a-z0-9_]*$/i.test(col)) {
    throw new Error('Invalid identifier in addCol');
  }
  const existing = rows<{ name: string }>(`PRAGMA table_info(${table})`);
  if (!existing.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  }
}

export function getSetting<T = unknown>(key: string, fallback: T): T {
  const rec = row<{ value_json: string }>('SELECT value_json FROM settings WHERE key = ?', key);
  if (!rec) return fallback;
  try {
    return JSON.parse(rec.value_json) as T;
  } catch {
    return fallback;
  }
}

export function setSetting(key: string, value: unknown): void {
  const json = JSON.stringify(value);
  run(
    `INSERT INTO settings (key, value_json) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    key,
    json,
  );
}

export function audit(
  actorUsername: string,
  actorRole: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {},
  ip = '',
): void {
  run(
    `INSERT INTO audit_logs (actor_username, actor_role, action, target_type, target_id, details_json, ip, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    actorUsername,
    actorRole,
    action,
    targetType,
    targetId,
    JSON.stringify(details),
    ip,
    new Date().toISOString(),
  );
}

export function initSchema(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'staff',
      password_hash TEXT NOT NULL,
      permissions_json TEXT NOT NULL DEFAULT '[]',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      username TEXT NOT NULL,
      role TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      cat TEXT NOT NULL,
      type TEXT NOT NULL,
      name_json TEXT NOT NULL,
      desc_json TEXT NOT NULL,
      price REAL NOT NULL,
      old_price REAL,
      avail INTEGER NOT NULL DEFAULT 1,
      img TEXT NOT NULL DEFAULT '',
      needs_ref INTEGER NOT NULL DEFAULT 0,
      pays_json TEXT NOT NULL DEFAULT '["cod","ccp","chargily"]',
      plans_json TEXT NOT NULL DEFAULT '[]',
      featured INTEGER NOT NULL DEFAULT 0,
      sales_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      customer_id TEXT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      wilaya TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT '',
      items_json TEXT NOT NULL,
      subtotal REAL NOT NULL,
      payment_method TEXT NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'unpaid',
      status TEXT NOT NULL DEFAULT 'pending',
      bill_ref TEXT NOT NULL DEFAULT '',
      proof_media_id TEXT NOT NULL DEFAULT '',
      delivery_data TEXT NOT NULL DEFAULT '',
      chargily_checkout_id TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      lang TEXT NOT NULL DEFAULT 'ar',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      order_id TEXT,
      order_code TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      service_name TEXT NOT NULL,
      plan_label TEXT NOT NULL DEFAULT '',
      account_info TEXT NOT NULL DEFAULT '',
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS media (
      id TEXT PRIMARY KEY,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      data BLOB NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name_json TEXT NOT NULL,
      desc_json TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'package',
      img TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      actor_username TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      details_json TEXT NOT NULL DEFAULT '{}',
      ip TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_ai_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      actions_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      approved INTEGER NOT NULL DEFAULT 1,
      admin_reply TEXT NOT NULL DEFAULT '',
      is_verified_purchase INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);

    CREATE TABLE IF NOT EXISTS inventory_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id TEXT NOT NULL,
      change_amount INTEGER NOT NULL,
      previous_stock INTEGER NOT NULL,
      new_stock INTEGER NOT NULL,
      reason TEXT NOT NULL,
      actor_username TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_logs(product_id);
  `);

  // Safe incremental migrations for future evolutions
  addCol('products', 'plans_json', "TEXT NOT NULL DEFAULT '[]'");
  addCol('products', 'featured', 'INTEGER NOT NULL DEFAULT 0');
  addCol('products', 'sales_count', 'INTEGER NOT NULL DEFAULT 0');
  addCol('products', 'sku', "TEXT NOT NULL DEFAULT ''");
  addCol('products', 'cost_price', 'REAL DEFAULT NULL');
  addCol('products', 'stock', 'INTEGER NOT NULL DEFAULT 50');
  addCol('products', 'low_stock_threshold', 'INTEGER NOT NULL DEFAULT 5');
  addCol('products', 'gallery_json', "TEXT NOT NULL DEFAULT '[]'");

  addCol('orders', 'chargily_checkout_id', "TEXT NOT NULL DEFAULT ''");
  addCol('orders', 'lang', "TEXT NOT NULL DEFAULT 'ar'");
  addCol('orders', 'delivery_fee', 'REAL NOT NULL DEFAULT 0');
  addCol('orders', 'status_history_json', "TEXT NOT NULL DEFAULT '[]'");
  addCol('orders', 'internal_notes', "TEXT NOT NULL DEFAULT ''");
  addCol('orders', 'tracking_number', "TEXT NOT NULL DEFAULT ''");
  addCol('orders', 'delivery_provider', "TEXT NOT NULL DEFAULT ''");

  addCol('reviews', 'approved', 'INTEGER NOT NULL DEFAULT 1');
  addCol('reviews', 'admin_reply', "TEXT NOT NULL DEFAULT ''");
  addCol('reviews', 'is_verified_purchase', 'INTEGER NOT NULL DEFAULT 0');

  // Seed or non-destructively align the 7 store categories (never deletes existing rows)
  const catCount = row<{ cnt: number }>('SELECT COUNT(*) as cnt FROM categories')?.cnt || 0;
  const now = new Date().toISOString();
  if (catCount === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      run(
        `INSERT INTO categories (id, name_json, desc_json, icon, img, sort_order, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        cat.id,
        JSON.stringify(cat.name),
        JSON.stringify(cat.desc),
        cat.icon,
        cat.img,
        cat.sortOrder,
        cat.active ? 1 : 0,
        now,
      );
    }
  } else {
    const hadBooks = Boolean(row('SELECT id FROM categories WHERE id = ?', 'books'));
    const hadCosmetics = Boolean(row('SELECT id FROM categories WHERE id = ?', 'cosmetics'));

    for (const cat of DEFAULT_CATEGORIES) {
      run(
        `INSERT OR IGNORE INTO categories (id, name_json, desc_json, icon, img, sort_order, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        cat.id,
        JSON.stringify(cat.name),
        JSON.stringify(cat.desc),
        cat.icon,
        cat.img,
        cat.sortOrder,
        cat.active ? 1 : 0,
        now,
      );
    }

    if (!hadBooks || !hadCosmetics) {
      const sortMap: Record<string, number> = {
        books: 1,
        shop: 2,
        cosmetics: 3,
        toys: 4,
        accessories: 5,
        subs: 6,
        games: 7,
      };
      for (const [id, order] of Object.entries(sortMap)) {
        run('UPDATE categories SET sort_order = ? WHERE id = ?', order, id);
      }

      // Align legacy default labels only if they still hold the original seeded text
      const shopRow = row<{ name_json: string }>('SELECT name_json FROM categories WHERE id = ?', 'shop');
      if (shopRow?.name_json.includes('أدوات ومستلزمات دراسية')) {
        const shopCat = DEFAULT_CATEGORIES.find((c) => c.id === 'shop')!;
        run(
          'UPDATE categories SET name_json = ?, desc_json = ?, icon = ? WHERE id = ?',
          JSON.stringify(shopCat.name),
          JSON.stringify(shopCat.desc),
          shopCat.icon,
          'shop',
        );
      }

      const gamesRow = row<{ name_json: string }>('SELECT name_json FROM categories WHERE id = ?', 'games');
      if (gamesRow?.name_json.includes('شحن الألعاب الإلكترونية')) {
        const gamesCat = DEFAULT_CATEGORIES.find((c) => c.id === 'games')!;
        run(
          'UPDATE categories SET name_json = ?, desc_json = ? WHERE id = ?',
          JSON.stringify(gamesCat.name),
          JSON.stringify(gamesCat.desc),
          'games',
        );
      }

      const subsRow = row<{ name_json: string }>('SELECT name_json FROM categories WHERE id = ?', 'subs');
      if (subsRow?.name_json.includes('اشتراكات وتوثيق التطبيقات')) {
        const subsCat = DEFAULT_CATEGORIES.find((c) => c.id === 'subs')!;
        run(
          'UPDATE categories SET name_json = ?, desc_json = ? WHERE id = ?',
          JSON.stringify(subsCat.name),
          JSON.stringify(subsCat.desc),
          'subs',
        );
      }

      // Preserve legacy 'bills' row in DB, hiding it from storefront only if no products use it
      const billsUsed = row<{ cnt: number }>('SELECT COUNT(*) as cnt FROM products WHERE cat = ?', 'bills')?.cnt || 0;
      if (billsUsed === 0) {
        run('UPDATE categories SET active = 0 WHERE id = ?', 'bills');
      }
    }
  }

  // Seed default store identity settings only (never dummy products or dummy orders)
  const defaultStore: PublicSettings = {
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
      ar: 'مرحباً بكم في مكتبة سليمي · كتب، قرطاسية، تجميل، ألعاب، إكسسوارات وخدمات رقمية',
      fr: 'Bienvenue à la Librairie Slimi · Livres, papeterie, cosmétiques, jouets, accessoires & numérique',
    },
    announcementConfig: {
      enabled: true,
      tone: 'navy',
      mode: 'ticker',
      speed: 'normal',
      dismissible: false,
      ctaLabel: { ar: 'تصفح المتجر', fr: 'Boutique' },
      ctaTarget: 'shop',
    },
    logo: '',
    facade: '',
    facade2: '',
    in1: '',
    svc_subs: '',
    svc_games: '',
    svc_bills: '',
    svc_shop: '',
    vid: '/assets/aistudio/gemini_generated_video_61b9d52e_5290a439.mp4',
    gallery: [],
    chargilyEnabled: false,
    chargilyMode: (process.env.CHARGILY_MODE === 'live' ? 'live' : 'test'),
    deliveryProvider: 'none',
    deliveryEnabled: false,
    deliveryApiId: '',
    facebook: 'https://www.facebook.com/slimi.bookstore',
  };

  const existing = row('SELECT key FROM settings WHERE key = ?', 'store_config');
  if (!existing) {
    setSetting('store_config', defaultStore);
  } else {
    const cur = getSetting<PublicSettings>('store_config', defaultStore);
    cur.address = defaultStore.address;
    if (!cur.facebook) {
      cur.facebook = defaultStore.facebook;
    }
    if (!cur.vid) {
      cur.vid = defaultStore.vid;
    }
    setSetting('store_config', cur);
  }
}

export function getProductReviews(productId: string) {
  const list = rows<{
    id: string;
    product_id: string;
    author_name: string;
    rating: number;
    comment: string;
    approved: number | null;
    admin_reply: string | null;
    is_verified_purchase: number | null;
    created_at: string;
  }>(
    'SELECT * FROM reviews WHERE product_id = ? AND (approved IS NULL OR approved = 1) ORDER BY created_at DESC',
    productId,
  );

  const reviews = list.map((r) => ({
    id: r.id,
    productId: r.product_id,
    authorName: r.author_name,
    rating: Number(r.rating),
    comment: r.comment || '',
    approved: r.approved !== 0,
    adminReply: r.admin_reply || '',
    isVerifiedPurchase: Boolean(r.is_verified_purchase),
    createdAt: r.created_at,
  }));

  const stats = computeReviewStats(reviews);
  return { reviews, ...stats };
}

export function addProductReview(productId: string, authorName: string, rating: number, comment = '') {
  const id = 'rev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();
  const clampedRating = Math.max(1, Math.min(5, Math.floor(rating)));
  run(
    'INSERT INTO reviews (id, product_id, author_name, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    productId,
    authorName.trim().slice(0, 80),
    clampedRating,
    comment.trim().slice(0, 600),
    now,
  );
  return { id, productId, authorName: authorName.trim(), rating: clampedRating, comment: comment.trim(), createdAt: now };
}

initSchema();

let dbClosed = false;

export function closeDb(): void {
  if (dbClosed) return;
  dbClosed = true;
  try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    // ignore checkpoint errors during shutdown
  }
  try {
    db.close();
  } catch {
    // ignore close errors
  }
}
