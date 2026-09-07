import { z } from 'zod';
import { env } from '../config/env.js';
import { adminSupabase } from '../lib/supabase.js';

const ramPriceFeedSchema = z.object({
  prices: z.array(z.object({
    ramName: z.string().trim().min(1).max(100),
    price: z.coerce.number().int().nonnegative(),
    source: z.string().trim().min(1).max(100),
    weekStart: z.string().date().optional()
  })).max(1000)
});

export type RamPriceInput = z.infer<typeof ramPriceFeedSchema>['prices'][number];

function currentWeekStart() {
  const today = new Date();
  const utcDay = today.getUTCDay() || 7;
  today.setUTCDate(today.getUTCDate() - utcDay + 1);
  return today.toISOString().slice(0, 10);
}

export async function saveRamPrices(prices: RamPriceInput[]) {
  if (!prices.length) return 0;
  const { error } = await adminSupabase.from('ram_price').upsert(prices.map((price) => ({
    ram_name: price.ramName,
    price: price.price,
    source: price.source,
    week_start: price.weekStart ?? currentWeekStart()
  })), { onConflict: 'ram_name,source,week_start' });
  if (error) throw error;
  return prices.length;
}

/**
 * A source-specific crawler/API adapter should expose the documented feed format.
 * This keeps scraping credentials and terms-of-service-sensitive code outside the public API.
 */
export async function collectWeeklyPrices() {
  if (!env.PRICE_FEED_URL) {
    console.info('PRICE_FEED_URL is not configured; skipped weekly price collection.');
    return 0;
  }
  const response = await fetch(env.PRICE_FEED_URL, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Price feed request failed: ${response.status}`);
  const feed = ramPriceFeedSchema.parse(await response.json());
  return saveRamPrices(feed.prices);
}

export function parseRamPriceFeed(input: unknown) { return ramPriceFeedSchema.parse(input); }
