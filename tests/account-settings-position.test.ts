import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('账号设置位置调整', () => {
  it('账号设置迁移到管理页，首页只保留入口链接', () => {
    const page = read('src/app/page.tsx');
    const manage = read('src/app/manage/page.tsx');
    const panels = read('src/components/manage-panels.tsx');
    const hero = read('src/components/home-hero.tsx');

    expect(page).not.toContain('id="account-settings"');
    expect(page).toContain('settingsHref="/manage#account-settings"');
    expect(hero).toContain("{canManageUsers ? '管理中心' : '账号设置'}");
    expect(page).toContain('canManageUsers={currentUserCanManageUsers}');
    expect(page).toContain('MobileBottomNav active="home"');
    expect(manage).toContain('id="account-settings"');
    expect(manage).toContain('我的账号');
    expect(panels).not.toContain('href="/manage#account-settings"');
  });
});
