import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('今日聚焦卡片', () => {
  it('在事项状态和列表之间显示聚焦摘要与快捷操作', () => {
    const panel = read('src/components/task-focus-panel.tsx');
    const baseCss = read('src/app/styles/base.css');
    const mobileCss = read('src/app/styles/mobile.css');

    expect(panel).toContain('todayFocusCard');
    expect(panel).toContain('今日聚焦');
    expect(panel).toContain('先处理逾期待办');
    expect(panel).toContain('优先处理');
    expect(panel).toContain("switchView('overdue')");
    expect(panel).toContain("switchView('todo')");
    expect(baseCss).toContain('.todayFocusCard');
    expect(mobileCss).toContain('.todayFocusCard');
  });
});
