import { can, effectivePermissions, type Permission, type Role, ALL_PERMISSIONS } from './permissions';

export type AuthUser = {
  id: string;
  role: Role;
  permissions: string[];
  active: boolean;
};

export type TaskAccessTarget = {
  creatorId: string;
  assigneeId: string;
  teamVisible?: boolean | null;
  deletedAt?: Date | string | null;
};

export function userPermissions(user: Pick<AuthUser, 'role' | 'permissions'>): Permission[] {
  return effectivePermissions(user.role, user.permissions as Permission[]);
}

export function hasPermission(user: Pick<AuthUser, 'role' | 'permissions'> | null | undefined, permission: Permission): boolean {
  if (!user) return false;
  return can(userPermissions(user), permission);
}

export function canActOnTask(user: AuthUser | null | undefined, task: TaskAccessTarget, action: 'view' | 'edit' | 'delete' | 'complete'): boolean {
  if (!user || !user.active || task.deletedAt) return false;

  switch (action) {
    case 'view':
      return hasPermission(user, 'task.view_all') || !!task.teamVisible || task.creatorId === user.id || task.assigneeId === user.id;
    case 'edit':
      return task.creatorId === user.id;
    case 'delete':
      return task.creatorId === user.id;
    case 'complete':
      return task.assigneeId === user.id || hasPermission(user, 'task.complete_other');
  }
}

export function canCreateTask(user: AuthUser | null | undefined): boolean {
  return !!user?.active && hasPermission(user, 'task.create');
}

export function canAssignTask(user: AuthUser | null | undefined, assigneeId: string): boolean {
  return !!user?.active && (assigneeId === user.id || hasPermission(user, 'task.assign'));
}

export function canCreateAnnouncement(user: AuthUser | null | undefined): boolean {
  return !!user?.active && hasPermission(user, 'announcement.create');
}

export type AnnouncementAccessTarget = {
  authorId: string;
  deletedAt?: Date | string | null;
};

export function canDeleteAnnouncement(user: AuthUser | null | undefined, announcement: AnnouncementAccessTarget): boolean {
  if (!user || !user.active || announcement.deletedAt) return false;
  return hasPermission(user, 'announcement.create') || announcement.authorId === user.id;
}

export function canManageUsers(user: AuthUser | null | undefined): boolean {
  return !!user?.active && hasPermission(user, 'user.manage');
}

export function canManagePermissions(user: AuthUser | null | undefined): boolean {
  return !!user?.active && hasPermission(user, 'permission.manage');
}

export function sanitizeAssignablePermissions(operator: AuthUser | null | undefined, permissions: unknown): Permission[] {
  if (!canManagePermissions(operator) || !Array.isArray(permissions)) return [];
  return [...new Set(permissions.filter((permission): permission is Permission => ALL_PERMISSIONS.includes(permission as Permission)))];
}

export function taskVisibilityWhere(user: AuthUser | null | undefined) {
  if (!user) return { id: '__no_user__' };
  if (hasPermission(user, 'task.view_all')) return {};
  return { OR: [{ teamVisible: true }, { creatorId: user.id }, { assigneeId: user.id }] };
}
