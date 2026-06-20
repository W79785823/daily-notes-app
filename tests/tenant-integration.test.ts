import { describe, expect, it } from 'vitest';
import { prisma } from '../src/lib/db';
import { tenantDb, assertSameTeam } from '../src/lib/tenant';

const runIfDatabase = process.env.DATABASE_URL ? describe : describe.skip;

runIfDatabase('租户隔离数据库集成验证', () => {
  it('tenantDb(teamA).task.findMany 不会返回 teamB 的事项', async () => {
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const teamA = await prisma.team.create({ data: { name: `tenant-a-${suffix}` } });
    const teamB = await prisma.team.create({ data: { name: `tenant-b-${suffix}` } });
    const userA = await prisma.user.create({ data: { teamId: teamA.id, name: '成员A', loginName: `a-${suffix}`, role: 'ADMIN', active: true } });
    const userB = await prisma.user.create({ data: { teamId: teamB.id, name: '成员B', loginName: `b-${suffix}`, role: 'ADMIN', active: true } });
    await prisma.team.update({ where: { id: teamA.id }, data: { ownerId: userA.id } });
    await prisma.team.update({ where: { id: teamB.id }, data: { ownerId: userB.id } });

    try {
      const taskA = await prisma.task.create({ data: { teamId: teamA.id, title: 'A 事项', date: '2026-06-18', creatorId: userA.id, assigneeId: userA.id } });
      const taskB = await prisma.task.create({ data: { teamId: teamB.id, title: 'B 事项', date: '2026-06-18', creatorId: userB.id, assigneeId: userB.id } });

      const visibleToA = await tenantDb(teamA.id).task.findMany({ where: { deletedAt: null }, orderBy: { title: 'asc' } });

      expect(visibleToA.map((task) => task.id)).toEqual([taskA.id]);
      expect(assertSameTeam(taskB, teamA.id)).toBe(false);
    } finally {
      await prisma.task.deleteMany({ where: { teamId: { in: [teamA.id, teamB.id] } } });
      await prisma.user.deleteMany({ where: { teamId: { in: [teamA.id, teamB.id] } } });
      await prisma.team.deleteMany({ where: { id: { in: [teamA.id, teamB.id] } } });
    }
  });
});
