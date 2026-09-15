export const ramMarketSpecs = [
  { generation: 'DDR4', capacitiesGb: [4, 8, 16, 32, 64] },
  { generation: 'DDR5', capacitiesGb: [8, 16, 32, 48, 64, 128] }
] as const;

export type RamGeneration = (typeof ramMarketSpecs)[number]['generation'];

export function medianPrice(prices: readonly number[]) {
  if (!prices.length) return null;
  const sorted = [...prices].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function averagePrice(prices: readonly number[]) {
  if (!prices.length) return null;
  return Math.round(prices.reduce((total, price) => total + price, 0) / prices.length);
}

/** YYYY-MM-DD in Korea Standard Time, independent of the server's locale. */
export function koreaDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function dateDaysBeforeKorea(days: number, date = new Date()) {
  const koreaMidnight = new Date(`${koreaDate(date)}T00:00:00+09:00`);
  koreaMidnight.setUTCDate(koreaMidnight.getUTCDate() - days);
  return koreaDate(koreaMidnight);
}

export function ramSpecLabel(generation: RamGeneration, capacityGb: number) {
  return `${generation} ${capacityGb}GB`;
}

export function titleMatchesRamSpec(title: string, generation: RamGeneration, capacityGb: number) {
  const text = title.replace(/<[^>]+>/g, ' ').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const capacity = new RegExp(`(?:^|[^0-9])${capacityGb}\\s*(?:GB|G)(?:$|[^A-Z])`, 'i');
  return new RegExp(`\\b${generation}\\b`, 'i').test(text) && capacity.test(text);
}
