import { describe, expect, it } from 'vitest';
import { beijingDateKey, beijingMonthKey } from '../src/lib/beijing-date';

describe('北京时间日期工具', () => {
  it('在 UTC 夜间也能返回北京时间日期', () => {
    const date = new Date('2026-05-12T16:30:00Z');
    expect(beijingDateKey(date)).toBe('2026-05-13');
    expect(beijingMonthKey(date)).toBe('2026-05');
  });
});
