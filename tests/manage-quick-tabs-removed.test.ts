import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('管理页不显示顶部快捷按钮', () => {
  it('移除我的/人员/公告/审计快捷入口这一排', () => {
    const manage = read('src/app/manage/page.tsx');
    expect(manage).not.toContain('manageQuickTabs');
    expect(manage).not.toContain('管理快捷入口');
    expect(manage).not.toContain('<a href="#members">人员</a>');
    expect(manage).not.toContain('<a href="#notices">公告</a>');
    expect(manage).not.toContain('<a href="#audit">审计</a>');
  });
});
