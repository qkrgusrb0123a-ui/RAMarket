import { Router } from 'express';
import { z } from 'zod';
import { supabaseForRequest } from '../lib/supabase.js';

export const ramPriceRouter = Router();

ramPriceRouter.get('/history', async (request, response, next) => {
  try {
    const { ramName } = z.object({ ramName: z.string().trim().min(1).max(100).optional() }).parse(request.query);
    let statement = supabaseForRequest(request)
      .from('ram_price')
      .select('id,ram_name,price,source,week_start')
      .order('week_start', { ascending: true });
    if (ramName) statement = statement.eq('ram_name', ramName);
    const { data, error } = await statement;
    if (error) throw error;
    return response.json({ data });
  } catch (error) { return next(error); }
});
