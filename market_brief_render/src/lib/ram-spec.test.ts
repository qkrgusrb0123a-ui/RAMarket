import { describe, expect, it } from 'vitest';
import { normalizeRamSpec } from './ram-spec.js';

describe('normalizeRamSpec', () => {
  it('excludes a manufacturer from a complete RAM specification', () => {
    expect(normalizeRamSpec('삼성전자 DDR5 · 5600MHz · 16GB'))
      .toBe('DDR5 · 5600MHz · 16GB');
  });

  it('preserves custom categories that do not contain a full RAM specification', () => {
    expect(normalizeRamSpec('기타 메모리')).toBe('기타 메모리');
  });
});
