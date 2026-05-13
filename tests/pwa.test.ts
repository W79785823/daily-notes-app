import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('PWA 安装支持', () => {
  it('包含 manifest、service worker 和图标资源', () => {
    expect(fs.existsSync(path.join(root, 'public/site.webmanifest'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'public/sw.js'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'public/icon.svg'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'src/app/offline/page.tsx'))).toBe(true);
  });

  it('layout 注入了 PWA 元信息并注册 service worker', () => {
    const layout = read('src/app/layout.tsx');
    const registrar = read('src/components/service-worker-registrar.tsx');
    const manifest = read('public/site.webmanifest');

    expect(layout).toContain("manifest: '/site.webmanifest'");
    expect(layout).toContain('appleWebApp');
    expect(layout).toContain('ServiceWorkerRegistrar');
    expect(registrar).toContain("register('/sw.js')");
    expect(manifest).toContain('standalone');
    expect(manifest).toContain('maskable');
  });
});
