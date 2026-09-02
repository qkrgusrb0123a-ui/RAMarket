import type { NextFunction, Request, Response } from 'express';
import { supabaseForRequest } from '../lib/supabase.js';

export async function requireAuth(request: Request, response: Response, next: NextFunction) {
  const bearerToken = request.header('authorization');
  if (!bearerToken?.startsWith('Bearer ')) {
    return response.status(401).json({ error: 'Authorization bearer token is required.' });
  }

  const { data, error } = await supabaseForRequest(request).auth.getUser();
  if (error || !data.user) return response.status(401).json({ error: 'Invalid or expired session.' });

  request.userId = data.user.id;
  return next();
}
