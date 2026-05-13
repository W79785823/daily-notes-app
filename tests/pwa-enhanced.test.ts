import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file: string) => fs.existsSync(path.join(root, file));

describe('PWA 图标与安装体验增强', () => {
  it('包含正式位图图标', () => {
    expect(exists('public/icon-192.png')).toBe(true);
    expect(exists('public/icon-512.png')).toBe(true);
    expect(exists('public/apple-touch-icon.png')).toBe(true);
    expect(read('public/site.webmanifest')).toContain('/icon-192.png');
    expect(read('public/site.webmanifest')).toContain('/apple-touch-icon.png');
  });

  it('安装横幅包含 iPhone 引导与已安装识别', () => {
    const banner = read('src/components/pwa-install-banner.tsx');
    expect(banner).toContain('添加到主屏幕');
    expect(banner).toContain('display-mode: standalone');
    expect(banner).toContain('appinstalled');
  });

  it('service worker 升级到 v3 并缓存更多图标资源', () => {
    const sw = read('public/sw.js');
    expect(sw).toContain("CACHE_NAME = 'daily-notes-pwa-v3'");
    expect(sw).toContain('/icon-192.png');
    expect(sw).toContain('/apple-touch-icon.png');
    expect(sw).toContain('isStaticAsset');
  });
});
