import { describe, expect, it, vi } from 'vitest';

const findUnique = vi.fn();

vi.mock('../src/lib/db', () => ({
  prisma: {
    user: {
      findUnique,
    },
  },
}));

describe('租户会话校验', () => {
  it('普通用户所属团队停用后会话无效', async () => {
    vi.resetModules();
    process.env.SESSION_SECRET = 'test-session-secret-for-vitest';
    const { createSessionToken, getRequestUser } = await import('../src/lib/session');
    const token = createSessionToken('u-1', 0);
    findUnique.mockResolvedValueOnce({
      id: 'u-1',
      active: true,
      sessionVersion: 0,
      isSuperAdmin: false,
      team: { id: 'team-a', active: false },
    });

    const request = new Request('http://localhost/api/tasks', {
      headers: { authorization: `Bearer ${token}` },
    });

    await expect(getRequestUser(request as never)).resolves.toBeNull();
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'u-1' }, include: { team: true } });
  });

  it('超管不受团队停用规则影响', async () => {
    vi.resetModules();
    process.env.SESSION_SECRET = 'test-session-secret-for-vitest';
    const { createSessionToken, getRequestUser } = await import('../src/lib/session');
    const token = createSessionToken('super-1', 0);
    const superAdmin = {
      id: 'super-1',
      active: true,
      sessionVersion: 0,
      isSuperAdmin: true,
      team: null,
    };
    findUnique.mockResolvedValueOnce(superAdmin);

    const request = new Request('http://localhost/api/tasks', {
      headers: { authorization: `Bearer ${token}` },
    });

    await expect(getRequestUser(request as never)).resolves.toEqual(superAdmin);
  });
});
