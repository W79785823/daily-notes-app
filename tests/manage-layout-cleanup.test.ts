import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('管理页手机端布局整理', () => {
  it('发布公告不在侧栏顶部，最近公告卡片被移除', () => {
    const manage = read('src/app/manage/page.tsx');
    const panels = read('src/components/manage-panels.tsx');
    expect(manage).toContain('managePublishCard');
    expect(manage).toContain('<AnnouncementPublishForm />');
    expect(panels).not.toContain('publishNoticeCard');
    expect(panels).not.toContain('最近公告');
    expect(panels).not.toContain('compactAnnouncementList');
  });

  it('我的账号卡片和其他主卡片同宽对齐', () => {
    const manage = read('src/app/manage/page.tsx');
    const css = read('src/app/styles/manage.css');
    expect(manage).toContain('manageAccountCard');
    expect(css).toContain('.mainStack > .workspaceCard');
    expect(css).toContain('.manageAccountCard');
    expect(css).toContain('.managePublishCard');
    expect(css).toContain('box-sizing: border-box');
  });
});
