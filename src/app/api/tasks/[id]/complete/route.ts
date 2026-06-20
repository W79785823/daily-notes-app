import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUser } from '@/lib/api';
import { canActOnTask } from '@/lib/auth';
import { formError, redirectWithParam } from '@/lib/http';
import { assertSameTeam, tenantDb } from '@/lib/tenant';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const contentType = request.headers.get('content-type') || '';
  let body: Record<string, unknown> = {};
  let redirectTo = '';
  let isForm = false;
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    body = { completed: form.get('completed') !== 'false' };
    redirectTo = String(form.get('redirectTo') || '/');
    isForm = true;
  } else {
    body = await request.json().catch(() => ({}));
  }
  const user = await getRequestUser(request);
  if (!user) return formError({ isForm, redirectTo, errorCode: 'auth.unauthorized', jsonMessage: '请先登录', status: 401 });
  if (!user.teamId) return formError({ isForm, redirectTo, errorCode: 'tenant.required', jsonMessage: '超管请使用平台管理台', status: 403 });
  const db = tenantDb(user.teamId);
  const task = await prisma.task.findUnique({ where: { id } });
  if (!assertSameTeam(task, user.teamId) || !task || task.deletedAt) {
    return formError({ isForm, redirectTo, errorCode: 'task.not_found', jsonMessage: '事项不存在', status: 404 });
  }
  if (!canActOnTask(user, task, 'complete')) {
    return formError({ isForm, redirectTo, errorCode: 'task.complete.forbidden', jsonMessage: '没有权限完成该事项', status: 403 });
  }
  const done = body.completed !== false;
  const updated = await db.task.update({
    where: { id },
    data: done ? { completedAt: new Date(), completedById: user.id } : { completedAt: null, completedById: null },
  });
  await db.auditLog.create({ data: { action: done ? 'task.complete' : 'task.reopen', userId: user.id, taskId: id } });
  if (isForm) redirectWithParam(redirectTo, 'ok', done ? 'task.completed' : 'task.reopened');
  return NextResponse.json({
    task: {
      ...updated,
      completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
    },
  });
}
