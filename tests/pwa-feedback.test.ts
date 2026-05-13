import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('PWA 反馈提示', () => {
  it('挂载状态提示和下拉刷新提示', () => {
    const layout = read('src/app/layout.tsx');
    const toaster = read('src/components/pwa-status-toaster.tsx');
    const pull = read('src/components/pwa-pull-to-refresh.tsx');
    const css = read('src/app/styles/pwa-feedback.css');

    expect(layout).toContain('PwaStatusToaster');
    expect(layout).toContain('PwaPullToRefresh');
    expect(toaster).toContain("window.addEventListener('offline'");
    expect(toaster).toContain("window.addEventListener('online'");
    expect(toaster).toContain('正在刷新页面');
    expect(toaster).toContain('已进入桌面应用模式');
    expect(toaster).toContain('daily-notes-standalone-hint-shown');
    expect(pull).toContain('继续下拉刷新');
    expect(pull).toContain('正在刷新…');
    expect(css).toContain('.pwaStatusToast');
    expect(css).toContain('.pwaPullHint');
  });
});
