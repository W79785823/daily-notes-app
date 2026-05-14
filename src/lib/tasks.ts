import { can, effectivePermissions, type Permission, type Role } from './permissions';
import { canActOnTask as canUserActOnTask } from './auth';

export type User = {
  id: string;
  name: string;
  role: Role;
  permissions: Permission[];
  active: boolean;
};

export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type Task = {
  id: string;
  title: string;
  note: string | null;
  priority: TaskPriority;
  date: string;
  creatorId: string;
  assigneeId: string;
  teamVisible?: boolean | null;
  completedAt: Date | null;
  completedById: string | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateTaskInput = {
  title: string;
  note?: string | null;
  priority?: TaskPriority;
  date: string;
  creator: User;
  assigneeId: string;
};

export type EditTaskInput = {
  title?: string;
  note?: string | null;
  priority?: TaskPriority;
  date?: string;
  assigneeId?: string;
};

let sequence = 0;

function nextId(): string {
  sequence += 1;
  return `task-${sequence}`;
}

export function userPermissions(user: User): Permission[] {
  return effectivePermissions(user.role, user.permissions);
}

export function createTask(input: CreateTaskInput): Task {
  if (!input.creator.active) {
    throw new Error('用户已停用');
  }
  if (!can(userPermissions(input.creator), 'task.create')) {
    throw new Error('没有权限创建事项');
  }
  if (input.assigneeId !== input.creator.id && !can(userPermissions(input.creator), 'task.assign')) {
    throw new Error('没有权限指派给他人');
  }

  const now = new Date();
  return {
    id: nextId(),
    title: input.title.trim(),
    note: input.note?.trim() || null,
    priority: input.priority || 'NORMAL',
    date: input.date,
    creatorId: input.creator.id,
    assigneeId: input.assigneeId,
    teamVisible: input.assigneeId !== input.creator.id,
    completedAt: null,
    completedById: null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function canActOnTask(user: User, task: Task, action: 'view' | 'edit' | 'delete' | 'complete'): boolean {
  return canUserActOnTask(user, task, action);
}

export function listVisibleTasks(tasks: Task[], user: User, date?: string): Task[] {
  return tasks.filter((task) => !task.deletedAt && (!date || task.date === date) && canActOnTask(user, task, 'view'));
}

export function completeTask(task: Task, user: User, completedAt = new Date()): Task {
  if (!canActOnTask(user, task, 'complete')) {
    throw new Error('没有权限完成该事项');
  }
  return {
    ...task,
    completedAt,
    completedById: user.id,
    updatedAt: completedAt,
  };
}

export function editTask(task: Task, user: User, input: EditTaskInput, updatedAt = new Date()): Task {
  if (!canActOnTask(user, task, 'edit')) {
    throw new Error('没有权限编辑该事项');
  }
  if (input.assigneeId && input.assigneeId !== task.assigneeId && input.assigneeId !== user.id && !can(userPermissions(user), 'task.assign')) {
    throw new Error('没有权限指派给他人');
  }

  const next: Task = { ...task, updatedAt };
  if (input.title !== undefined) {
    const title = input.title.trim();
    if (!title) throw new Error('事项标题不能为空');
    next.title = title;
  }
  if (input.note !== undefined) next.note = input.note?.trim() || null;
  if (input.priority !== undefined) next.priority = input.priority;
  if (input.date !== undefined) {
    const date = input.date.trim();
    if (!date) throw new Error('日期不能为空');
    next.date = date;
  }
  if (input.assigneeId !== undefined) next.assigneeId = input.assigneeId;
  return next;
}

export function reopenTask(task: Task, user: User, updatedAt = new Date()): Task {
  if (!canActOnTask(user, task, 'complete')) {
    throw new Error('没有权限取消完成该事项');
  }
  return {
    ...task,
    completedAt: null,
    completedById: null,
    updatedAt,
  };
}
