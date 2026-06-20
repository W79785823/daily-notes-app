import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { getSuperAdmin } from '@/lib/super-admin';
import { redirectWithParam, validationError } from '@/lib/http';

const resetSchema = z.object({
  newPassword: z.string().min(6),
  confirmPassword: z.string().min(6),
}).refine((data) => data.newPassword === data.confirmPassword, { message: '两次密码不一致' });

function wantsForm(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  return contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getSuperAdmin(request);
  const isForm = wantsForm(request);
  if (!admin) {
    if (isForm) redirectWithParam('/admin', 'error', 'admin.forbidden');
    return NextResponse.json({ error: '没有平台管理权限', code: 'admin.forbidden' }, { status: 403 });
  }

  const rawPayload = isForm ? Object.fromEntries(await request.formData()) : await request.json().catch(() => ({}));
  const parsed = resetSchema.safeParse(rawPayload);
  if (!parsed.success) return validationError(isForm, '/admin', parsed.error);

  const { id } = await context.params;
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    if (isForm) redirectWithParam('/admin', 'error', 'user.not_found');
    return NextResponse.json({ error: '用户不存在', code: 'user.not_found' }, { status: 404 });
  }

  await prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(parsed.data.newPassword), sessionVersion: { increment: 1 } } });
  await prisma.auditLog.create({ data: { teamId: target.teamId, action: 'admin.password.reset', userId: admin.id, detail: { targetUserId: target.id } } });
  if (isForm) redirectWithParam('/admin', 'ok', 'password.reset');
  return NextResponse.json({ ok: true });
}
