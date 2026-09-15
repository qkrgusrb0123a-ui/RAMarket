import { env } from '../config/env.js';
import { ramMarketSpecs, koreaDate, medianPrice, ramSpecLabel, titleMatchesRamSpec, type RamGeneration } from '../lib/ram-market.js';
import { adminSupabase } from '../lib/supabase.js';

type NaverShoppingItem = { title?: string; lprice?: string; hprice?: string };
type NaverShoppingResponse = { items?: NaverShoppingItem[] };

async function collectSpec(generation: RamGeneration, capacityGb: number, collectedOn: string) {
  if (!env.NAVER_SHOPPING_CLIENT_ID || !env.NAVER_SHOPPING_CLIENT_SECRET) {
    throw new Error('NAVER_SHOPPING_CLIENT_ID and NAVER_SHOPPING_CLIENT_SECRET are required for collection.');
  }
  const query = encodeURIComponent(`${generation} ${capacityGb}GB RAM`);
  const url = `https://openapi.naver.com/v1/search/shop.json?query=${query}&display=100&sort=asc&exclude=used:rental:cbshop`;
  const response = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': env.NAVER_SHOPPING_CLIENT_ID,
      'X-Naver-Client-Secret': env.NAVER_SHOPPING_CLIENT_SECRET
    }
  });
  if (!response.ok) throw new Error(`Naver Shopping API returned ${response.status} for ${generation} ${capacityGb}GB.`);
  const payload = await response.json() as NaverShoppingResponse;
  const prices = (payload.items ?? []).slice(0, 100)
    .filter((item) => titleMatchesRamSpec(item.title ?? '', generation, capacityGb))
    .map((item) => ({ low: Number(item.lprice), high: Number(item.hprice) }))
    .filter((item) => Number.isInteger(item.low) && item.low > 0)
    .map((item) => ({ ...item, high: Number.isInteger(item.high) && item.high > 0 ? item.high : item.low }));

  if (!prices.length) throw new Error(`No matching Naver Shopping prices returned for ${generation} ${capacityGb}GB.`);
  const { error } = await adminSupabase.from('ram_market_daily_prices').upsert({
    collected_on: collectedOn,
    ram_generation: generation,
    capacity_gb: capacityGb,
    sample_count: prices.length,
    min_price: Math.min(...prices.map((item) => item.low)),
    max_price: Math.max(...prices.map((item) => item.high)),
    median_price: medianPrice(prices.map((item) => item.low))
  }, { onConflict: 'collected_on,ram_generation,capacity_gb' });
  if (error) throw error;
  return { generation, capacityGb, sampleCount: prices.length };
}

async function main() {
  const collectedOn = koreaDate();
  const results: unknown[] = [];
  const failures: string[] = [];
  for (const { generation, capacitiesGb } of ramMarketSpecs) {
    for (const capacityGb of capacitiesGb) {
      try {
        results.push(await collectSpec(generation, capacityGb, collectedOn));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        failures.push(`${ramSpecLabel(generation, capacityGb)}: ${message}`);
        console.error(message);
      }
    }
  }
  if (!results.length) throw new Error(`RAM market collection failed: ${failures.join(' | ')}`);
  console.info(JSON.stringify({ collectedOn, completed: results, failures }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
