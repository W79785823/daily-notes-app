import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('首页快捷筛选', () => {
  it('在日期卡片里提供全部、我的、未完成三个轻量入口且不跳转到列表锚点', () => {
    const page = read('src/app/page.tsx');
    const hero = read('src/components/home-hero.tsx');
    const baseCss = read('src/app/styles/base.css');
    const mobileCss = read('src/app/styles/mobile.css');

    expect(page).toContain('const quickFilterHref');
    expect(hero).toContain('className="mobileQuickFilters"');
    expect(hero).toContain('快捷事项筛选');
    expect(page).toContain("allHref={quickFilterHref('all', 'all')}");
    expect(page).toContain("mineHref={quickFilterHref('all', currentUser.id)}");
    expect(page).toContain("todoHref={quickFilterHref('todo', 'all')}");
    expect(hero).toContain('>全部</a>');
    expect(hero).toContain('>我的</a>');
    expect(hero).toContain('>未完成</a>');
    expect(page).toContain("const quickFilterActive = assigneeId === currentUser.id ? 'mine'");
    expect(page).not.toContain('status=all&assigneeId=all#task-list');
    expect(baseCss).toContain('.mobileQuickFilters');
    expect(mobileCss).toContain('.mobileQuickFilters');
  });
});
