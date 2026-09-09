import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { verifyPasswordHash } from './password-hash.js';

const tokenLifetimeSeconds = 4 * 60 * 60;

function encode(value: string | Buffer) {
  return Buffer.from(value).toString('base64url');
}

function sign(value: string) {
  return createHmac('sha256', env.ADMIN_SESSION_SECRET).update(value).digest('base64url');
}

export function passwordMatches(password: string) {
  return verifyPasswordHash(password, env.ADMIN_PASSWORD_HASH);
}

export function createAdminToken() {
  const payload = encode(JSON.stringify({ role: 'admin', exp: Math.floor(Date.now() / 1000) + tokenLifetimeSeconds }));
  return `${payload}.${sign(payload)}`;
}

export function isValidAdminToken(token: string | undefined) {
  if (!token) return false;
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return false;
  const expectedSignature = sign(payload);
  if (signature.length !== expectedSignature.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return false;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { role?: unknown; exp?: unknown };
    return data.role === 'admin' && typeof data.exp === 'number' && data.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}
