export const PG_SCHEMA_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'staff',
    password_hash TEXT NOT NULL,
    permissions_json TEXT NOT NULL DEFAULT '[]',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    username TEXT NOT NULL,
    role TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_kind_created ON sessions(kind, created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`,
  `CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    cat TEXT NOT NULL,
    type TEXT NOT NULL,
    name_json TEXT NOT NULL,
    desc_json TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL,
    old_price DOUBLE PRECISION,
    avail INTEGER NOT NULL DEFAULT 1,
    img TEXT NOT NULL DEFAULT '',
    needs_ref INTEGER NOT NULL DEFAULT 0,
    pays_json TEXT NOT NULL DEFAULT '["cod","ccp","chargily"]',
    plans_json TEXT NOT NULL DEFAULT '[]',
    featured INTEGER NOT NULL DEFAULT 0,
    sales_count INTEGER NOT NULL DEFAULT 0,
    sku TEXT NOT NULL DEFAULT '',
    cost_price DOUBLE PRECISION DEFAULT NULL,
    stock INTEGER NOT NULL DEFAULT 50,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    gallery_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS plans_json TEXT NOT NULL DEFAULT '[]'`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS featured INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS sales_count INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS sku TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price DOUBLE PRECISION DEFAULT NULL`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER NOT NULL DEFAULT 50`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5`,
  `ALTER TABLE products ADD COLUMN IF NOT EXISTS gallery_json TEXT NOT NULL DEFAULT '[]'`,
  `CREATE INDEX IF NOT EXISTS idx_products_cat ON products(cat)`,
  `CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    wilaya TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    items_json TEXT NOT NULL,
    subtotal DOUBLE PRECISION NOT NULL,
    payment_method TEXT NOT NULL,
    payment_status TEXT NOT NULL DEFAULT 'unpaid',
    status TEXT NOT NULL DEFAULT 'pending',
    bill_ref TEXT NOT NULL DEFAULT '',
    proof_media_id TEXT NOT NULL DEFAULT '',
    delivery_data TEXT NOT NULL DEFAULT '',
    chargily_checkout_id TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    lang TEXT NOT NULL DEFAULT 'ar',
    delivery_fee DOUBLE PRECISION NOT NULL DEFAULT 0,
    status_history_json TEXT NOT NULL DEFAULT '[]',
    internal_notes TEXT NOT NULL DEFAULT '',
    tracking_number TEXT NOT NULL DEFAULT '',
    delivery_provider TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS chargily_checkout_id TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS lang TEXT NOT NULL DEFAULT 'ar'`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee DOUBLE PRECISION NOT NULL DEFAULT 0`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS status_history_json TEXT NOT NULL DEFAULT '[]'`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS internal_notes TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS tracking_number TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_provider TEXT NOT NULL DEFAULT ''`,
  `CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id)`,
  `CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone)`,
  `CREATE TABLE IF NOT EXISTS subscriptions (
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
  )`,
  `CREATE TABLE IF NOT EXISTS media (
    id TEXT PRIMARY KEY,
    mime TEXT NOT NULL,
    size INTEGER NOT NULL,
    data BYTEA NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value_json TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY,
    name_json TEXT NOT NULL,
    desc_json TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'package',
    img TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    actor_username TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    details_json TEXT NOT NULL DEFAULT '{}',
    ip TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS admin_ai_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    actions_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_admin_ai_messages_user_created ON admin_ai_messages(user_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    author_name TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    approved INTEGER NOT NULL DEFAULT 1,
    admin_reply TEXT NOT NULL DEFAULT '',
    is_verified_purchase INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS approved INTEGER NOT NULL DEFAULT 1`,
  `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS admin_reply TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_verified_purchase INTEGER NOT NULL DEFAULT 0`,
  `CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id)`,
  `CREATE TABLE IF NOT EXISTS inventory_logs (
    id SERIAL PRIMARY KEY,
    product_id TEXT NOT NULL,
    change_amount INTEGER NOT NULL,
    previous_stock INTEGER NOT NULL,
    new_stock INTEGER NOT NULL,
    reason TEXT NOT NULL,
    actor_username TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory_logs(product_id)`,
];

/**
 * Converts SQLite-style `?` parameter placeholders to PostgreSQL `$1, $2, ...`
 * while preserving `?` characters inside string literals, double-quoted identifiers,
 * and SQL comments.
 */
export function translatePlaceholdersToPg(sql: string): string {
  let out = '';
  let paramIndex = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      out += ch;
      if (ch === '\n') inLineComment = false;
      continue;
    }

    if (inBlockComment) {
      out += ch;
      if (ch === '*' && next === '/') {
        out += '/';
        i++;
        inBlockComment = false;
      }
      continue;
    }

    if (inSingleQuote) {
      out += ch;
      if (ch === "'") {
        if (next === "'") {
          out += "'";
          i++;
        } else {
          inSingleQuote = false;
        }
      }
      continue;
    }

    if (inDoubleQuote) {
      out += ch;
      if (ch === '"') {
        if (next === '"') {
          out += '"';
          i++;
        } else {
          inDoubleQuote = false;
        }
      }
      continue;
    }

    if (ch === '-' && next === '-') {
      inLineComment = true;
      out += '--';
      i++;
      continue;
    }

    if (ch === '/' && next === '*') {
      inBlockComment = true;
      out += '/*';
      i++;
      continue;
    }

    if (ch === "'") {
      inSingleQuote = true;
      out += ch;
      continue;
    }

    if (ch === '"') {
      inDoubleQuote = true;
      out += ch;
      continue;
    }

    if (ch === '?') {
      paramIndex++;
      out += `$${paramIndex}`;
      continue;
    }

    out += ch;
  }

  return out;
}

/**
 * Determines the `ssl` option for node-postgres (`pg`) targeting Supabase / remote PostgreSQL
 * while still allowing local non-TLS Postgres when hostname is localhost/127.0.0.1 or PGSSLMODE=disable.
 */
export function resolvePgSslConfig(
  databaseUrl: string,
  env: Record<string, string | undefined> = process.env,
): false | { rejectUnauthorized: boolean } {
  const sslModeEnv = (env.PGSSLMODE || '').trim().toLowerCase();
  if (sslModeEnv === 'disable') {
    return false;
  }

  try {
    const parsed = new URL(databaseUrl);
    const sslModeParam = (parsed.searchParams.get('sslmode') || '').trim().toLowerCase();
    if (sslModeParam === 'disable') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if ((host === 'localhost' || host === '127.0.0.1' || host === '::1') && !sslModeParam) {
      return false;
    }
  } catch {
    // Fall back to SSL enabled for remote cloud Postgres (e.g. Supabase)
  }

  return { rejectUnauthorized: false };
}

/**
 * Redacts PostgreSQL connection URLs and credentials before logging or returning errors.
 */
export function redactDatabaseUrl(input: string): string {
  return String(input || '').replace(
    /\b(postgres(?:ql)?):\/\/([^:\s/@]+)(?::([^@\s/]*))?@([^\s/]+)/gi,
    '$1://$2:***@***',
  );
}

export interface TableMigrationSpec {
  table: string;
  conflictColumns: string[];
  columns: string[];
  serialColumn?: string;
}

export const SQLITE_TO_PG_TABLES: TableMigrationSpec[] = [
  {
    table: 'users',
    conflictColumns: ['id'],
    columns: ['id', 'username', 'display_name', 'role', 'password_hash', 'permissions_json', 'active', 'created_at'],
  },
  {
    table: 'sessions',
    conflictColumns: ['token'],
    columns: ['token', 'kind', 'subject_id', 'username', 'role', 'expires_at', 'created_at'],
  },
  {
    table: 'customers',
    conflictColumns: ['id'],
    columns: ['id', 'name', 'phone', 'email', 'password_hash', 'created_at'],
  },
  {
    table: 'categories',
    conflictColumns: ['id'],
    columns: ['id', 'name_json', 'desc_json', 'icon', 'img', 'sort_order', 'active', 'created_at'],
  },
  {
    table: 'products',
    conflictColumns: ['id'],
    columns: [
      'id',
      'cat',
      'type',
      'name_json',
      'desc_json',
      'price',
      'old_price',
      'avail',
      'img',
      'needs_ref',
      'pays_json',
      'plans_json',
      'featured',
      'sales_count',
      'sku',
      'cost_price',
      'stock',
      'low_stock_threshold',
      'gallery_json',
      'created_at',
      'updated_at',
    ],
  },
  {
    table: 'orders',
    conflictColumns: ['id'],
    columns: [
      'id',
      'code',
      'customer_id',
      'customer_name',
      'customer_phone',
      'wilaya',
      'address',
      'items_json',
      'subtotal',
      'payment_method',
      'payment_status',
      'status',
      'bill_ref',
      'proof_media_id',
      'delivery_data',
      'chargily_checkout_id',
      'notes',
      'lang',
      'delivery_fee',
      'status_history_json',
      'internal_notes',
      'tracking_number',
      'delivery_provider',
      'created_at',
      'updated_at',
    ],
  },
  {
    table: 'subscriptions',
    conflictColumns: ['id'],
    columns: [
      'id',
      'order_id',
      'order_code',
      'customer_name',
      'customer_phone',
      'service_name',
      'plan_label',
      'account_info',
      'start_date',
      'end_date',
      'status',
      'notes',
      'created_at',
    ],
  },
  {
    table: 'media',
    conflictColumns: ['id'],
    columns: ['id', 'mime', 'size', 'data', 'created_at'],
  },
  {
    table: 'settings',
    conflictColumns: ['key'],
    columns: ['key', 'value_json'],
  },
  {
    table: 'audit_logs',
    conflictColumns: ['id'],
    columns: ['id', 'actor_username', 'actor_role', 'action', 'target_type', 'target_id', 'details_json', 'ip', 'created_at'],
    serialColumn: 'id',
  },
  {
    table: 'admin_ai_messages',
    conflictColumns: ['id'],
    columns: ['id', 'user_id', 'role', 'content', 'actions_json', 'created_at'],
  },
  {
    table: 'reviews',
    conflictColumns: ['id'],
    columns: ['id', 'product_id', 'author_name', 'rating', 'comment', 'approved', 'admin_reply', 'is_verified_purchase', 'created_at'],
  },
  {
    table: 'inventory_logs',
    conflictColumns: ['id'],
    columns: ['id', 'product_id', 'change_amount', 'previous_stock', 'new_stock', 'reason', 'actor_username', 'created_at'],
    serialColumn: 'id',
  },
];

export function buildPgUpsertSql(spec: TableMigrationSpec): string {
  const cols = spec.columns.join(', ');
  const placeholders = spec.columns.map((_, idx) => `$${idx + 1}`).join(', ');
  const conflictTarget = spec.conflictColumns.join(', ');
  const updateCols = spec.columns
    .filter((c) => !spec.conflictColumns.includes(c))
    .map((c) => `${c} = excluded.${c}`);

  if (updateCols.length === 0) {
    return `INSERT INTO ${spec.table} (${cols}) VALUES (${placeholders}) ON CONFLICT (${conflictTarget}) DO NOTHING`;
  }
  return `INSERT INTO ${spec.table} (${cols}) VALUES (${placeholders}) ON CONFLICT (${conflictTarget}) DO UPDATE SET ${updateCols.join(', ')}`;
}

export function parseSafeDatabaseTarget(connectionString: string): {
  host: string;
  port: number;
  database: string;
  ssl: boolean;
} | null {
  const trimmed = connectionString.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname) return null;
    const port = parsed.port ? Number(parsed.port) : 5432;
    const database = parsed.pathname.replace(/^\/+/, '') || 'postgres';
    return {
      host: parsed.hostname,
      port: Number.isFinite(port) && port > 0 ? port : 5432,
      database,
      ssl: Boolean(resolvePgSslConfig(trimmed)),
    };
  } catch {
    return null;
  }
}

