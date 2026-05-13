import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('管理页普通用户精简', () => {
  it('普通用户进入管理页时显示我的而不是管理中心文案', () => {
    const page = read('src/app/manage/page.tsx');
    const panels = read('src/components/manage-panels.tsx');

    expect(page).toContain("<ManageHero personal={!currentUserCanManageUsers && !currentUserCanCreateAnnouncement} />");
    expect(panels).toContain('export function ManageHero({ personal = false }');
    expect(panels).toContain("<h1>{personal ? '我的' : '管理中心'}</h1>");
    expect(panels).toContain("{personal ? 'ACCOUNT' : 'MANAGE'}");
    expect(panels).toContain('日常事项仍在首页处理');
  });
});
