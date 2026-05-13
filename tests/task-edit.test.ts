import { describe, expect, it } from 'vitest';
import { createTask, editTask, type User } from '../src/lib/tasks';

describe('事项编辑', () => {
  const admin: User = { id: 'u-admin', name: '管理员', role: 'ADMIN', permissions: [], active: true };
  const alice: User = { id: 'u-alice', name: '张三', role: 'MEMBER', permissions: [], active: true };
  const bob: User = { id: 'u-bob', name: '李四', role: 'MEMBER', permissions: ['task.assign'], active: true };

  it('创建人可以编辑自己创建的事项标题、备注和日期', () => {
    const task = createTask({ title: '原事项', note: '旧备注', date: '2026-05-11', creator: alice, assigneeId: alice.id });

    const edited = editTask(task, alice, { title: '新事项', note: '新备注', date: '2026-05-12' }, new Date('2026-05-11T10:00:00Z'));

    expect(edited.title).toBe('新事项');
    expect(edited.note).toBe('新备注');
    expect(edited.date).toBe('2026-05-12');
    expect(edited.updatedAt.toISOString()).toBe('2026-05-11T10:00:00.000Z');
  });

  it('没有 edit_all 权限的人不能编辑别人创建的事项', () => {
    const task = createTask({ title: '别人事项', date: '2026-05-11', creator: bob, assigneeId: alice.id });

    expect(() => editTask(task, alice, { title: '越权修改' })).toThrow('没有权限编辑该事项');
  });

  it('管理员可以改派事项负责人', () => {
    const task = createTask({ title: '需要改派', date: '2026-05-11', creator: alice, assigneeId: alice.id });

    const edited = editTask(task, admin, { assigneeId: bob.id });

    expect(edited.assigneeId).toBe(bob.id);
  });

  it('普通成员不能把事项改派给别人', () => {
    const task = createTask({ title: '自己的事项', date: '2026-05-11', creator: alice, assigneeId: alice.id });

    expect(() => editTask(task, alice, { assigneeId: bob.id })).toThrow('没有权限指派给他人');
  });
});
