import { describe, expect, it } from 'vitest';
import { createLoginUser, loginStatusForUser, type User } from '../src/lib/login-policy';

describe('小程序登录准入策略', () => {
  it('配置在 openid 白名单中的微信用户自动成为管理员并启用', () => {
    const user = createLoginUser('openid-admin', ['openid-admin']);

    expect(user.name).toBe('管理员');
    expect(user.role).toBe('ADMIN');
    expect(user.active).toBe(true);
    expect(user.status).toBe('APPROVED');
  });

  it('未配置白名单的首个陌生微信用户也默认进入待审核状态', () => {
    const user = createLoginUser('openid-new', []);

    expect(user.role).toBe('MEMBER');
    expect(user.active).toBe(false);
    expect(user.status).toBe('PENDING');
  });

  it('待审核用户不能进入业务页', () => {
    const user: User = { openid: 'openid-new', name: '成员-new', role: 'MEMBER', permissions: [], active: false, status: 'PENDING' };

    expect(loginStatusForUser(user)).toEqual({ allowed: false, reason: '账号待管理员审核' });
  });

  it('已启用用户可以进入业务页', () => {
    const user: User = { openid: 'openid-ok', name: '张三', role: 'MEMBER', permissions: [], active: true, status: 'APPROVED' };

    expect(loginStatusForUser(user)).toEqual({ allowed: true });
  });
});
