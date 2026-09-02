import { z } from 'zod';
import { env } from '../config/env.js';
import { adminSupabase } from '../lib/supabase.js';

const priceFeedSchema = z.object({
  snapshots: z.array(z.object({
    productId: z.string().uuid(),
    price: z.coerce.number().int().nonnegative(),
    source: z.string().trim().min(1).max(100),
    capturedAt: z.string().datetime().optional()
  })).max(1000)
});

export type PriceSnapshotInput = z.infer<typeof priceFeedSchema>['snapshots'][number];

export async function savePriceSnapshots(snapshots: PriceSnapshotInput[]) {
  if (!snapshots.length) return 0;
  const { error } = await adminSupabase.from('price_snapshots').insert(snapshots.map((snapshot) => ({
    product_id: snapshot.productId,
    price: snapshot.price,
    source: snapshot.source,
    captured_at: snapshot.capturedAt ?? new Date().toISOString()
  })));
  if (error) throw error;
  return snapshots.length;
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
  const feed = priceFeedSchema.parse(await response.json());
  return savePriceSnapshots(feed.snapshots);
}

export function parsePriceFeed(input: unknown) { return priceFeedSchema.parse(input); }
