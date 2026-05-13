import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('管理页账号卡视觉统一', () => {
  it('我的账号不再继承首页账号卡样式，并和公告/新增成员用同一套折叠卡规则', () => {
    const manage = read('src/app/manage/page.tsx');
    const forms = read('src/app/styles/forms.css');
    const manageCss = read('src/app/styles/manage.css');

    expect(manage).toContain('className="workspaceCard manageAccountCard collapsibleToolCard"');
    expect(manage).not.toContain('accountSettingsCard manageAccountCard');
    expect(forms).toContain('.publishNoticeCard.collapsibleToolCard,\n  .addMemberCard.collapsibleToolCard,\n  .manageAccountCard.collapsibleToolCard');
    expect(forms).toContain('.publishNoticeCard.collapsibleToolCard .toolSummary,\n  .addMemberCard.collapsibleToolCard .toolSummary,\n  .manageAccountCard.collapsibleToolCard .toolSummary');
    expect(forms).toContain('.publishNoticeCard.collapsibleToolCard .toolBody,\n  .addMemberCard.collapsibleToolCard .toolBody,\n  .manageAccountCard.collapsibleToolCard .toolBody');
    expect(manageCss).toContain('.manageAccountCard > summary');
    expect(manageCss).toContain('.managePublishCard > summary');
    expect(manageCss).toContain('.addMemberCard > summary');
  });
});
