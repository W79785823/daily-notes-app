import { describe, expect, it } from 'vitest';
import { canActOnTask, taskVisibilityWhere, type AuthUser, type TaskAccessTarget } from '../src/lib/auth';

const admin: AuthUser = { id: 'u-admin', role: 'ADMIN', permissions: [], active: true };
const viewer: AuthUser = { id: 'u-viewer', role: 'MEMBER', permissions: ['task.view_all'], active: true };
const alice: AuthUser = { id: 'u-alice', role: 'MEMBER', permissions: [], active: true };
const bob: AuthUser = { id: 'u-bob', role: 'MEMBER', permissions: [], active: true };

function task(overrides: Partial<TaskAccessTarget>): TaskAccessTarget {
  return {
    creatorId: alice.id,
    assigneeId: alice.id,
    teamVisible: false,
    deletedAt: null,
    ...overrides,
  };
}

describe('事项权限 API 规则回归', () => {
  it('查看团队事项权限只扩展 teamVisible 事项，不暴露别人自建自派的私密事项', () => {
    const privateSelfAssigned = task({ creatorId: alice.id, assigneeId: alice.id, teamVisible: false });
    const teamAssigned = task({ creatorId: alice.id, assigneeId: bob.id, teamVisible: true });

    expect(canActOnTask(viewer, privateSelfAssigned, 'view')).toBe(false);
    expect(canActOnTask(viewer, teamAssigned, 'view')).toBe(true);
    expect(canActOnTask(admin, privateSelfAssigned, 'view')).toBe(false);
    expect(canActOnTask(admin, teamAssigned, 'view')).toBe(true);
  });

  it('管理员可删除所有事项，但不能编辑或完成别人负责的事项', () => {
    const memberTask = task({ creatorId: alice.id, assigneeId: bob.id, teamVisible: true });

    expect(canActOnTask(admin, memberTask, 'delete')).toBe(true);
    expect(canActOnTask(admin, memberTask, 'edit')).toBe(false);
    expect(canActOnTask(admin, memberTask, 'complete')).toBe(false);
  });

  it('任务查询条件不会让查看团队事项权限退化成查看全部私密事项', () => {
    expect(taskVisibilityWhere(viewer)).toEqual({
      OR: [{ creatorId: viewer.id }, { assigneeId: viewer.id }, { teamVisible: true }],
    });
  });
});
