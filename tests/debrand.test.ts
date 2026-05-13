import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('应用去品牌化', () => {
  it('不再出现思源纺织/思源品牌文案，适合复用给其他团队', () => {
    const files = [
      'src/app/page.tsx',
      'src/app/login/page.tsx',
      'src/app/layout.tsx',
      'public/site.webmanifest',
      'public/icon.svg',
    ];
    const combined = files.map(read).join('\n');
    expect(combined).not.toContain('思源纺织');
    expect(combined).not.toContain('思源每日事项');
    expect(combined).not.toContain('思源内部');
    expect(combined).not.toContain('Powered by 思源');
    expect(read('src/app/login/page.tsx')).toContain('每日事项工作台');
    expect(read('src/app/layout.tsx')).toContain("title: '每日事项'");
    expect(read('public/site.webmanifest')).toContain('"name": "每日事项"');
  });
});
