import { AsyncLocalStorage } from 'node:async_hooks';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { Pool, type PoolClient } from 'pg';
import type { PublicSettings } from '../src/shared/types.ts';
import { DEFAULT_CATEGORIES } from '../src/shared/categories.ts';
import { computeReviewStats } from '../src/shared/reviews.ts';
import {
  PG_SCHEMA_STATEMENTS,
  redactDatabaseUrl,
  resolvePgSslConfig,
  translatePlaceholdersToPg,
} from './pgHelpers.ts';

export type SqlParam = string | number | boolean | bigint | Uint8Array | Buffer | null | undefined;
export type DbBackend = 'postgresql' | 'sqlite';

const txStorage = new AsyncLocalStorage<PoolClient | 'sqlite-tx'>();

let pgPool: Pool | null = null;
let sqliteDb: DatabaseSync | null = null;
let activeBackend: DbBackend | null = null;
let initPromise: Promise<void> | null = null;
let dbClosed = false;

export function getDbBackend(): DbBackend {
  if (activeBackend) return activeBackend;
  return process.env.DATABASE_URL?.trim() ? 'postgresql' : 'sqlite';
}

function normalizeParams(params: SqlParam[]): unknown[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p;
  });
}

function normalizeSqliteParams(params: SqlParam[]): SQLInputValue[] {
  return params.map((p) => {
    if (p === undefined) return null;
    if (typeof p === 'boolean') return p ? 1 : 0;
    return p as SQLInputValue;
  });
}

async function ensureInitialized(): Promise<void> {
  if (activeBackend) return;
  if (!initPromise) {
    initPromise = initDb();
  }
  await initPromise;
}

export async function run(sql: string, ...params: SqlParam[]): Promise<{ changes: number }> {
  await ensureInitialized();
  if (activeBackend === 'postgresql') {
    const client = txStorage.getStore();
    const pgSql = translatePlaceholdersToPg(sql);
    const values = normalizeParams(params);
    if (client && client !== 'sqlite-tx') {
      const res = await client.query(pgSql, values);
      return { changes: res.rowCount ?? 0 };
    }
    if (!pgPool) throw new Error('PostgreSQL pool is not initialized');
    const res = await pgPool.query(pgSql, values);
    return { changes: res.rowCount ?? 0 };
  }

  if (!sqliteDb) throw new Error('SQLite database is not initialized');
  const info = sqliteDb.prepare(sql).run(...normalizeSqliteParams(params));
  return { changes: Number(info.changes ?? 0) };
}

export async function row<T = Record<string, unknown>>(
  sql: string,
  ...params: SqlParam[]
): Promise<T | undefined> {
  await ensureInitialized();
  if (activeBackend === 'postgresql') {
    const client = txStorage.getStore();
    const pgSql = translatePlaceholdersToPg(sql);
    const values = normalizeParams(params);
    if (client && client !== 'sqlite-tx') {
      const res = await client.query(pgSql, values);
      return res.rows[0] as T | undefined;
    }
    if (!pgPool) throw new Error('PostgreSQL pool is not initialized');
    const res = await pgPool.query(pgSql, values);
    return res.rows[0] as T | undefined;
  }

  if (!sqliteDb) throw new Error('SQLite database is not initialized');
  return sqliteDb.prepare(sql).get(...normalizeSqliteParams(params)) as T | undefined;
}

export async function rows<T = Record<string, unknown>>(
  sql: string,
  ...params: SqlParam[]
): Promise<T[]> {
  await ensureInitialized();
  if (activeBackend === 'postgresql') {
    const client = txStorage.getStore();
    const pgSql = translatePlaceholdersToPg(sql);
    const values = normalizeParams(params);
    if (client && client !== 'sqlite-tx') {
      const res = await client.query(pgSql, values);
      return res.rows as T[];
    }
    if (!pgPool) throw new Error('PostgreSQL pool is not initialized');
    const res = await pgPool.query(pgSql, values);
    return res.rows as T[];
  }

  if (!sqliteDb) throw new Error('SQLite database is not initialized');
  return sqliteDb.prepare(sql).all(...normalizeSqliteParams(params)) as T[];
}

export async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  await ensureInitialized();
  if (activeBackend === 'postgresql') {
    const existingClient = txStorage.getStore();
    if (existingClient && existingClient !== 'sqlite-tx') {
      return fn();
    }
    if (!pgPool) throw new Error('PostgreSQL pool is not initialized');
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      const result = await txStorage.run(client, fn);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        // ignore rollback failure
      }
      throw err;
    } finally {
      client.release();
    }
  }

  if (!sqliteDb) throw new Error('SQLite database is not initialized');
  if (txStorage.getStore() === 'sqlite-tx') {
    return fn();
  }
  sqliteDb.exec('BEGIN IMMEDIATE');
  try {
    const result = await txStorage.run('sqlite-tx', fn);
    sqliteDb.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      sqliteDb.exec('ROLLBACK');
    } catch {
      // ignore rollback failure
    }
    throw err;
  }
}

