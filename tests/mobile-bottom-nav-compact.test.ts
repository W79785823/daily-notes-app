import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('移动端底部导航精简', () => {
  it('只保留今日和管理两个入口', () => {
    const component = read('src/components/manage-panels.tsx');
    const css = read('src/app/styles/manage.css');

    expect(component).toContain('compactMobileBottomNav');
    expect(component).toContain('href="/">今日</a>');
    expect(component).toContain('href="/manage">管理</a>');
    expect(component).not.toContain('href="/#task-list">事项</a>');
    expect(component).not.toContain('href="/manage#account-settings">我的</a>');
    expect(css).toContain('grid-template-columns: repeat(2, minmax(0, 1fr));');
    expect(css).not.toContain('grid-template-columns: repeat(4, minmax(0, 1fr));');
  });
});
