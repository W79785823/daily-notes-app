import { describe, expect, it } from 'vitest';
import { can, defaultPermissionsForRole, type Permission, type Role } from '../src/lib/permissions';

describe('权限模型', () => {
  it('普通成员只能创建/查看自己相关/完成自己负责/编辑自己创建的事项', () => {
    const permissions = defaultPermissionsForRole('MEMBER');

    expect(can(permissions, 'task.create')).toBe(true);
    expect(can(permissions, 'task.view_all')).toBe(false);
    expect(can(permissions, 'task.assign')).toBe(false);
    expect(can(permissions, 'user.manage')).toBe(false);
  });


  it('管理员拥有全部权限点', () => {
    const permissions = defaultPermissionsForRole('ADMIN');
    const all: Permission[] = ['task.create', 'task.assign', 'task.view_all', 'task.edit_all', 'task.delete', 'task.complete_other', 'announcement.create', 'user.manage', 'permission.manage'];

    expect(all.every((permission) => can(permissions, permission))).toBe(true);
  });

  it('支持管理员给用户追加单独权限', () => {
    const base = defaultPermissionsForRole('MEMBER');
    const extra: Permission[] = ['task.assign'];

    expect(can([...base, ...extra], 'task.assign')).toBe(true);
  });
});
