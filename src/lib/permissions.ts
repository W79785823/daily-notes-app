export type Role = 'MEMBER' | 'ADMIN';

export type Permission =
  | 'task.create'
  | 'task.assign'
  | 'task.view_all'
  | 'task.complete_other'
  | 'announcement.create'
  | 'user.manage'
  | 'permission.manage';

export const ALL_PERMISSIONS: Permission[] = [
  'task.create',
  'task.assign',
  'task.view_all',
  'task.complete_other',
  'announcement.create',
  'user.manage',
  'permission.manage',
];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  MEMBER: ['task.create'],
  ADMIN: ALL_PERMISSIONS,
};

export function defaultPermissionsForRole(role: Role): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function uniquePermissions(permissions: Permission[]): Permission[] {
  return [...new Set(permissions)];
}

export function effectivePermissions(role: Role, extraPermissions: Permission[] = []): Permission[] {
  return uniquePermissions([...defaultPermissionsForRole(role), ...extraPermissions]);
}

export function can(permissions: Permission[], permission: Permission): boolean {
  return permissions.includes(permission);
}
