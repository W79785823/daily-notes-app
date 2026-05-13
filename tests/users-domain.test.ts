import { describe, expect, it } from 'vitest';
import { bindWechat, createUser, disableUser, updateUser, type User } from '../src/lib/users';

describe('人员管理', () => {
  const admin: User = { id: 'u-admin', openid: 'openid-admin', name: '管理员', role: 'ADMIN', permissions: [], active: true };
  const alice: User = { id: 'u-alice', openid: null, name: '张三', role: 'MEMBER', permissions: [], active: true };

  it('管理员创建人员时默认收敛为普通成员', () => {
    const created = createUser(admin, { name: '李四', role: 'MEMBER' });

    expect(created.name).toBe('李四');
    expect(created.role).toBe('MEMBER');
    expect(created.openid).toBeNull();
    expect(created.active).toBe(true);
  });

  it('管理员可以修改人员姓名和额外权限，身份保持普通成员', () => {
    const updated = updateUser(admin, alice, { name: '张三丰', role: 'MEMBER', permissions: ['task.assign'] });

    expect(updated.name).toBe('张三丰');
    expect(updated.role).toBe('MEMBER');
    expect(updated.permissions).toEqual(['task.assign']);
  });

  it('管理员可以停用人员', () => {
    const disabled = disableUser(admin, alice);

    expect(disabled.active).toBe(false);
  });

  it('用户只能把当前微信绑定到未绑定人员', () => {
    const bound = bindWechat(alice, 'openid-alice');

    expect(bound.openid).toBe('openid-alice');
  });

  it('已经绑定微信的人员不能重复绑定其他 openid', () => {
    expect(() => bindWechat({ ...alice, openid: 'old-openid' }, 'new-openid')).toThrow('该人员已绑定微信');
  });
});
