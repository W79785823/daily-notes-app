import { describe, expect, it } from 'vitest';
import { canActOnTask, createTask, completeTask, listVisibleTasks, type Task, type User } from '../src/lib/tasks';

describe('事项流程', () => {
  const admin: User = { id: 'u-admin', name: '管理员', role: 'ADMIN', permissions: [], active: true };
  const alice: User = { id: 'u-alice', name: '张三', role: 'MEMBER', permissions: [], active: true };
  const bob: User = { id: 'u-bob', name: '李四', role: 'MEMBER', permissions: ['task.assign'], active: true };

  it('创建事项时记录创建人、负责人、日期和未完成状态', () => {
    const task = createTask({
      title: '回访客户',
      note: '下午 3 点前',
      date: '2026-05-11',
      creator: alice,
      assigneeId: alice.id,
    });

    expect(task.title).toBe('回访客户');
    expect(task.priority).toBe('NORMAL');
    expect(task.creatorId).toBe(alice.id);
    expect(task.assigneeId).toBe(alice.id);
    expect(task.date).toBe('2026-05-11');
    expect(task.completedAt).toBeNull();
    expect(task.deletedAt).toBeNull();
  });

  it('创建事项时可以设置优先级，默认普通优先级', () => {
    const urgent = createTask({ title: '紧急打样', date: '2026-05-11', creator: bob, assigneeId: bob.id, priority: 'URGENT' });
    const normal = createTask({ title: '整理日报', date: '2026-05-11', creator: alice, assigneeId: alice.id });

    expect(urgent.priority).toBe('URGENT');
    expect(normal.priority).toBe('NORMAL');
  });

  it('普通成员只能看到自己创建、自己负责，或有查看团队事项权限时看到团队事项', () => {
    const teamTask = createTask({ title: '别人指派给自己', date: '2026-05-11', creator: admin, assigneeId: alice.id });
    const ownPrivateTask = createTask({ title: '自己给自己', date: '2026-05-11', creator: alice, assigneeId: alice.id });
    const bobPrivateTask = createTask({ title: '别人自己的私密事项', date: '2026-05-11', creator: bob, assigneeId: bob.id });
    const bobTeamTask = createTask({ title: '别人指派给团队成员', date: '2026-05-11', creator: bob, assigneeId: admin.id });
    const deletedTask = { ...createTask({ title: '已删除', date: '2026-05-11', creator: alice, assigneeId: alice.id }), deletedAt: new Date('2026-05-11T01:00:00Z') };
    const tasks: Task[] = [teamTask, ownPrivateTask, bobPrivateTask, bobTeamTask, deletedTask];
    const viewer: User = { id: 'u-viewer', name: '查看员', role: 'MEMBER', permissions: ['task.view_all'], active: true };

    expect(listVisibleTasks(tasks, alice).map((task) => task.title)).toEqual(['别人指派给自己', '自己给自己']);
    expect(listVisibleTasks(tasks, viewer).map((task) => task.title)).toEqual(['别人指派给自己', '别人指派给团队成员']);
  });

  it('管理员也只能额外看到团队事项，看不到别人自己指派自己的私密事项', () => {
    const tasks: Task[] = [
      createTask({ title: '张三私密', date: '2026-05-11', creator: alice, assigneeId: alice.id }),
      createTask({ title: '李四指派管理员', date: '2026-05-11', creator: bob, assigneeId: admin.id }),
      createTask({ title: '管理员私密', date: '2026-05-11', creator: admin, assigneeId: admin.id }),
    ];

    expect(listVisibleTasks(tasks, admin).map((task) => task.title)).toEqual(['李四指派管理员', '管理员私密']);
  });

  it('负责人可以标记自己的事项完成', () => {
    const task = createTask({ title: '写日报', date: '2026-05-11', creator: admin, assigneeId: alice.id });
    const completed = completeTask(task, alice, new Date('2026-05-11T09:00:00Z'));

    expect(completed.completedAt?.toISOString()).toBe('2026-05-11T09:00:00.000Z');
    expect(completed.completedById).toBe(alice.id);
  });

  it('没有 complete_other 权限的人不能完成别人的事项', () => {
    const task = createTask({ title: '别人负责', date: '2026-05-11', creator: admin, assigneeId: bob.id });

    expect(canActOnTask(alice, task, 'complete')).toBe(false);
    expect(() => completeTask(task, alice, new Date('2026-05-11T09:00:00Z'))).toThrow('没有权限完成该事项');
  });

  it('只给查看团队事项权限时，只能额外看到团队事项，不能看到别人自己指派自己的私密事项', () => {
    const viewer: User = { id: 'u-viewer', name: '查看员', role: 'MEMBER', permissions: ['task.view_all'], active: true };
    const ownTask = createTask({ title: '自己创建', date: '2026-05-11', creator: viewer, assigneeId: viewer.id });
    const otherPrivateTask = createTask({ title: '别人自己的私密事项', date: '2026-05-11', creator: admin, assigneeId: admin.id });
    const teamTask = createTask({ title: '别人指派给团队成员', date: '2026-05-11', creator: admin, assigneeId: alice.id });

    expect(canActOnTask(viewer, ownTask, 'view')).toBe(true);
    expect(canActOnTask(viewer, otherPrivateTask, 'view')).toBe(false);
    expect(canActOnTask(viewer, teamTask, 'view')).toBe(true);
    expect(canActOnTask(viewer, ownTask, 'edit')).toBe(true);
    expect(canActOnTask(viewer, ownTask, 'delete')).toBe(true);
    expect(canActOnTask(viewer, otherPrivateTask, 'edit')).toBe(false);
    expect(canActOnTask(viewer, otherPrivateTask, 'delete')).toBe(false);
  });

  it('管理员可以删除所有事项，但只能编辑自己创建、完成自己负责的事项', () => {
    const ownTask = createTask({ title: '管理员自己创建', date: '2026-05-11', creator: admin, assigneeId: admin.id });
    const memberTask = createTask({ title: '成员创建', date: '2026-05-11', creator: alice, assigneeId: alice.id });

    expect(canActOnTask(admin, ownTask, 'edit')).toBe(true);
    expect(canActOnTask(admin, ownTask, 'delete')).toBe(true);
    expect(canActOnTask(admin, ownTask, 'complete')).toBe(true);
    expect(canActOnTask(admin, memberTask, 'edit')).toBe(false);
    expect(canActOnTask(admin, memberTask, 'delete')).toBe(true);
    expect(canActOnTask(admin, memberTask, 'complete')).toBe(false);
  });
});
