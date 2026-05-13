import type { Permission, Role } from './permissions';

export type UserStatus = 'APPROVED' | 'PENDING';

export type User = {
  openid: string;
  name: string;
  role: Role;
  permissions: Permission[];
  active: boolean;
  status: UserStatus;
};

export function createLoginUser(openid: string, adminOpenIds: string[] = []): User {
  const isConfiguredAdmin = adminOpenIds.includes(openid);
  return {
    openid,
    name: isConfiguredAdmin ? '管理员' : `待审核成员${String(openid).slice(-4)}`,
    role: isConfiguredAdmin ? 'ADMIN' : 'MEMBER',
    permissions: [],
    active: isConfiguredAdmin,
    status: isConfiguredAdmin ? 'APPROVED' : 'PENDING',
  };
}

export function loginStatusForUser(user: Pick<User, 'active' | 'status'>): { allowed: true } | { allowed: false; reason: string } {
  if (user.status === 'PENDING' || !user.active) return { allowed: false, reason: '账号待管理员审核' };
  return { allowed: true };
}
