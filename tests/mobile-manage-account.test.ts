import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('手机端管理与我的入口整理', () => {
  it('首页不再放管理中心卡片和账号设置表单', () => {
    const page = read('src/app/page.tsx');
    expect(page).not.toContain('manageEntryCard');
    expect(page).not.toContain('id="account-settings"');
    expect(page).not.toContain('action="/api/auth/change-password"');
    expect(page).toContain('settingsHref="/manage#account-settings"');
  });

  it('管理页承载我的账号设置，并允许普通登录用户进入', () => {
    const manage = read('src/app/manage/page.tsx');
    const panels = read('src/components/manage-panels.tsx');
    expect(manage).toContain('id="account-settings"');
    expect(manage).toContain('我的账号');
    expect(manage).toContain('action="/api/auth/change-password"');
    expect(manage).toContain('value="/manage"');
    expect(manage).not.toContain("redirect('/')");
    expect(panels).not.toContain('href="/manage#account-settings"');
  });
});
