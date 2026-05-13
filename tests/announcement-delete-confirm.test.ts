import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('团队公告删除确认', () => {
  it('首页团队公告删除必须使用确认组件，不能直接提交删除表单', () => {
    const page = read('src/app/page.tsx');
    const list = read('src/components/announcement-list.tsx');
    const button = read('src/components/announcement-delete-button.tsx');

    expect(page).toContain("import { AnnouncementList } from '@/components/announcement-list';");
    expect(list).toContain("import { AnnouncementDeleteButton } from '@/components/announcement-delete-button';");
    expect(list).toContain('<AnnouncementDeleteButton id={item.id} title={item.title} />');
    expect(page).not.toContain('action={`/api/announcements/${item.id}`} method="post"');
    expect(list).not.toContain('action={`/api/announcements/${item.id}`} method="post"');
    expect(button).toContain('window.confirm');
    expect(button).toContain('确认删除公告');
    expect(button).toContain('window.location.reload()');
  });
});
