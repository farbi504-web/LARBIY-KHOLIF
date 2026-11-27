import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Pool } from 'pg';
import {
  PG_SCHEMA_STATEMENTS,
  SQLITE_TO_PG_TABLES,
  buildPgUpsertSql,
  redactDatabaseUrl,
  resolvePgSslConfig,
} from './pgHelpers.ts';

interface MigrationReportRow {
  table: string;
  sqliteRows: number;
  pgRowsBefore: number;
  pgRowsAfter: number;
  verified: boolean;
}

function resolveDefaultColumnValue(table: string, col: string): unknown {
  if (table === 'products') {
    if (col === 'plans_json' || col === 'gallery_json') return '[]';
    if (col === 'pays_json') return '["cod","ccp","chargily"]';
    if (col === 'stock') return 50;
    if (col === 'low_stock_threshold') return 5;
    if (col === 'featured' || col === 'sales_count' || col === 'needs_ref') return 0;
    if (col === 'avail') return 1;
    if (col === 'cost_price' || col === 'old_price') return null;
    return '';
  }
  if (table === 'orders') {
    if (col === 'delivery_fee') return 0;
    if (col === 'status_history_json') return '[]';
    if (col === 'lang') return 'ar';
    if (col === 'customer_id') return null;
    return '';
  }
  if (table === 'reviews') {
    if (col === 'approved') return 1;
    if (col === 'is_verified_purchase') return 0;
    return '';
  }
  return null;
}

async function migrateSqliteToPostgres(): Promise<void> {
  const databaseUrl = (process.env.DATABASE_URL || '').trim();
  if (!databaseUrl) {
    console.error('[migrate] Error: DATABASE_URL environment variable is not set.');
    console.error('[migrate] Set DATABASE_URL to your Supabase PostgreSQL connection string and re-run.');
    process.exit(1);
  }

  const sqlitePath = path.resolve(
    process.env.SQLITE_PATH || path.join(path.resolve(process.env.DATA_DIR || './data'), 'slimi.sqlite'),
  );

  if (!fs.existsSync(sqlitePath)) {
    console.error(`[migrate] Error: SQLite database file not found at ${sqlitePath}`);
    process.exit(1);
  }

  console.log(`[migrate] Opening SQLite source (read-only): ${sqlitePath}`);
  const sqlite = new DatabaseSync(sqlitePath, { readOnly: true });

  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: resolvePgSslConfig(databaseUrl),
    max: 4,
    connectionTimeoutMillis: 15_000,
  });

  try {
    await pool.query('SELECT 1');
    console.log('[migrate] Connected to PostgreSQL target.');

    for (const stmt of PG_SCHEMA_STATEMENTS) {
      await pool.query(stmt);
    }
    console.log('[migrate] Verified PostgreSQL schema & indexes.');

    const report: MigrationReportRow[] = [];
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const spec of SQLITE_TO_PG_TABLES) {
        const tableExistsRow = sqlite
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
          .get(spec.table) as { name?: string } | undefined;

        const beforeCountRes = await client.query<{ cnt: string }>(
          `SELECT COUNT(*)::text as cnt FROM ${spec.table}`,
        );
        const pgRowsBefore = Number(beforeCountRes.rows[0]?.cnt || 0);

        if (!tableExistsRow?.name) {
          report.push({
            table: spec.table,
            sqliteRows: 0,
            pgRowsBefore,
            pgRowsAfter: pgRowsBefore,
            verified: true,
          });
          continue;
        }

        const sqliteCols = (
          sqlite.prepare(`PRAGMA table_info(${spec.table})`).all() as Array<{ name: string }>
        ).map((c) => c.name);
        const sqliteColSet = new Set(sqliteCols);

        const sqliteRows = sqlite.prepare(`SELECT * FROM ${spec.table}`).all() as Array<
          Record<string, unknown>
        >;
        const upsertSql = buildPgUpsertSql(spec);

        for (const r of sqliteRows) {
          const values = spec.columns.map((col: string) => {
            if (!sqliteColSet.has(col)) {
              return resolveDefaultColumnValue(spec.table, col);
            }
            const val = r[col];
            if (val === undefined) {
              return resolveDefaultColumnValue(spec.table, col);
            }
            if (spec.table === 'media' && col === 'data' && val instanceof Uint8Array && !Buffer.isBuffer(val)) {
              return Buffer.from(val);
            }
            return val;
          });

          await client.query(upsertSql, values);
        }

        if (spec.serialColumn) {
          const maxIdRes = await client.query<{ max_id: string | null }>(
            `SELECT MAX(${spec.serialColumn})::text as max_id FROM ${spec.table}`,
          );
          const maxId = maxIdRes.rows[0]?.max_id ? Number(maxIdRes.rows[0].max_id) : 0;
          if (maxId > 0) {
            await client.query(
              `SELECT setval(pg_get_serial_sequence($1, $2), $3, true)`,
              [spec.table, spec.serialColumn, maxId],
            );
          } else {
            await client.query(
              `SELECT setval(pg_get_serial_sequence($1, $2), 1, false)`,
              [spec.table, spec.serialColumn],
            );
          }
        }

        const afterCountRes = await client.query<{ cnt: string }>(
          `SELECT COUNT(*)::text as cnt FROM ${spec.table}`,
        );
        const pgRowsAfter = Number(afterCountRes.rows[0]?.cnt || 0);

        report.push({
          table: spec.table,
          sqliteRows: sqliteRows.length,
          pgRowsBefore,
          pgRowsAfter,
          verified: pgRowsAfter >= sqliteRows.length,
        });
      }

      await client.query('COMMIT');
    } catch (txErr) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw txErr;
    } finally {
      client.release();
    }

    // Integrity spot check on media byte lengths
    const sqliteMediaBytes = sqlite
      .prepare('SELECT COALESCE(SUM(size), 0) as total_bytes FROM media')
      .get() as { total_bytes?: number } | undefined;
    const pgMediaBytes = await pool.query<{ total_bytes: string }>(
      'SELECT COALESCE(SUM(octet_length(data)), 0)::text as total_bytes FROM media',
    );

    console.log('\n[migrate] Migration Summary:');
    console.table(report);
    console.log(
      `[migrate] Media byte integrity: SQLite=${Number(sqliteMediaBytes?.total_bytes || 0)} bytes, PostgreSQL=${Number(pgMediaBytes.rows[0]?.total_bytes || 0)} bytes`,
    );

    const anyFailed = report.some((r) => !r.verified);
    if (anyFailed) {
      throw new Error('Row count verification failed for one or more tables.');
    }

    console.log('[migrate] Migration completed & verified. Original SQLite file preserved intact.');
  } finally {
    sqlite.close();
    await pool.end().catch(() => undefined);
  }
}

migrateSqliteToPostgres().catch((err) => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[migrate] Migration failed:', redactDatabaseUrl(msg));
  process.exit(1);
});
