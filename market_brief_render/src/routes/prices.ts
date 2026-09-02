import { Router } from 'express';
import { supabaseForRequest } from '../lib/supabase.js';

export const pricesRouter = Router();

pricesRouter.get('/products/:productId/history', async (request, response, next) => {
  try {
    const { data, error } = await supabaseForRequest(request)
      .from('price_snapshots')
      .select('id,price,source,captured_at')
      .eq('product_id', request.params.productId)
      .order('captured_at', { ascending: true });
    if (error) throw error;
    return response.json({ data });
  } catch (error) { return next(error); }
});
