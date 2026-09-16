import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';

const tokenLifetimeSeconds = 4 * 60 * 60;

function encode(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function sign(value: string) {
  return createHmac('sha256', env.ADMIN_SESSION_SECRET).update(value).digest('base64url');
}

export function createAdminToken() {
  const payload = encode(JSON.stringify({ role: env.ADMIN_ROLE, exp: Math.floor(Date.now() / 1000) + tokenLifetimeSeconds }));
  return `${payload}.${sign(payload)}`;
}

export type AdminRole = 'super_admin' | 'operator' | 'viewer';
export type AdminToken = { role: AdminRole; exp: number };

export function readAdminToken(token: string | undefined): AdminToken | null {
  if (!token) return null;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const expectedSignature = sign(payload);
  if (signature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { role?: unknown; exp?: unknown };
    if ((data.role === 'super_admin' || data.role === 'operator' || data.role === 'viewer') && typeof data.exp === 'number' && data.exp > Math.floor(Date.now() / 1000)) return data as AdminToken;
    return null;
  } catch {
    return null;
  }
}

export function isValidAdminToken(token: string | undefined) { return readAdminToken(token) !== null; }
