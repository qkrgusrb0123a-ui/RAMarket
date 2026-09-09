import type { NextFunction, Request, Response } from 'express';
import { adminSupabase, supabaseForRequest } from '../lib/supabase.js';

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const bearerToken = request.header('authorization');
  if (!bearerToken?.startsWith('Bearer ')) {
    return response.status(401).json({ error: 'Authorization bearer token is required.' });
  }

  const { data, error } = await supabaseForRequest(request).auth.getUser();
  if (error || !data.user) return response.status(401).json({ error: 'Invalid or expired session.' });

  request.userId = data.user.id;
  const { data: account, error: accountError } = await adminSupabase
    .from('users')
    .select('status')
    .eq('id', data.user.id)
    .maybeSingle();
  if (accountError) return next(accountError);
  if (!account || account.status === 'suspended') {
    return response.status(403).json({ error: '활동이 정지된 계정입니다. 관리자에게 문의해 주세요.' });
  }
  return next();
}
