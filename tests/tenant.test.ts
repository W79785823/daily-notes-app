import { describe, expect, it } from 'vitest';
import { applyTenantScope, assertSameTeam } from '../src/lib/tenant';

describe('租户隔离 helper', () => {
  it('集合查询会自动合并 teamId 条件', () => {
    const args = applyTenantScope('Task', 'findMany', { where: { deletedAt: null } }, 'team-a');

    expect(args).toEqual({ where: { deletedAt: null, teamId: 'team-a' } });
  });

  it('创建数据时会自动写入 teamId', () => {
    const args = applyTenantScope('Announcement', 'create', { data: { title: '公告' } }, 'team-a');

    expect(args).toEqual({ data: { title: '公告', teamId: 'team-a' } });
  });

  it('批量创建数组时每条数据都会写入 teamId', () => {
    const args = applyTenantScope('Task', 'createMany', { data: [{ title: 'A' }, { title: 'B', teamId: 'wrong' }] }, 'team-a');

    expect(args).toEqual({ data: [{ title: 'A', teamId: 'team-a' }, { title: 'B', teamId: 'team-a' }] });
  });

  it('按唯一 id 的操作不注入 teamId，交给 assertSameTeam 兜底', () => {
    const args = applyTenantScope('Task', 'findUnique', { where: { id: 'task-1' } }, 'team-a');

    expect(args).toEqual({ where: { id: 'task-1' } });
    expect(assertSameTeam({ teamId: 'team-a' }, 'team-a')).toBe(true);
    expect(assertSameTeam({ teamId: 'team-b' }, 'team-a')).toBe(false);
    expect(assertSameTeam(null, 'team-a')).toBe(false);
  });
});
