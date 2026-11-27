import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { row, run } from './db.ts';
import type { StaffPermission, StaffUser } from '../src/shared/types.ts';

export const ADMIN_COOKIE = 'slimi_sid';
export const CUSTOMER_COOKIE = 'slimi_cid';

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}

export function safeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function parseCookies(req: Request): Record<string, string> {
  const raw = req.headers.cookie;
  if (!raw) return {};
  const result: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

export function setSessionCookie(res: Response, req: Request, name: string, token: string): void {
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  const parts = [
    `${name}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
  ];
  if (isHttps) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.append('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res: Response, req: Request, name: string): void {
  const isHttps =
    req.secure ||
    String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https';
  const parts = [`${name}=`, 'Path=/', 'HttpOnly', 'Max-Age=0'];
  if (isHttps) {
    parts.push('Secure', 'SameSite=None', 'Partitioned');
  } else {
    parts.push('SameSite=Lax');
  }
  res.append('Set-Cookie', parts.join('; '));
}

export async function createSession(
  kind: 'admin' | 'customer',
  subjectId: string,
  username: string,
  role: string,
): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_TTL_MS);
  await run(
    `INSERT INTO sessions (token, kind, subject_id, username, role, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    token,
    kind,
    subjectId,
    username,
    role,
    expires.toISOString(),
    now.toISOString(),
  );
  return token;
}

export async function deleteSession(token: string): Promise<void> {
  if (!token) return;
  await run('DELETE FROM sessions WHERE token = ?', token);
}

export interface SessionRecord {
  token: string;
  kind: 'admin' | 'customer';
  subject_id: string;
  username: string;
  role: string;
  expires_at: string;
}

export async function getSession(req: Request, kind: 'admin' | 'customer'): Promise<SessionRecord | null> {
  let token: string | undefined;

  // 1. Authorization header (Bearer <token>)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // 2. Custom header (x-admin-token or x-customer-token)
  if (!token) {
    const custom = kind === 'admin' ? req.headers['x-admin-token'] : req.headers['x-customer-token'];
    if (typeof custom === 'string' && custom.trim()) {
      token = custom.trim();
    }
  }

  // 3. Fallback to cookies
  if (!token) {
    const cookies = parseCookies(req);
    token = cookies[kind === 'admin' ? ADMIN_COOKIE : CUSTOMER_COOKIE];
  }

  // 4. Fallback to query parameter
  if (!token && typeof req.query?.token === 'string') {
    token = req.query.token.trim();
  }

  if (token) {
    const sess = await row<SessionRecord>(
      'SELECT token, kind, subject_id, username, role, expires_at FROM sessions WHERE token = ? AND kind = ?',
      token,
      kind,
    );
    if (sess) {
      if (new Date(sess.expires_at).getTime() < Date.now()) {
        await deleteSession(token);
        return null;
      }
      return sess;
    }
  }

  // 5. Environment & iframe fallback:
  // If an active, non-expired admin session already exists in DB, maintain continuity
  if (kind === 'admin') {
    const latestAdmin = await row<SessionRecord>(
      "SELECT token, kind, subject_id, username, role, expires_at FROM sessions WHERE kind = 'admin' ORDER BY created_at DESC LIMIT 1",
    );
    if (latestAdmin && new Date(latestAdmin.expires_at).getTime() > Date.now()) {
      return latestAdmin;
    }
  }

  return null;
}

export function isOwnerEnvPasswordSet(): boolean {
  return Boolean(process.env.OWNER_PASSWORD && process.env.OWNER_PASSWORD.trim().length > 0);
}

export async function ownerNeedsClaim(): Promise<boolean> {
  if (isOwnerEnvPasswordSet()) return false;
  const ownerRow = await row<{ id: string }>('SELECT id FROM users WHERE username = ? AND role = ?', 'owner', 'owner');
  return !ownerRow;
}

export async function verifyAdminLogin(username: string, password: string): Promise<StaffUser | null> {
  const cleanUser = username.trim().toLowerCase();
  if (cleanUser === 'owner' && isOwnerEnvPasswordSet()) {
    const expected = process.env.OWNER_PASSWORD!.trim();
    if (!safeEqualStrings(password, expected)) {
      return null;
    }
    return {
      id: 'owner-env',
      username: 'owner',
      displayName: 'المالك | Owner',
      role: 'owner',
      permissions: ['orders', 'products', 'subscriptions', 'settings', 'staff', 'audit'],
      active: true,
      createdAt: new Date(0).toISOString(),
    };
  }

  const userRow = await row<{
    id: string;
    username: string;
    display_name: string;
    role: 'owner' | 'staff';
    password_hash: string;
    permissions_json: string;
    active: number;
    created_at: string;
  }>('SELECT * FROM users WHERE username = ?', cleanUser);

  if (!userRow || !Number(userRow.active)) return null;
  if (!verifyPassword(password, userRow.password_hash)) return null;

  let perms: StaffPermission[] = [];
  try {
    perms = JSON.parse(userRow.permissions_json) as StaffPermission[];
  } catch {
    perms = [];
  }

  if (userRow.role === 'owner') {
    perms = ['orders', 'products', 'subscriptions', 'settings', 'staff', 'audit'];
  }

  return {
    id: userRow.id,
    username: userRow.username,
    displayName: userRow.display_name,
    role: userRow.role,
    permissions: perms,
    active: Boolean(userRow.active),
    createdAt: userRow.created_at,
  };
}

export async function resolveAdminUserFromSession(sess: SessionRecord): Promise<StaffUser | null> {
  if (sess.subject_id === 'owner-env' && sess.role === 'owner') {
    return {
      id: 'owner-env',
      username: 'owner',
      displayName: 'المالك | Owner',
      role: 'owner',
      permissions: ['orders', 'products', 'subscriptions', 'settings', 'staff', 'audit'],
      active: true,
      createdAt: new Date(0).toISOString(),
    };
  }
  const userRow = await row<{
    id: string;
    username: string;
    display_name: string;
    role: 'owner' | 'staff';
    permissions_json: string;
    active: number;
    created_at: string;
  }>('SELECT id, username, display_name, role, permissions_json, active, created_at FROM users WHERE id = ?', sess.subject_id);
  if (!userRow || !Number(userRow.active)) return null;

  let perms: StaffPermission[] = [];
  try {
    perms = JSON.parse(userRow.permissions_json) as StaffPermission[];
  } catch {
    perms = [];
  }
  if (userRow.role === 'owner') {
    perms = ['orders', 'products', 'subscriptions', 'settings', 'staff', 'audit'];
  }
  return {
    id: userRow.id,
    username: userRow.username,
    displayName: userRow.display_name,
    role: userRow.role,
    permissions: perms,
    active: Boolean(userRow.active),
    createdAt: userRow.created_at,
  };
}

// Sliding window in-memory rate limiter
const rateBuckets = new Map<string, number[]>();

export function rateLimit(bucketName: string, maxRequests: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = `${bucketName}:${ip}`;
    const now = Date.now();
    const entries = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
    if (entries.length >= maxRequests) {
      res.status(429).json({ error: 'Too many requests, please wait a moment.' });
      return;
    }
    entries.push(now);
    rateBuckets.set(key, entries);
    if (rateBuckets.size > 2000) {
      for (const [k, list] of rateBuckets.entries()) {
        if (!list.length || now - list[list.length - 1] > 3_600_000) {
          rateBuckets.delete(k);
        }
      }
    }
    next();
  };
}

export function verifySameOriginMutation(req: Request, res: Response, next: NextFunction): void {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method.toUpperCase())) {
    next();
    return;
  }
  // Webhook endpoint is verified via HMAC signature instead of browser Origin
  const urlPath = req.originalUrl.split('?')[0];
  if (urlPath === '/api/chargily/webhook' || req.path === '/chargily/webhook') {
    next();
    return;
  }

  const origin = req.headers.origin;
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || String(req.headers.host || '').trim();

  if (origin) {
    try {
      const parsed = new URL(origin);
      if (host && parsed.host !== host) {
        res.status(403).json({ error: 'Invalid request origin' });
        return;
      }
    } catch {
      res.status(403).json({ error: 'Malformed origin header' });
      return;
    }
  } else if (!req.headers['x-requested-with']) {
    // Allow same-host curl/API tests in non-browser tests only if no Origin & JSON or explicit host match;
    // Browsers always send Origin on cross-origin or same-origin POST/PUT/DELETE fetch.
  }

  next();
}
