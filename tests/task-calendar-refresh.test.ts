import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('任务变更会驱动日历刷新', () => {
  it('事项列表删除后会广播 task-changed 事件，日历会监听该事件', () => {
    const taskPanel = read('src/components/task-focus-panel.tsx');
    const calendar = read('src/components/work-calendar.tsx');

    expect(taskPanel).toContain("daily-notes:task-changed");
    expect(taskPanel).toContain('notifyTaskChanged();');
    expect(read('src/components/task-create-form.tsx')).toContain("daily-notes:task-changed");
    expect(calendar).toContain("daily-notes:task-changed");
    expect(calendar).toContain('void loadMonth(monthDate);');
  });
});
