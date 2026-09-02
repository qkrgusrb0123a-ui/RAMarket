import { createClient } from '@supabase/supabase-js';
import type { Request } from 'express';
import { env } from '../config/env.js';

export const adminSupabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

/** Creates a request-scoped client so Supabase RLS policies receive the caller JWT. */
export function supabaseForRequest(request: Request) {
  const authorization = request.header('authorization') ?? '';
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
