import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('事项完成确认', () => {
  it('完成和取消完成事项前都需要确认', () => {
    const panel = read('src/components/task-focus-panel.tsx');

    expect(panel).toContain('window.confirm');
    expect(panel).toContain('确定完成事项');
    expect(panel).toContain('确定取消完成事项');
    expect(panel).toContain('if (!ok) return;');
  });
});
