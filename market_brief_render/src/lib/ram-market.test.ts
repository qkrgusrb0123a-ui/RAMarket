import { describe, expect, it } from 'vitest';
import { averagePrice, koreaDate, medianPrice, ramMarketSpecs, titleMatchesRamSpec } from './ram-market.js';

describe('RAM market helpers', () => {
  it('calculates a central median without retaining price samples', () => {
    expect(medianPrice([30000, 10000, 20000])).toBe(20000);
    expect(medianPrice([10000, 30000])).toBe(20000);
    expect(medianPrice([])).toBeNull();
  });

  it('calculates a rounded average for the current listing prices', () => {
    expect(averagePrice([10000, 20000, 25000])).toBe(18333);
    expect(averagePrice([])).toBeNull();
  });

  it('keeps only results matching the requested DDR generation and capacity', () => {
    expect(titleMatchesRamSpec('삼성전자 DDR5 16GB 메모리', 'DDR5', 16)).toBe(true);
    expect(titleMatchesRamSpec('삼성전자 DDR4 16GB 메모리', 'DDR5', 16)).toBe(false);
    expect(titleMatchesRamSpec('삼성전자 DDR5 32GB 메모리', 'DDR5', 16)).toBe(false);
  });

  it('uses Korea Standard Time for collection dates', () => {
    expect(koreaDate(new Date('2026-09-14T15:00:00.000Z'))).toBe('2026-09-15');
  });

  it('offers a DDR5 128GB category', () => {
    expect(ramMarketSpecs.find((spec) => spec.generation === 'DDR5')?.capacitiesGb).toContain(128);
  });
});
