import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUser } from '@/lib/api';
import { canActOnTask } from '@/lib/auth';
import { formError, redirectWithParam } from '@/lib/http';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const contentType = request.headers.get('content-type') || '';
  let body: Record<string, unknown> = {};
  let userId: string | null = null;
  let redirectTo = '';
  let isForm = false;
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    body = { completed: form.get('completed') !== 'false' };
    userId = String(form.get('userId') || '');
    redirectTo = String(form.get('redirectTo') || '/');
    isForm = true;
  } else {
    body = await request.json().catch(() => ({}));
    const requestUser = await getRequestUser(request);
    if (!requestUser) return formError({ isForm, redirectTo, errorCode: 'auth.unauthorized', jsonMessage: '请先登录', status: 401 });
    userId = requestUser.id;
  }
  const user = await getRequestUser(request);
  if (!user) return formError({ isForm, redirectTo, errorCode: 'auth.unauthorized', jsonMessage: '请先登录', status: 401 });
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.deletedAt) {
    return formError({ isForm, redirectTo, errorCode: 'task.not_found', jsonMessage: '事项不存在', status: 404 });
  }
  if (!canActOnTask(user, task, 'complete')) {
    return formError({ isForm, redirectTo, errorCode: 'task.complete.forbidden', jsonMessage: '没有权限完成该事项', status: 403 });
  }
  const done = body.completed !== false;
  const updated = await prisma.task.update({
    where: { id },
    data: done ? { completedAt: new Date(), completedById: user.id } : { completedAt: null, completedById: null },
  });
  await prisma.auditLog.create({ data: { action: done ? 'task.complete' : 'task.reopen', userId: user.id, taskId: id } });
  if (isForm) redirectWithParam(redirectTo, 'ok', done ? 'task.completed' : 'task.reopened');
  return NextResponse.json({
    task: {
      ...updated,
      completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
    },
  });
}
