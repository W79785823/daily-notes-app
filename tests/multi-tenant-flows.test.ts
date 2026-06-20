import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('多租户注册、邀请和超管流程', () => {
  it('注册接口会在事务中创建团队、owner、审计和登录态', () => {
    const route = read('src/app/api/auth/register/route.ts');

    expect(route).toContain('registerSchema');
    expect(route).toContain('prisma.$transaction');
    expect(route).toContain('tx.team.create');
    expect(route).toContain("role: 'ADMIN'");
    expect(route).toContain('tx.team.update');
    expect(route).toContain('createSessionToken(owner.id, owner.sessionVersion)');
  });

  it('邀请接口按当前团队创建和列出邀请码', () => {
    const route = read('src/app/api/invites/route.ts');

    expect(route).toContain('tenantDb(user.teamId)');
    expect(route).toContain('randomBytes');
    expect(route).toContain('sanitizeAssignablePermissions');
    expect(route).toContain('join/${invite.code}');
  });

  it('接受邀请会校验邀请码并在目标团队创建成员', () => {
    const route = read('src/app/api/invites/[code]/accept/route.ts');
    const page = read('src/app/join/[code]/page.tsx');

    expect(page).toContain('include: { team: true }');
    expect(page).toContain('usedCount');
    expect(route).toContain('prisma.$transaction');
    expect(route).toContain('teamId: invite.teamId');
    expect(route).toContain('updateMany');
    expect(route).toContain('usedCount: { lt: invite.maxUses }');
    expect(route).toContain('createSessionToken(user.id, user.sessionVersion)');
  });

  it('超管入口和接口只允许 getSuperAdmin 并写审计', () => {
    const lib = read('src/lib/super-admin.ts');
    const adminPage = read('src/app/admin/page.tsx');
    const teamsRoute = read('src/app/api/admin/teams/route.ts');
    const suspendRoute = read('src/app/api/admin/teams/[id]/suspend/route.ts');
    const resetRoute = read('src/app/api/admin/users/[id]/reset-password/route.ts');

    expect(lib).toContain('getSuperAdmin');
    expect(adminPage).toContain("redirect('/login?error=auth.required&redirectTo=/admin')");
    expect(adminPage).toContain('isSessionFreshForUser(session, currentUser.sessionVersion)');
    expect(adminPage).toContain('负责人：');
    expect(adminPage).not.toContain('admin.teams.view');
    expect(teamsRoute).toContain('getSuperAdmin');
    expect(teamsRoute).toContain('owner');
    expect(teamsRoute).not.toContain('admin.teams.view');
    expect(suspendRoute).toContain('getSuperAdmin');
    expect(suspendRoute).toContain('auditLog.create');
    expect(resetRoute).toContain('getSuperAdmin');
    expect(resetRoute).toContain('sessionVersion: { increment: 1 }');
    expect(resetRoute).toContain('auditLog.create');
  });

  it('登录页和登录接口支持注册入口、团队停用和超管跳转', () => {
    const loginPage = read('src/app/login/page.tsx');
    const registerPage = read('src/app/register/page.tsx');
    const loginRoute = read('src/app/api/auth/login/route.ts');

    expect(loginPage).toContain('href="/register"');
    expect(loginPage).toContain('isSessionFreshForUser(session, user.sessionVersion)');
    expect(loginPage).toContain('user.team.active');
    expect(registerPage).toContain('isSessionFreshForUser(session, user.sessionVersion)');
    expect(registerPage).toContain('user.team.active');
    expect(loginRoute).toContain('include: { team: true }');
    expect(loginRoute).toContain('auth.team_suspended');
    expect(loginRoute).toContain("user.isSuperAdmin ? '/admin' : '/'");
  });
});
