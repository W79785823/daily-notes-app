import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUser, taskSchema } from '@/lib/api';
import { canActOnTask, canAssignTask } from '@/lib/auth';
import { formError, redirectWithParam, validationError } from '@/lib/http';

async function readBody(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    return {
      isForm: true,
      method: String(form.get('_method') || 'PATCH').toUpperCase(),
      userId: String(form.get('userId') || ''),
      redirectTo: String(form.get('redirectTo') || '/'),
      data: Object.fromEntries(['title', 'note', 'priority', 'date', 'assigneeId'].map((k) => [k, form.get(k)]).filter(([, v]) => v !== null && v !== '')),
    };
  }
  return { isForm: false, method: 'PATCH', userId: null, redirectTo: '', data: await request.json() };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const body = await readBody(request);
  const requestUser = await getRequestUser(request);
  if (!requestUser) {
    return formError({ isForm: body.isForm, redirectTo: body.redirectTo, errorCode: 'auth.unauthorized', jsonMessage: '请先登录', status: 401 });
  }
  if (body.method === 'DELETE') return softDelete(context, requestUser, body.redirectTo, body.isForm);
  return updateTask(context, requestUser, body.redirectTo, body.isForm, body.data);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const body = await readBody(request);
  const requestUser = await getRequestUser(request);
  if (!requestUser) return NextResponse.json({ error: '请先登录', code: 'auth.unauthorized' }, { status: 401 });
  return updateTask(context, requestUser, body.redirectTo, body.isForm, body.data);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: '请先登录', code: 'auth.unauthorized' }, { status: 401 });
  return softDelete(context, user, '', false);
}

async function updateTask(context: { params: Promise<{ id: string }> }, user: NonNullable<Awaited<ReturnType<typeof getRequestUser>>>, redirectTo: string, isForm: boolean, rawData: unknown) {
  const { id } = await context.params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.deletedAt) {
    return formError({ isForm, redirectTo, errorCode: 'task.not_found', jsonMessage: '事项不存在', status: 404 });
  }
  if (!canActOnTask(user, task, 'edit')) {
    return formError({ isForm, redirectTo, errorCode: 'task.update.forbidden', jsonMessage: '没有权限编辑该事项', status: 403 });
  }
  const parsed = taskSchema.partial().safeParse(rawData);
  if (!parsed.success) return validationError(isForm, redirectTo, parsed.error);
  const data = parsed.data;
  if (data.assigneeId && data.assigneeId !== task.assigneeId && !canAssignTask(user, data.assigneeId)) {
    return formError({ isForm, redirectTo, errorCode: 'task.assign.forbidden', jsonMessage: '没有权限变更负责人', status: 403 });
  }
  const updateData = { ...data, ...(data.assigneeId ? { teamVisible: data.assigneeId !== user.id } : {}) };
  const updated = await prisma.task.update({ where: { id }, data: updateData, include: { creator: true, assignee: true, completedBy: true } });
  await prisma.auditLog.create({ data: { action: 'task.update', userId: user.id, taskId: id, detail: updateData } });
  if (isForm) redirectWithParam(redirectTo, 'ok', 'task.updated');
  return NextResponse.json({
    task: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      completedAt: updated.completedAt ? updated.completedAt.toISOString() : null,
      canComplete: canActOnTask(user, updated, 'complete'),
      canDelete: canActOnTask(user, updated, 'delete'),
      canEdit: canActOnTask(user, updated, 'edit'),
    },
  });
}

async function softDelete(context: { params: Promise<{ id: string }> }, user: NonNullable<Awaited<ReturnType<typeof getRequestUser>>>, redirectTo: string, isForm: boolean) {
  const { id } = await context.params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.deletedAt) {
    return formError({ isForm, redirectTo, errorCode: 'task.not_found', jsonMessage: '事项不存在', status: 404 });
  }
  if (!canActOnTask(user, task, 'delete')) {
    return formError({ isForm, redirectTo, errorCode: 'task.delete.forbidden', jsonMessage: '没有权限删除事项', status: 403 });
  }
  const deleted = await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
  await prisma.auditLog.create({ data: { action: 'task.delete', userId: user.id, taskId: id } });
  if (isForm) redirectWithParam(redirectTo, 'ok', 'task.deleted');
  return NextResponse.json({ task: deleted });
}
