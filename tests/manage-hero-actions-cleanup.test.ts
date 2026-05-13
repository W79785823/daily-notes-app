import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const managePanels = fs.readFileSync(path.join(root, 'src/components/manage-panels.tsx'), 'utf8');

describe('manage hero actions cleanup', () => {
  it('shows a safe return-to-today link without putting logout inside manage center hero', () => {
    const manageHeroSource = managePanels.slice(
      managePanels.indexOf('export function ManageHero'),
      managePanels.indexOf('export function TeamOverview'),
    );

    expect(manageHeroSource).toContain('返回今日事项');
    expect(manageHeroSource).toContain('href="/"');
    expect(manageHeroSource).not.toContain('退出登录');
    expect(manageHeroSource).not.toContain('manageHeroActions');
    expect(manageHeroSource).not.toContain('/api/auth/logout');
  });
});
