import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const statusRoute = readFileSync('src/app/api/users/[id]/status/route.ts', 'utf8');
const resetRoute = readFileSync('src/app/api/users/[id]/reset-password/route.ts', 'utf8');
const panels = readFileSync('src/components/manage-panels.tsx', 'utf8');

describe('protected admin cannot be changed through management tools', () => {
  it('protects admin rows before normal member update logic', () => {
    expect(panels).toContain("const isProtectedAdmin = user.role === 'ADMIN'");
    expect(panels).toContain('isCurrentUser || isProtectedAdmin');
    expect(panels).toContain('团队负责人账号受保护');
    expect(panels).toContain('每个团队只保留当前负责人为管理员');
  });

  it('rejects status/role/permission changes against the admin target', () => {
    expect(statusRoute).toContain('operator.id === target.id');
    expect(statusRoute).toContain("target.role === 'ADMIN'");
    expect(statusRoute).toContain('user.admin_protected.forbidden');
    expect(statusRoute.indexOf("target.role === 'ADMIN'")).toBeLessThan(statusRoute.indexOf('const active = payload.data.active !== false'));
  });

  it('rejects password resets against the admin target', () => {
    expect(resetRoute).toContain("target.role === 'ADMIN'");
    expect(resetRoute).toContain('user.admin_protected.forbidden');
    expect(resetRoute.indexOf("target.role === 'ADMIN'")).toBeLessThan(resetRoute.indexOf('await db.user.update'));
  });

  it('converts duplicate-name database errors into a user-facing response', () => {
    expect(statusRoute).toContain("error.code === 'P2002'");
    expect(statusRoute).toContain('user.duplicate.forbidden');
  });
});
