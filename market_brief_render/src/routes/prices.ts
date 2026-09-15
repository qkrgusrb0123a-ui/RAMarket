import { Router } from 'express';
import { z } from 'zod';
import { supabaseForRequest } from '../lib/supabase.js';

export const ramPriceRouter = Router();
const danawaResearchSource = 'danawa-research-licensed-feed';

ramPriceRouter.get('/market-specs', async (_request, response, next) => {
  try {
    const { data, error } = await supabaseForRequest(_request).from('ram_market_daily_summaries').select('ram_spec').eq('source', danawaResearchSource).order('ram_spec');
    if (error) throw error;
    return response.json({ data: [...new Set((data ?? []).map((item) => item.ram_spec))] });
  } catch (error) { return next(error); }
});

/**
 * Returns the licensed Danawa Research chart series. Source rows remain
 * separated in storage so additional providers can be enabled explicitly later.
 */
ramPriceRouter.get('/market-chart', async (request, response, next) => {
  try {
    const { ramSpec } = z.object({ ramSpec: z.string().trim().min(1).max(100) }).parse(request.query);
    const { data, error } = await supabaseForRequest(request).from('ram_market_daily_summaries')
      .select('collected_on,ram_spec,source,product_count,min_price,max_price,average_price')
      .eq('ram_spec', ramSpec).eq('source', danawaResearchSource).order('collected_on', { ascending: true });
    if (error) throw error;
    const grouped = new Map<string, { collectedOn: string; productCount: number; minPrice: number; maxPrice: number; weightedTotal: number; sources: string[] }>();
    for (const item of data ?? []) {
      const current = grouped.get(item.collected_on) ?? { collectedOn: item.collected_on, productCount: 0, minPrice: item.min_price, maxPrice: item.max_price, weightedTotal: 0, sources: [] as string[] };
      current.productCount += item.product_count;
      current.minPrice = Math.min(current.minPrice, item.min_price);
      current.maxPrice = Math.max(current.maxPrice, item.max_price);
      current.weightedTotal += item.average_price * item.product_count;
      current.sources.push(item.source);
      grouped.set(item.collected_on, current);
    }
    const series = [...grouped.values()].map((item) => ({ collectedOn: item.collectedOn, productCount: item.productCount, minPrice: item.minPrice, maxPrice: item.maxPrice, averagePrice: Math.round(item.weightedTotal / item.productCount), sources: item.sources.sort() }));
    return response.json({ data: { ramSpec, series } });
  } catch (error) { return next(error); }
});

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
