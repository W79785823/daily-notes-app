import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { beijingDateKey, beijingMonthKey } from '../src/lib/beijing-date';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('北京时间与 PWA 刷新', () => {
  it('北京时间工具在 UTC 夜间返回次日', () => {
    const date = new Date('2026-05-12T16:30:00Z');
    expect(beijingDateKey(date)).toBe('2026-05-13');
    expect(beijingMonthKey(date)).toBe('2026-05');
  });

  it('PWA 带有下拉刷新挂载', () => {
    const layout = read('src/app/layout.tsx');
    const refresh = read('src/components/pwa-pull-to-refresh.tsx');
    expect(layout).toContain('PwaPullToRefresh');
    expect(refresh).toContain('window.location.reload()');
  });
});
