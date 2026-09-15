/**
 * Converts a listing category into the chart's manufacturer-independent key.
 * Listings may keep a manufacturer in their title, but the price chart is
 * intentionally grouped only by RAM generation, clock speed, and capacity.
 */
export function normalizeRamSpec(category: string): string {
  const value = category.trim();
  const generation = value.match(/\bDDR\s*([345])\b/i)?.[1];
  const clock = value.match(/\b(\d{3,5})\s*MHz\b/i)?.[1];
  const capacity = value.match(/\b(\d+)\s*GB\b/i)?.[1];

  if (!generation || !clock || !capacity) return value;
  return `DDR${generation} · ${clock}MHz · ${capacity}GB`;
}

/** Reads the normalized RAM category used by marketplace listings. */
export function parseRamSpec(category: string) {
  const match = /^(DDR[45]) · (\d{3,5})MHz · (\d+)GB$/.exec(category.trim());
  if (!match) return null;
  return { generation: match[1] as 'DDR4' | 'DDR5', clockMhz: Number(match[2]), capacityGb: Number(match[3]) };
}
