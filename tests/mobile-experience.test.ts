import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('手机端体验与危险操作保护', () => {
  it('危险操作需要二次确认', () => {
    const taskPanel = read('src/components/task-focus-panel.tsx');
    const forms = read('src/components/management-forms.tsx');
    const announcementDelete = read('src/components/announcement-delete-button.tsx');

    expect(taskPanel).toContain('确定删除这条事项吗');
    expect(forms).toContain('确定停用');
    expect(forms).toContain('确定重置');
    expect(announcementDelete).toContain('确认删除公告');
  });

  it('手机端管理页去掉多余快捷入口，保留底部导航和触控优化', () => {
    const managePage = read('src/app/manage/page.tsx');
    const mobileCss = read('src/app/styles/mobile.css');

    expect(managePage).not.toContain('manageQuickTabs');
    expect(managePage).not.toContain('href="#members"');
    expect(managePage).not.toContain('href="#notices"');
    expect(managePage).not.toContain('href="#audit"');
    expect(managePage).toContain('<MobileBottomNav active="manage" />');
    expect(mobileCss).toContain('touch-action: manipulation');
  });
});
