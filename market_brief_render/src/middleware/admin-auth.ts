import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env.js';
import { readAdminToken } from '../services/admin-auth.js';

export function requireAdmin(request: Request, response: Response, next: NextFunction) {
  const authorization = request.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
  const admin = readAdminToken(token);
  if (!admin) return response.status(401).json({ error: '관리자 인증이 필요하거나 세션이 만료되었습니다.' });
  if (env.adminAllowedIps.length && !env.adminAllowedIps.includes(request.ip ?? '')) return response.status(403).json({ error: '허용되지 않은 IP입니다.' });
  request.adminRole = admin.role;
  return next();
}
