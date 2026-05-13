import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('创建事项日期跟随日历选择', () => {
  it('TaskCreateForm 监听日历选中日期并使用受控日期输入', () => {
    const form = read('src/components/task-create-form.tsx');
    const calendar = read('src/components/work-calendar.tsx');

    expect(calendar).toContain("daily-notes:select-date");
    expect(form).toContain("window.addEventListener('daily-notes:select-date'");
    expect(form).toContain('setSelectedDate(nextDate)');
    expect(form).toContain('新事项会发布到这一天');
    expect(form).toContain('value={selectedDate}');
    expect(form).toContain("date: String(formData.get('date') || selectedDate)");
  });
});
