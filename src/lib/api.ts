import { z } from 'zod';
import { prisma } from './db';
import { ALL_PERMISSIONS, defaultPermissionsForRole, type Permission } from './permissions';
import { hasPermission } from './auth';
import { hashPassword } from './password';
import { getRequestUser } from './session';
import { beijingDateKey } from './beijing-date';

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'] as const;

export const taskSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(100),
  note: z.string().max(1000).optional().nullable(),
  priority: z.enum(PRIORITIES).default('NORMAL'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  assigneeId: z.string().min(1),
});

export const userSchema = z.object({
  name: z.string().min(1, '姓名不能为空').max(50),
  loginName: z.string().min(2, '账号至少 2 个字符').max(40).regex(/^[a-zA-Z0-9._-]+$/, '账号只能使用字母、数字、点、横线和下划线').optional().or(z.literal('')),
  password: z.string().min(4, '密码至少 4 个字符').max(80).optional().or(z.literal('')),
  role: z.enum(['MEMBER', 'ADMIN']),
  permissions: z.array(z.enum(ALL_PERMISSIONS as [Permission, ...Permission[]])).default([]),
  active: z.boolean().default(true),
}).transform(({ password, loginName, ...data }) => ({
  ...data,
  loginName: loginName || null,
  passwordHash: password ? hashPassword(password) : null,
}));

export async function getCurrentUser(userId?: string | null) {
  const id = userId || process.env.DEMO_USER_ID;
  if (id) {
    const user = await prisma.user.findUnique({ where: { id }, include: { team: true } });
    if (user) return user;
  }

  return null;
}

export async function seedIfEmpty() {
  const count = await prisma.user.count();
  if (count > 0) return;
  const team = await prisma.team.create({ data: { name: '默认团队' } });
  const admin = await prisma.user.create({ data: { teamId: team.id, name: '管理员', loginName: 'admin', passwordHash: hashPassword('admin123'), role: 'ADMIN', permissions: [], active: true } });
  await prisma.team.update({ where: { id: team.id }, data: { ownerId: admin.id } });
  const zhang = await prisma.user.create({ data: { teamId: team.id, name: '张三', role: 'MEMBER', permissions: [], active: true } });
  const li = await prisma.user.create({ data: { teamId: team.id, name: '李四', role: 'MEMBER', permissions: [], active: true } });
  await prisma.task.createMany({
    data: [
      { teamId: team.id, title: '确认今日客户回访清单', note: '示例事项，可编辑删除', date: beijingDateKey(), creatorId: admin.id, assigneeId: zhang.id },
      { teamId: team.id, title: '整理明日待办', note: null, date: beijingDateKey(), creatorId: li.id, assigneeId: li.id },
    ],
  });
}

export { defaultPermissionsForRole, getRequestUser };
