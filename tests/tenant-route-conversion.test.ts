import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root = path.join(__dirname, '..');
const read = (file: string) => fs.readFileSync(path.join(root, file), 'utf8');

describe('现有读写入口切换到租户隔离', () => {
  it('任务列表和创建接口使用 tenantDb', () => {
    const route = read('src/app/api/tasks/route.ts');

    expect(route).toContain("import { tenantDb } from '@/lib/tenant';");
    expect(route).toContain('const db = tenantDb(user.teamId)');
    expect(route).toContain('db.task.findMany');
    expect(route).toContain('db.task.create');
    expect(route).toContain('db.auditLog.create');
  });

  it('按 id 修改/删除/完成任务会校验同团队', () => {
    const route = read('src/app/api/tasks/[id]/route.ts');
    const complete = read('src/app/api/tasks/[id]/complete/route.ts');

    expect(route).toContain('assertSameTeam');
    expect(route).toContain('tenantDb(user.teamId)');
    expect(complete).toContain('assertSameTeam');
    expect(complete).toContain('tenantDb(user.teamId)');
  });

  it('创建和改派事项时会校验负责人属于当前团队', () => {
    const createRoute = read('src/app/api/tasks/route.ts');
    const updateRoute = read('src/app/api/tasks/[id]/route.ts');

    expect(createRoute).toContain('db.user.findFirst');
    expect(createRoute).toContain('task.assignee.not_found');
    expect(updateRoute).toContain('db.user.findFirst');
    expect(updateRoute).toContain('task.assignee.not_found');
  });

  it('公告、用户和日历接口使用 tenantDb 或 assertSameTeam', () => {
    const announcements = read('src/app/api/announcements/route.ts');
    const announcementById = read('src/app/api/announcements/[id]/route.ts');
    const users = read('src/app/api/users/route.ts');
    const userStatus = read('src/app/api/users/[id]/status/route.ts');
    const reset = read('src/app/api/users/[id]/reset-password/route.ts');
    const calendar = read('src/app/api/calendar/route.ts');

    expect(announcements).toContain('tenantDb(user.teamId)');
    expect(announcementById).toContain('assertSameTeam');
    expect(users).toContain('tenantDb(user.teamId)');
    expect(userStatus).toContain('assertSameTeam');
    expect(reset).toContain('assertSameTeam');
    expect(calendar).toContain('tenantDb(user.teamId)');
  });

  it('服务端页面和 seed 逻辑按团队隔离', () => {
    const home = read('src/app/page.tsx');
    const manage = read('src/app/manage/page.tsx');
    const api = read('src/lib/api.ts');

    expect(home).toContain("redirect('/admin')");
    expect(home).toContain('tenantDb(currentUser.teamId)');
    expect(manage).toContain('tenantDb(currentUser.teamId)');
    expect(api).not.toContain("where: { name: '管理员' }");
    expect(api).toContain('team.create');
    expect(api).toContain('teamId: team.id');
  });
});
