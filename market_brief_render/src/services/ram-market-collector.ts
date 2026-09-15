import { z } from 'zod';
import { env } from '../config/env.js';
import { adminSupabase } from '../lib/supabase.js';

export const OBSERVATION_LIMIT_PER_SPEC = 1000;

const observationSchema = z.object({
  ramGeneration: z.enum(['DDR3', 'DDR4', 'DDR5']),
  capacityGb: z.coerce.number().int().min(1).max(1024),
  clockMhz: z.coerce.number().int().min(400).max(20_000),
  price: z.coerce.number().int().nonnegative(),
  sourceProductId: z.string().trim().min(1).max(200),
  sourceProductName: z.string().trim().min(1).max(300),
  sourceUrl: z.string().url().max(2_000).optional()
});

const licensedFeedSchema = z.object({
  authorization: z.object({
    approved: z.literal(true),
    reference: z.string().trim().min(8).max(500)
  }),
  observations: z.array(observationSchema).min(1).max(50_000)
});

export type LicensedRamMarketFeed = z.infer<typeof licensedFeedSchema>;
export type RamMarketObservation = z.infer<typeof observationSchema> & { ramSpec: string };

type ProviderConfig = { source: string; url?: string; token?: string; approved: boolean; licenseReference?: string };

function danawaResearchConfig(): ProviderConfig {
  return { source: 'danawa-research-licensed-feed', url: env.DANAWA_RESEARCH_PROVIDER_URL, token: env.DANAWA_RESEARCH_PROVIDER_TOKEN, approved: env.DANAWA_RESEARCH_DATA_LICENSE_APPROVED, licenseReference: env.DANAWA_RESEARCH_DATA_LICENSE_REFERENCE };
}

export function formatRamSpec(observation: Pick<RamMarketObservation, 'ramGeneration' | 'capacityGb' | 'clockMhz'>) {
  return `${observation.ramGeneration} ${observation.capacityGb}GB ${observation.clockMhz}MHz`;
}

/** Returns the calendar date in Asia/Seoul without relying on server timezone. */
export function seoulDate(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function sourceProductKey(source: string, productId: string) { return `${source}\u0000${productId}`; }

export function normalizeLicensedFeed(input: unknown, source: string): { reference: string; observations: RamMarketObservation[]; rejectedCount: number } {
  const feed = licensedFeedSchema.parse(input);
  const seen = new Set<string>();
  const counts = new Map<string, number>();
  let rejectedCount = 0;
  const observations: RamMarketObservation[] = [];
  for (const item of feed.observations) {
    const ramSpec = formatRamSpec(item);
    const key = sourceProductKey(source, item.sourceProductId);
    if (seen.has(key) || (counts.get(ramSpec) ?? 0) >= OBSERVATION_LIMIT_PER_SPEC) {
      rejectedCount++;
      continue;
    }
    seen.add(key);
    counts.set(ramSpec, (counts.get(ramSpec) ?? 0) + 1);
    observations.push({ ...item, ramSpec });
  }
  return { reference: feed.authorization.reference, observations, rejectedCount };
}

function assertLicensedProvider(config: ProviderConfig) {
  if (!config.url) throw new Error('Danawa Research collection is disabled because its licensed provider URL is not configured.');
  if (!config.approved || !config.licenseReference) {
    throw new Error('Danawa Research collection is disabled until an approved data license and its reference are configured.');
  }
}

async function fetchLicensedFeed(config: ProviderConfig) {
  assertLicensedProvider(config);
  const response = await fetch(config.url!, {
    headers: {
      accept: 'application/json',
      ...(config.token ? { authorization: `Bearer ${config.token}` } : {})
    },
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`Licensed RAM market provider request failed: ${response.status}`);
  return response.json();
}

export async function collectDanawaResearchRamMarketData() {
  const config = danawaResearchConfig();
  const source = config.source;
  const collectedOn = seoulDate();
  let runId: string | undefined;
  try {
    assertLicensedProvider(config);
    const { data: run, error: createError } = await adminSupabase.from('ram_market_collection_runs').upsert({
      scheduled_for: collectedOn, source, authorization_reference: config.licenseReference!, status: 'running', target_per_spec: OBSERVATION_LIMIT_PER_SPEC,
      received_count: 0, accepted_count: 0, rejected_count: 0, failure_reason: null, started_at: new Date().toISOString(), completed_at: null
    }, { onConflict: 'scheduled_for,source' }).select('id').single();
    if (createError) throw createError;
    runId = run.id;
    const rawFeed = await fetchLicensedFeed(config);
    const parsed = normalizeLicensedFeed(rawFeed, source);
    if (parsed.reference !== config.licenseReference) throw new Error('Licensed feed authorization reference does not match the configured approval.');
    const rows = parsed.observations.map((item) => ({ collection_run_id: runId!, collected_on: collectedOn, ram_spec: item.ramSpec, ram_generation: item.ramGeneration, capacity_gb: item.capacityGb, clock_mhz: item.clockMhz, price: item.price, source, source_product_id: item.sourceProductId, source_product_name: item.sourceProductName, source_url: item.sourceUrl ?? null }));
    const { error: observationError } = await adminSupabase.from('ram_market_observations').upsert(rows, { onConflict: 'collected_on,source,source_product_id' });
    if (observationError) throw observationError;
    const summaries = [...new Set(parsed.observations.map((item) => item.ramSpec))].map((ramSpec) => {
      const prices = parsed.observations.filter((item) => item.ramSpec === ramSpec).map((item) => item.price);
      return { collected_on: collectedOn, ram_spec: ramSpec, source, product_count: prices.length, min_price: Math.min(...prices), max_price: Math.max(...prices), average_price: Math.round(prices.reduce((total, price) => total + price, 0) / prices.length), collection_run_id: runId! };
    });
    const { error: summaryError } = await adminSupabase.from('ram_market_daily_summaries').upsert(summaries, { onConflict: 'collected_on,ram_spec,source' });
    if (summaryError) throw summaryError;
    const allComplete = summaries.every((summary) => summary.product_count === OBSERVATION_LIMIT_PER_SPEC);
    const { error: finishError } = await adminSupabase.from('ram_market_collection_runs').update({ status: allComplete ? 'completed' : 'partial', received_count: licensedFeedSchema.parse(rawFeed).observations.length, accepted_count: parsed.observations.length, rejected_count: parsed.rejectedCount, completed_at: new Date().toISOString() }).eq('id', runId);
    if (finishError) throw finishError;
    return { collectedOn, acceptedCount: parsed.observations.length, specCount: summaries.length, status: allComplete ? 'completed' : 'partial' };
  } catch (error) {
    if (runId) await adminSupabase.from('ram_market_collection_runs').update({ status: 'failed', failure_reason: error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error', completed_at: new Date().toISOString() }).eq('id', runId);
    throw error;
  }
}
