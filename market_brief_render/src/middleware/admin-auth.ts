import type { NextFunction, Request, Response } from 'express';
import { isValidAdminToken } from '../services/admin-auth.js';

export function requireAdmin(request: Request, response: Response, next: NextFunction) {
  const authorization = request.header('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : undefined;
  if (!isValidAdminToken(token)) return response.status(401).json({ error: '관리자 인증이 필요하거나 세션이 만료되었습니다.' });
  return next();
}
