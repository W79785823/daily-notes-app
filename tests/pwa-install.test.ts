import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('PWA 安装与离线体验', () => {
  it('首页包含 PWA 安装引导', () => {
    const page = read('src/app/page.tsx');
    const banner = read('src/components/pwa-install-banner.tsx');

    expect(page).toContain('PwaInstallBanner');
    expect(banner).toContain('beforeinstallprompt');
    expect(banner).toContain('添加到桌面');
  });

  it('service worker 使用网络优先和离线兜底策略', () => {
    const sw = read('public/sw.js');
    expect(sw).toContain("CACHE_NAME = 'daily-notes-pwa-v3'");
    expect(sw).toContain("'/offline'");
    expect(sw).toContain('caches.match');
    expect(sw).toContain('fetch(event.request)');
  });

  it('layout 仍然声明 PWA 元数据', () => {
    const layout = read('src/app/layout.tsx');
    expect(layout).toContain('appleWebApp');
    expect(layout).toContain('site.webmanifest');
    expect(layout).toContain('ServiceWorkerRegistrar');
  });
});