export async function getSetting<T = unknown>(key: string, fallback: T): Promise<T> {
  const rec = await row<{ value_json: string }>('SELECT value_json FROM settings WHERE key = ?', key);
  if (!rec) return fallback;
  try {
    return JSON.parse(rec.value_json) as T;
  } catch {
    return fallback;
  }
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  const json = JSON.stringify(value);
  await run(
    `INSERT INTO settings (key, value_json) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json`,
    key,
    json,
  );
}

export async function audit(
  actorUsername: string,
  actorRole: string,
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {},
  ip = '',
): Promise<void> {
  await run(
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

function addSqliteCol(db: DatabaseSync, table: string, col: string, def: string): void {
  if (!/^[a-z_][a-z0-9_]*$/i.test(table) || !/^[a-z_][a-z0-9_]*$/i.test(col)) {
    throw new Error('Invalid identifier in addSqliteCol');
  }
  const existing = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!existing.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`);
  }
}

function initSqliteSchema(db: DatabaseSync): void {
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

  addSqliteCol(db, 'products', 'plans_json', "TEXT NOT NULL DEFAULT '[]'");
  addSqliteCol(db, 'products', 'featured', 'INTEGER NOT NULL DEFAULT 0');
  addSqliteCol(db, 'products', 'sales_count', 'INTEGER NOT NULL DEFAULT 0');
  addSqliteCol(db, 'products', 'sku', "TEXT NOT NULL DEFAULT ''");
  addSqliteCol(db, 'products', 'cost_price', 'REAL DEFAULT NULL');
  addSqliteCol(db, 'products', 'stock', 'INTEGER NOT NULL DEFAULT 50');
  addSqliteCol(db, 'products', 'low_stock_threshold', 'INTEGER NOT NULL DEFAULT 5');
  addSqliteCol(db, 'products', 'gallery_json', "TEXT NOT NULL DEFAULT '[]'");

  addSqliteCol(db, 'orders', 'chargily_checkout_id', "TEXT NOT NULL DEFAULT ''");
  addSqliteCol(db, 'orders', 'lang', "TEXT NOT NULL DEFAULT 'ar'");
  addSqliteCol(db, 'orders', 'delivery_fee', 'REAL NOT NULL DEFAULT 0');
  addSqliteCol(db, 'orders', 'status_history_json', "TEXT NOT NULL DEFAULT '[]'");
  addSqliteCol(db, 'orders', 'internal_notes', "TEXT NOT NULL DEFAULT ''");
  addSqliteCol(db, 'orders', 'tracking_number', "TEXT NOT NULL DEFAULT ''");
  addSqliteCol(db, 'orders', 'delivery_provider', "TEXT NOT NULL DEFAULT ''");

  addSqliteCol(db, 'reviews', 'approved', 'INTEGER NOT NULL DEFAULT 1');
  addSqliteCol(db, 'reviews', 'admin_reply', "TEXT NOT NULL DEFAULT ''");
  addSqliteCol(db, 'reviews', 'is_verified_purchase', 'INTEGER NOT NULL DEFAULT 0');
}

async function seedDefaultData(): Promise<void> {
  const catCountRow = await row<{ cnt: number | string }>('SELECT COUNT(*) as cnt FROM categories');
  const catCount = Number(catCountRow?.cnt || 0);
  const now = new Date().toISOString();

  if (catCount === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      await run(
        `INSERT INTO categories (id, name_json, desc_json, icon, img, sort_order, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
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
    const hadBooks = Boolean(await row('SELECT id FROM categories WHERE id = ?', 'books'));
    const hadCosmetics = Boolean(await row('SELECT id FROM categories WHERE id = ?', 'cosmetics'));

    for (const cat of DEFAULT_CATEGORIES) {
      await run(
        `INSERT INTO categories (id, name_json, desc_json, icon, img, sort_order, active, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (id) DO NOTHING`,
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
        await run('UPDATE categories SET sort_order = ? WHERE id = ?', order, id);
      }

      const shopRow = await row<{ name_json: string }>('SELECT name_json FROM categories WHERE id = ?', 'shop');
      if (shopRow?.name_json.includes('أدوات ومستلزمات دراسية')) {
        const shopCat = DEFAULT_CATEGORIES.find((c) => c.id === 'shop')!;
        await run(
          'UPDATE categories SET name_json = ?, desc_json = ?, icon = ? WHERE id = ?',
          JSON.stringify(shopCat.name),
          JSON.stringify(shopCat.desc),
          shopCat.icon,
          'shop',
        );
      }

      const gamesRow = await row<{ name_json: string }>('SELECT name_json FROM categories WHERE id = ?', 'games');
      if (gamesRow?.name_json.includes('شحن الألعاب الإلكترونية')) {
        const gamesCat = DEFAULT_CATEGORIES.find((c) => c.id === 'games')!;
        await run(
          'UPDATE categories SET name_json = ?, desc_json = ? WHERE id = ?',
          JSON.stringify(gamesCat.name),
          JSON.stringify(gamesCat.desc),
          'games',
        );
      }

      const subsRow = await row<{ name_json: string }>('SELECT name_json FROM categories WHERE id = ?', 'subs');
      if (subsRow?.name_json.includes('اشتراكات وتوثيق التطبيقات')) {
        const subsCat = DEFAULT_CATEGORIES.find((c) => c.id === 'subs')!;
        await run(
          'UPDATE categories SET name_json = ?, desc_json = ? WHERE id = ?',
          JSON.stringify(subsCat.name),
          JSON.stringify(subsCat.desc),
          'subs',
        );
      }

      const billsUsedRow = await row<{ cnt: number | string }>(
        'SELECT COUNT(*) as cnt FROM products WHERE cat = ?',
        'bills',
      );
      if (Number(billsUsedRow?.cnt || 0) === 0) {
        await run('UPDATE categories SET active = 0 WHERE id = ?', 'bills');
      }
    }
  }

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
    chargilyMode: process.env.CHARGILY_MODE === 'live' ? 'live' : 'test',
    deliveryProvider: 'none',
    deliveryEnabled: false,
    deliveryApiId: '',
    facebook: 'https://www.facebook.com/slimi.bookstore',
  };

  const existing = await row('SELECT key FROM settings WHERE key = ?', 'store_config');
  if (!existing) {
    await setSetting('store_config', defaultStore);
  } else {
    const cur = await getSetting<PublicSettings>('store_config', defaultStore);
    cur.address = defaultStore.address;
    if (!cur.facebook) {
      cur.facebook = defaultStore.facebook;
    }
    if (!cur.vid) {
      cur.vid = defaultStore.vid;
    }
    await setSetting('store_config', cur);
  }
}

export async function initDb(): Promise<void> {
  if (activeBackend) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const databaseUrl = (process.env.DATABASE_URL || '').trim();

    if (databaseUrl) {
      const pool = new Pool({
        connectionString: databaseUrl,
        ssl: resolvePgSslConfig(databaseUrl),
        max: Math.max(2, Math.min(30, Number(process.env.PG_POOL_MAX || 10))),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 10_000,
      });

      pool.on('error', (err) => {
        console.error('[db:pg] unexpected pool error:', redactDatabaseUrl(err.message));
      });

      try {
        await pool.query('SELECT 1');
        for (const stmt of PG_SCHEMA_STATEMENTS) {
          await pool.query(stmt);
        }
        pgPool = pool;
        activeBackend = 'postgresql';
        await seedDefaultData();
        console.log('[db] Connected to PostgreSQL (Supabase ready)');
      } catch (err) {
        await pool.end().catch(() => undefined);
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to connect/initialize PostgreSQL: ${redactDatabaseUrl(msg)}`);
      }
      return;
    }

    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'DATABASE_URL environment variable is required in production to connect to Supabase PostgreSQL.',
      );
    }

    const { DatabaseSync: SqliteDatabaseSync } = await import('node:sqlite');
    const dataDir = path.resolve(process.env.DATA_DIR || './data');
    fs.mkdirSync(dataDir, { recursive: true });
    const sqlitePath = path.join(dataDir, 'slimi.sqlite');
    const db = new SqliteDatabaseSync(sqlitePath);
    db.exec('PRAGMA journal_mode = WAL;');
    db.exec('PRAGMA busy_timeout = 5000;');
    db.exec('PRAGMA foreign_keys = ON;');
    initSqliteSchema(db);
    sqliteDb = db;
    activeBackend = 'sqlite';
    await seedDefaultData();
    console.warn('[db] DATABASE_URL not set; using local SQLite development fallback');
  })();

  try {
    await initPromise;
  } catch (err) {
    activeBackend = null;
    initPromise = null;
    throw err;
  }
}

export async function getProductReviews(productId: string) {
  const list = await rows<{
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

export async function addProductReview(productId: string, authorName: string, rating: number, comment = '') {
  const id = 'rev_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const now = new Date().toISOString();
  const clampedRating = Math.max(1, Math.min(5, Math.floor(rating)));
  await run(
    'INSERT INTO reviews (id, product_id, author_name, rating, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    id,
    productId,
    authorName.trim().slice(0, 80),
    clampedRating,
    comment.trim().slice(0, 600),
    now,
  );
  return {
    id,
    productId,
    authorName: authorName.trim(),
    rating: clampedRating,
    comment: comment.trim(),
    createdAt: now,
  };
}

export async function closeDb(): Promise<void> {
  if (dbClosed) return;
  dbClosed = true;

  if (pgPool) {
    try {
      await pgPool.end();
    } catch {
      // ignore close errors
    }
    pgPool = null;
  }

  if (sqliteDb) {
    try {
      sqliteDb.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {
      // ignore checkpoint errors during shutdown
    }
    try {
      sqliteDb.close();
    } catch {
      // ignore close errors
    }
    sqliteDb = null;
  }

  activeBackend = null;
  initPromise = null;
}
