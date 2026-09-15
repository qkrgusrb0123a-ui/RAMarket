import { Router } from 'express';
import { z } from 'zod';
import { supabaseForRequest } from '../lib/supabase.js';
import { medianPrice, type RamGeneration } from '../lib/ram-market.js';

export const ramPriceRouter = Router();

const chartQuery = z.object({
  generation: z.enum(['DDR4', 'DDR5']),
  clockMhz: z.coerce.number().int().positive().max(20_000),
  capacityGb: z.coerce.number().int().positive().max(128),
});

function listingSpecFromCategory(category: string) {
  const match = /^(DDR[45]) · (\d{3,5})MHz · (\d+)GB$/.exec(category);
  if (!match) return null;
  return { generation: match[1] as RamGeneration, clockMhz: Number(match[2]), capacityGb: Number(match[3]) };
}

ramPriceRouter.get('/options', async (request, response, next) => {
  try {
    const { data, error } = await supabaseForRequest(request)
      .from('products')
      .select('category')
      .eq('status', 'active');
    if (error) throw error;
    const options = new Map<string, { generation: RamGeneration; clockMhz: number; capacityGb: number; sampleCount: number }>();
    for (const product of data ?? []) {
      const spec = listingSpecFromCategory(product.category);
      if (!spec) continue;
      const key = `${spec.generation}:${spec.clockMhz}:${spec.capacityGb}`;
      const current = options.get(key);
      options.set(key, { ...spec, sampleCount: (current?.sampleCount ?? 0) + 1 });
    }
    return response.set('Cache-Control', 'no-store').json({ data: [...options.values()].sort((left, right) =>
      right.sampleCount - left.sampleCount || right.clockMhz - left.clockMhz || right.capacityGb - left.capacityGb
    ) });
  } catch (error) { return next(error); }
});

/** Active marketplace listings, grouped by their normalized RAM specification. */
ramPriceRouter.get('/chart', async (request, response, next) => {
  try {
    const { generation, clockMhz, capacityGb } = chartQuery.parse(request.query);
    const category = `${generation} · ${clockMhz}MHz · ${capacityGb}GB`;
    const { data, error } = await supabaseForRequest(request)
      .from('products')
      .select('asking_price')
      .eq('category', category)
      .eq('status', 'active');
    if (error) throw error;
    const prices = (data ?? []).map((product) => Number(product.asking_price)).sort((left, right) => left - right);
    return response.set('Cache-Control', 'no-store').json({ data: {
      generation, clockMhz, capacityGb,
      sampleCount: prices.length,
      minPrice: prices[0] ?? null,
      maxPrice: prices.at(-1) ?? null,
      medianPrice: medianPrice(prices),
      prices
    } });
  } catch (error) { return next(error); }
});
