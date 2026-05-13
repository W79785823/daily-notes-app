import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUser, userSchema } from '@/lib/api';
import { canManagePermissions, canManageUsers, sanitizeAssignablePermissions } from '@/lib/auth';
import { formError, redirectWithParam, validationError } from '@/lib/http';

const SINGLE_ADMIN_ERROR = '系统只保留一个管理员，其他账号请使用普通成员身份';

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: '请先登录', code: 'auth.unauthorized' }, { status: 401 });
  if (!canManageUsers(user)) return NextResponse.json({ error: '没有权限查看用户', code: 'user.manage.forbidden' }, { status: 403 });
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  return NextResponse.json({ users });
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  let payload: unknown;
  let operatorId: string | null = null;
  let redirectTo = '';
  let isForm = false;
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    payload = {
      name: String(form.get('name') || ''),
      loginName: String(form.get('loginName') || ''),
      password: String(form.get('password') || ''),
      role: String(form.get('role') || 'MEMBER'),
      permissions: form.getAll('permissions').map(String),
      active: true,
    };
    operatorId = String(form.get('operatorId') || '');
    redirectTo = String(form.get('redirectTo') || '/');
    isForm = true;
  } else {
    payload = await request.json();
  }
  const user = await getRequestUser(request);
  if (!user) {
    return formError({ isForm, redirectTo, errorCode: 'auth.unauthorized', jsonMessage: '请先登录', status: 401 });
  }
  if (!canManageUsers(user)) {
    return formError({ isForm, redirectTo, errorCode: 'user.manage.forbidden', jsonMessage: '没有权限管理用户', status: 403 });
  }
  const parsed = userSchema.safeParse(payload);
  if (!parsed.success) return validationError(isForm, redirectTo, parsed.error);
  if (parsed.data.role === 'ADMIN') {
    return formError({ isForm, redirectTo, errorCode: 'user.admin_singleton.forbidden', jsonMessage: SINGLE_ADMIN_ERROR, status: 400 });
  }
  const safeData = {
    ...parsed.data,
    role: 'MEMBER' as const,
    permissions: sanitizeAssignablePermissions(user, parsed.data.permissions),
    active: true,
  };
  const created = await prisma.user.create({ data: safeData });
  await prisma.auditLog.create({ data: { action: 'user.create', userId: user.id, detail: { createdUserId: created.id } } });
  if (isForm) redirectWithParam(redirectTo, 'ok', 'user.created');
  return NextResponse.json({ user: created }, { status: 201 });
}
