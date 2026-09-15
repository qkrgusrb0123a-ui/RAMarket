import { describe, expect, it } from 'vitest';
import { normalizeRamSpec, parseRamSpec } from './ram-spec.js';

describe('normalizeRamSpec', () => {
  it('excludes a manufacturer from a complete RAM specification', () => {
    expect(normalizeRamSpec('삼성전자 DDR5 · 5600MHz · 16GB'))
      .toBe('DDR5 · 5600MHz · 16GB');
  });

  it('preserves custom categories that do not contain a full RAM specification', () => {
    expect(normalizeRamSpec('기타 메모리')).toBe('기타 메모리');
  });

  it('parses a normalized specification so chart data can combine different clocks', () => {
    expect(parseRamSpec('DDR5 · 5600MHz · 16GB')).toEqual({ generation: 'DDR5', clockMhz: 5600, capacityGb: 16 });
    expect(parseRamSpec('기타 메모리')).toBeNull();
  });
});
