import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('管理页卡片顺序与默认展开状态', () => {
  it('发布公告排最上面且默认展开，其他两个默认收起', () => {
    const manage = read('src/app/manage/page.tsx');
    const side = read('src/components/manage-panels.tsx');

    expect(manage.indexOf('managePublishCard')).toBeGreaterThan(-1);
    expect(manage.indexOf('managePublishCard')).toBeLessThan(manage.indexOf('manageAccountCard'));
    expect(manage).toContain('<details id="notices" className="workspaceCard announcementCard publishNoticeCard managePublishCard collapsibleToolCard" open>');
    expect(manage).toContain('<details id="account-settings" className="workspaceCard manageAccountCard collapsibleToolCard">');
    expect(side).toContain('<details className="workspaceCard addMemberCard collapsibleToolCard">');
    expect(side).not.toContain('<details className="workspaceCard addMemberCard collapsibleToolCard" open>');
  });

  it('收起后的标题宽度保持对齐', () => {
    const css = read('src/app/styles/manage.css');
    expect(css).toContain('.manageAccountCard > summary');
    expect(css).toContain('.managePublishCard > summary');
    expect(css).toContain('.addMemberCard > summary');
    expect(css).toContain('width: 100%');
    expect(css).toContain('box-sizing: border-box');
  });
});
