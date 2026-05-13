import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getRequestUser } from '@/lib/api';
import { canManageUsers } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { formError, redirectWithParam } from '@/lib/http';

const resetPasswordSchema = z.object({
  newPassword: z.string().min(6),
  confirmPassword: z.string().min(6),
  redirectTo: z.string().optional(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  path: ['confirmPassword'],
  message: 'password.mismatch',
});

function isFormRequest(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  return contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
}

async function readPayload(request: NextRequest) {
  if (isFormRequest(request)) {
    const form = await request.formData();
    return { isForm: true, redirectTo: String(form.get('redirectTo') || '/'), data: Object.fromEntries(form) };
  }
  return { isForm: false, redirectTo: '', data: await request.json().catch(() => ({})) };
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await readPayload(request);
  const operator = await getRequestUser(request);
  if (!operator) {
    return formError({ isForm: payload.isForm, redirectTo: payload.redirectTo, errorCode: 'auth.unauthorized', jsonMessage: '请先登录', status: 401 });
  }
  if (!canManageUsers(operator)) {
    return formError({ isForm: payload.isForm, redirectTo: payload.redirectTo, errorCode: 'user.manage.forbidden', jsonMessage: '没有权限管理人员', status: 403 });
  }
  if (operator.id === id) {
    return formError({ isForm: payload.isForm, redirectTo: payload.redirectTo, errorCode: 'password.reset.self.forbidden', jsonMessage: '请在账号设置中修改自己的密码', status: 400 });
  }
  const parsed = resetPasswordSchema.safeParse(payload.data);
  if (!parsed.success) {
    return formError({ isForm: payload.isForm, redirectTo: payload.redirectTo, errorCode: 'password.reset.validation.failed', jsonMessage: '新密码至少 6 位，且两次输入需要一致', status: 400 });
  }
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return formError({ isForm: payload.isForm, redirectTo: payload.redirectTo, errorCode: 'user.not_found', jsonMessage: '人员不存在', status: 404 });
  }

  await prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(parsed.data.newPassword), sessionVersion: { increment: 1 } } });
  await prisma.auditLog.create({
    data: {
      action: 'user.password_reset',
      userId: operator.id,
      detail: { targetUserId: target.id, targetName: target.name },
    },
  });

  if (payload.isForm) redirectWithParam(payload.redirectTo, 'ok', 'password.reset');
  return NextResponse.json({ ok: true });
}
