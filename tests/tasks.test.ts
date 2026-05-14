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

  it('普通成员只能看到自己创建或负责的未删除事项', () => {
    const tasks: Task[] = [
      createTask({ title: '自己负责', date: '2026-05-11', creator: admin, assigneeId: alice.id }),
      createTask({ title: '自己创建', date: '2026-05-11', creator: bob, assigneeId: alice.id }),
      createTask({ title: '别人事项', date: '2026-05-11', creator: admin, assigneeId: bob.id }),
      { ...createTask({ title: '已删除', date: '2026-05-11', creator: alice, assigneeId: alice.id }), deletedAt: new Date('2026-05-11T01:00:00Z') },
    ];

    expect(listVisibleTasks(tasks, alice).map((task) => task.title)).toEqual(['自己负责', '自己创建']);
  });

  it('管理员可以看到所有未删除事项', () => {
    const tasks: Task[] = [
      createTask({ title: 'A', date: '2026-05-11', creator: alice, assigneeId: alice.id }),
      createTask({ title: 'B', date: '2026-05-11', creator: bob, assigneeId: bob.id }),
    ];

    expect(listVisibleTasks(tasks, admin)).toHaveLength(2);
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

  it('只给查看全部权限时，可以看全部，但只能编辑/删除自己创建的事项', () => {
    const viewer: User = { id: 'u-viewer', name: '查看员', role: 'MEMBER', permissions: ['task.view_all'], active: true };
    const ownTask = createTask({ title: '自己创建', date: '2026-05-11', creator: viewer, assigneeId: viewer.id });
    const otherTask = createTask({ title: '别人创建', date: '2026-05-11', creator: admin, assigneeId: admin.id });

    expect(canActOnTask(viewer, ownTask, 'view')).toBe(true);
    expect(canActOnTask(viewer, otherTask, 'view')).toBe(true);
    expect(canActOnTask(viewer, ownTask, 'edit')).toBe(true);
    expect(canActOnTask(viewer, ownTask, 'delete')).toBe(true);
    expect(canActOnTask(viewer, otherTask, 'edit')).toBe(false);
    expect(canActOnTask(viewer, otherTask, 'delete')).toBe(false);
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
