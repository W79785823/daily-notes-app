import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('management navigation links', () => {
  it('keeps desktop home management entry separate from calendar rendering', () => {
    const hero = read('src/components/home-hero.tsx');
    const page = read('src/app/page.tsx');

    expect(hero).toContain('manageHeroLink');
    expect(hero).toContain("{canManageUsers ? '管理中心' : '账号设置'}");
    expect(page).toContain('canManageUsers={currentUserCanManageUsers}');
    expect(page).toContain('<WorkCalendar');
    expect(page.lastIndexOf('{!isPlainMember &&', page.indexOf('<WorkCalendar'))).toBe(-1);
  });

  it('shows a return-to-today link in manage center hero', () => {
    const managePanels = read('src/components/manage-panels.tsx');
    const manageHeroSource = managePanels.slice(
      managePanels.indexOf('export function ManageHero'),
      managePanels.indexOf('export function TeamOverview'),
    );

    expect(manageHeroSource).toContain('返回今日事项');
    expect(manageHeroSource).toContain('href="/"');
    expect(manageHeroSource).not.toContain('/api/auth/logout');
  });
});
