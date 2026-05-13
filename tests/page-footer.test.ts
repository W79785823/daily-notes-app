import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('首页底部页脚', () => {
  it('每日事项工作台和今日日期在底部居中显示，并避开手机底部导航', () => {
    const page = read('src/app/page.tsx');
    const baseCss = read('src/app/styles/base.css');

    expect(page).toContain('<footer className="pageFooter">');
    expect(page).toContain('每日事项工作台 · 今日日期 {todayKey}');
    expect(baseCss).toContain('.pageFooter {');
    expect(baseCss).toContain('justify-content: center;');
    expect(baseCss).toContain('text-align: center;');
    expect(baseCss).toContain('calc(70px + env(safe-area-inset-bottom))');
  });
});
