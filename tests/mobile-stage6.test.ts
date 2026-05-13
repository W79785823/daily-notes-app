import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('手机端轻量优化', () => {
  it('快速新增在手机端使用折叠入口', () => {
    const form = read('src/components/task-create-form.tsx');
    expect(form).toContain('mobileCreateDetails');
    expect(form).toContain('mobileCreateSummary');
    expect(form).toContain('open={isDesktop}');
    expect(form).toContain("window.matchMedia('(min-width: 681px)')");
  });

  it('手机端样式优化表单和事项操作按钮', () => {
    const globals = read('src/app/globals.css');
    const css = read('src/app/styles/mobile-stage6.css');
    expect(globals).toContain("@import './styles/mobile-stage6.css'");
    expect(css).toContain('.modernActions');
    expect(css).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))');
    expect(css).toContain('.mobileCreateSummary');
    expect(css).toContain('.statusTabs');
  });
});
