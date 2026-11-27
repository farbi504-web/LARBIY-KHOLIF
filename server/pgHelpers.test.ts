import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PG_SCHEMA_STATEMENTS,
  SQLITE_TO_PG_TABLES,
  buildPgUpsertSql,
  parseSafeDatabaseTarget,
  redactDatabaseUrl,
  resolvePgSslConfig,
  translatePlaceholdersToPg,
} from './pgHelpers.ts';

test('translatePlaceholdersToPg converts SQLite ? placeholders to $1..$n safely', () => {
  const sql = 'SELECT * FROM orders WHERE id = ? OR UPPER(code) = UPPER(?)';
  assert.equal(
    translatePlaceholdersToPg(sql),
    'SELECT * FROM orders WHERE id = $1 OR UPPER(code) = UPPER($2)',
  );
});

test('translatePlaceholdersToPg ignores ? inside string literals and comments', () => {
  const sql = `
    SELECT id, '?' AS q, 'it''s ?' AS escaped
    FROM products -- why?
    WHERE cat = ? /* test ? */ AND price > ?
  `;
  const translated = translatePlaceholdersToPg(sql);
  assert.match(translated, /'\?' AS q/);
  assert.match(translated, /'it''s \?' AS escaped/);
  assert.match(translated, /WHERE cat = \$1 \/\* test \? \*\/ AND price > \$2/);
});

test('resolvePgSslConfig enables non-strict TLS for Supabase and disables for localhost', () => {
  assert.deepEqual(
    resolvePgSslConfig('postgresql://postgres:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres', {}),
    { rejectUnauthorized: false },
  );
  assert.equal(resolvePgSslConfig('postgresql://postgres:secret@localhost:5432/slimi', {}), false);
  assert.equal(
    resolvePgSslConfig('postgresql://postgres:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres', {
      PGSSLMODE: 'disable',
    }),
    false,
  );
});

test('redactDatabaseUrl strips credentials from error messages', () => {
  const raw = 'Error connecting to postgresql://postgres.abc:SuperSecretPass123!@aws-0-eu-west-1.pooler.supabase.com:6543/postgres';
  const safe = redactDatabaseUrl(raw);
  assert.equal(safe.includes('SuperSecretPass123!'), false);
  assert.equal(safe.includes('aws-0-eu-west-1.pooler.supabase.com'), false);
  assert.match(safe, /postgresql:\/\/postgres\.abc:\*\*\*@\*\*\*/);
});

test('SQLITE_TO_PG_TABLES covers all 13 tables and generates valid upserts', () => {
  assert.equal(SQLITE_TO_PG_TABLES.length, 13);
  const tableNames = SQLITE_TO_PG_TABLES.map((t) => t.table);
  assert.deepEqual(tableNames, [
    'users',
    'sessions',
    'customers',
    'categories',
    'products',
    'orders',
    'subscriptions',
    'media',
    'settings',
    'audit_logs',
    'admin_ai_messages',
    'reviews',
    'inventory_logs',
  ]);

  const settingsSql = buildPgUpsertSql(SQLITE_TO_PG_TABLES.find((t) => t.table === 'settings')!);
  assert.equal(
    settingsSql,
    'INSERT INTO settings (key, value_json) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value_json = excluded.value_json',
  );

  const schemaText = PG_SCHEMA_STATEMENTS.join('\n');
  for (const name of tableNames) {
    assert.equal(schemaText.includes(`CREATE TABLE IF NOT EXISTS ${name}`), true, `Missing DDL for ${name}`);
  }
});

test('parseSafeDatabaseTarget extracts host, port, database, ssl without exposing credentials', () => {
  const parsed = parseSafeDatabaseTarget(
    'postgresql://postgres.proj123:MySecretPass!@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  );
  assert.deepEqual(parsed, {
    host: 'aws-0-eu-west-1.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    ssl: true,
  });
  assert.equal(JSON.stringify(parsed).includes('MySecretPass'), false);
  assert.equal(parseSafeDatabaseTarget(''), null);
  assert.equal(parseSafeDatabaseTarget('not-a-valid-url'), null);
});
