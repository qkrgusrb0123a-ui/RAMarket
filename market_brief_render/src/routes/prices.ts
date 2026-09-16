import { Router } from 'express';
import { z } from 'zod';
import { supabaseForRequest } from '../lib/supabase.js';
import { averagePrice, medianPrice, ramMarketSpecs, type RamGeneration } from '../lib/ram-market.js';
import { parseRamSpec } from '../lib/ram-spec.js';

export const ramPriceRouter = Router();

const chartQuery = z.object({
  generation: z.enum(['DDR4', 'DDR5']),
  capacityGb: z.coerce.number().int().positive().max(128),
});

ramPriceRouter.get('/options', async (request, response, next) => {
  try {
    const { data, error } = await supabaseForRequest(request)
      .from('products')
      .select('category')
      .eq('status', 'active');
    if (error) throw error;
    const options = new Map<string, { generation: RamGeneration; capacityGb: number; sampleCount: number }>();
    for (const { generation, capacitiesGb } of ramMarketSpecs) {
      for (const capacityGb of capacitiesGb) options.set(`${generation}:${capacityGb}`, { generation, capacityGb, sampleCount: 0 });
    }
    for (const product of data ?? []) {
      const spec = parseRamSpec(product.category);
      if (!spec || (spec.generation === 'DDR5' && spec.capacityGb === 96)) continue;
      const key = `${spec.generation}:${spec.capacityGb}`;
      const current = options.get(key);
      options.set(key, { generation: spec.generation, capacityGb: spec.capacityGb, sampleCount: (current?.sampleCount ?? 0) + 1 });
    }
    return response.set('Cache-Control', 'no-store').json({ data: [...options.values()].sort((left, right) =>
      left.generation.localeCompare(right.generation) || left.capacityGb - right.capacityGb
    ) });
  } catch (error) { return next(error); }
});

/** Active marketplace listings, grouped across all clocks for a RAM generation and capacity. */
ramPriceRouter.get('/chart', async (request, response, next) => {
  try {
    const { generation, capacityGb } = chartQuery.parse(request.query);
    const { data, error } = await supabaseForRequest(request)
      .from('products')
      .select('category,asking_price')
      .eq('status', 'active');
    if (error) throw error;
    const prices = (data ?? [])
      .filter((product) => {
        const spec = parseRamSpec(product.category);
        return spec?.generation === generation && spec.capacityGb === capacityGb;
      })
      .map((product) => Number(product.asking_price))
      .sort((left, right) => left - right);
    return response.set('Cache-Control', 'no-store').json({ data: {
      generation, capacityGb,
      sampleCount: prices.length,
      minPrice: prices[0] ?? null,
      maxPrice: prices.at(-1) ?? null,
      medianPrice: medianPrice(prices),
      averagePrice: averagePrice(prices),
      prices
    } });
  } catch (error) { return next(error); }
});
