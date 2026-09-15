import { Router } from 'express';
import { z } from 'zod';
import { supabaseForRequest } from '../lib/supabase.js';
import { dateDaysBeforeKorea, koreaDate, ramMarketSpecs, type RamGeneration } from '../lib/ram-market.js';

export const ramPriceRouter = Router();

const chartQuery = z.object({
  generation: z.enum(['DDR4', 'DDR5']),
  capacityGb: z.coerce.number().int().positive().max(128),
  days: z.coerce.number().int().min(7).max(84).default(7)
});

ramPriceRouter.get('/options', (_request, response) => {
  return response.set('Cache-Control', 'public, max-age=3600').json({ data: ramMarketSpecs });
});

/** Daily Naver Shopping values. Raw product results are discarded after aggregation. */
ramPriceRouter.get('/chart', async (request, response, next) => {
  try {
    const { generation, capacityGb, days } = chartQuery.parse(request.query);
    const available = ramMarketSpecs.find((item) => item.generation === generation)?.capacitiesGb.some((capacity) => capacity === capacityGb);
    if (!available) return response.status(400).json({ error: '지원하지 않는 RAM 규격 또는 용량입니다.' });
    const today = koreaDate();
    const from = dateDaysBeforeKorea(days - 1);
    const { data, error } = await supabaseForRequest(request)
      .from('ram_market_daily_prices')
      .select('collected_on,sample_count,min_price,max_price,median_price')
      .eq('ram_generation', generation satisfies RamGeneration)
      .eq('capacity_gb', capacityGb)
      .gte('collected_on', from)
      .lte('collected_on', today)
      .order('collected_on', { ascending: true });
    if (error) throw error;
    const points = (data ?? []).map((row) => ({
      date: row.collected_on,
      sampleCount: Number(row.sample_count),
      minPrice: Number(row.min_price),
      maxPrice: Number(row.max_price),
      medianPrice: Number(row.median_price)
    }));
    const todayPoint = points.find((point) => point.date === today) ?? null;
    return response.set('Cache-Control', 'no-store').json({ data: {
      generation, capacityGb, days, from, to: today,
      todayMedianPrice: todayPoint?.medianPrice ?? null,
      todaySampleCount: todayPoint?.sampleCount ?? 0,
      points
    } });
  } catch (error) { return next(error); }
});
