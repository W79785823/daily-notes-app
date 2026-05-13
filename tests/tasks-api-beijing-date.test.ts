import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('任务接口北京时间', () => {
  it('逾期待办接口使用北京时间 todayKey，避免服务器 UTC 影响', () => {
    const route = read('src/app/api/tasks/route.ts');

    expect(route).toContain("import { beijingDateKey } from '@/lib/beijing-date';");
    expect(route).toContain('const todayKey = beijingDateKey();');
    expect(route).not.toContain("const todayKey = new Date().toISOString().slice(0, 10);");
  });

  it('任务列表接口返回当前用户对事项的操作权限，避免日历切换后编辑/删除按钮消失', () => {
    const route = read('src/app/api/tasks/route.ts');

    expect(route).toContain("canComplete: canActOnTask(user, task, 'complete')");
    expect(route).toContain("canDelete: canActOnTask(user, task, 'delete')");
    expect(route).toContain("canEdit: canActOnTask(user, task, 'edit')");
  });
});
