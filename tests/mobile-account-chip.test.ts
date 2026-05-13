import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('手机端当前账号轻量化', () => {
  it('当前账号改为真正的圆形按钮菜单', () => {
    const page = read('src/app/page.tsx');
    const hero = read('src/components/home-hero.tsx');
    expect(hero).toContain('<MobileAccountMenu');
    expect(page).toContain('todayHref={`?date=${todayKey}&status=all&assigneeId=all`}');
    expect(page).not.toContain('todayHref={`?date=${todayKey}&status=all&assigneeId=all#task-list`}');
    expect(page).toContain('settingsHref="/manage#account-settings"');
    expect(hero).not.toContain('mobileAccountChip');
    expect(hero).not.toContain('accountAvatar');
    expect(hero).not.toContain('accountChipText');
  });

  it('手机端样式只保留圆形按钮和独立菜单', () => {
    const globals = read('src/app/globals.css');
    const css = read('src/app/styles/mobile-stage7.css');
    expect(globals).toContain("@import './styles/mobile-stage7.css'");
    expect(css).toContain('.mobileAccountMenu');
    expect(css).toContain('.mobileAccountButton');
    expect(css).toContain('border-radius: 999px');
    expect(css).toContain('background: linear-gradient');
    expect(css).toContain('box-shadow: 0 6px 14px');
    expect(css).toContain('.accountChipMenu');
    expect(css).toContain('.accountMenuHeader');
  });
});
