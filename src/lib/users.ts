import { canManageUsers } from './auth';
import type { Permission, Role } from './permissions';

export type User = {
  id: string;
  openid: string | null;
  name: string;
  role: Role;
  permissions: Permission[];
  active: boolean;
  createdAt?: Date;
  updatedAt?: Date;
};

export type CreateUserInput = {
  name: string;
  role?: Role;
  permissions?: Permission[];
};

export type UpdateUserInput = {
  name?: string;
  role?: Role;
  permissions?: Permission[];
  active?: boolean;
};

let sequence = 0;

function nextId(): string {
  sequence += 1;
  return `user-${sequence}`;
}

function assertCanManage(actor: User): void {
  if (!canManageUsers(actor)) throw new Error('没有权限管理人员');
}

function normalizeRole(role: Role | undefined): Role {
  return role && ['MEMBER', 'COLLABORATOR', 'ADMIN'].includes(role) ? role : 'MEMBER';
}

function cleanPermissions(permissions: Permission[] | undefined): Permission[] {
  return Array.isArray(permissions) ? [...new Set(permissions)] : [];
}

export function createUser(actor: User, input: CreateUserInput, now = new Date()): User {
  assertCanManage(actor);
  const name = input.name.trim();
  if (!name) throw new Error('姓名不能为空');
  return {
    id: nextId(),
    openid: null,
    name,
    role: normalizeRole(input.role),
    permissions: cleanPermissions(input.permissions),
    active: true,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateUser(actor: User, target: User, input: UpdateUserInput, now = new Date()): User {
  assertCanManage(actor);
  const next: User = { ...target, updatedAt: now };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error('姓名不能为空');
    next.name = name;
  }
  if (input.role !== undefined) next.role = normalizeRole(input.role);
  if (input.permissions !== undefined) next.permissions = cleanPermissions(input.permissions);
  if (input.active !== undefined) next.active = Boolean(input.active);
  return next;
}

export function disableUser(actor: User, target: User, now = new Date()): User {
  return updateUser(actor, target, { active: false }, now);
}

export function enableUser(actor: User, target: User, now = new Date()): User {
  return updateUser(actor, target, { active: true }, now);
}

export function bindWechat(target: User, openid: string, now = new Date()): User {
  if (!openid) throw new Error('微信 openid 不能为空');
  if (target.openid && target.openid !== openid) throw new Error('该人员已绑定微信');
  return { ...target, openid, updatedAt: now };
}

export function unbindWechat(actor: User, target: User, now = new Date()): User {
  assertCanManage(actor);
  return { ...target, openid: null, updatedAt: now };
}
