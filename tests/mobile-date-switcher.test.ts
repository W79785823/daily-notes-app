import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('手机首页日期切换', () => {
  it('提供前一天、后一天、回到今天的轻量日期切换入口', () => {
    const page = read('src/app/page.tsx');
    const hero = read('src/components/home-hero.tsx');
    const homeUi = read('src/lib/home-ui.ts');
    const baseCss = read('src/app/styles/base.css');
    const mobileCss = read('src/app/styles/mobile.css');

    expect(homeUi).toContain('function addDays(value: string, offset: number)');
    expect(page).toContain('const previousDate = addDays(date, -1);');
    expect(page).toContain('const nextDate = addDays(date, 1);');
    expect(hero).toContain('className="mobileDateSwitcher"');
    expect(hero).toContain('前一天');
    expect(hero).toContain('后一天');
    expect(hero).toContain('回到今天');
    expect(page).toContain('return `?${next.toString()}`;');
    expect(page).not.toContain('return `?${next.toString()}#task-list`;');
    expect(baseCss).toContain('.mobileDateSwitcher');
    expect(baseCss).toContain('.mobileTodayLink');
    expect(mobileCss).toContain('.mobileDateSwitcher');
  });
});
