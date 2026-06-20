import { NextRequest, NextResponse } from 'next/server';
import { Priority, Prisma } from '@prisma/client';
import { getRequestUser, taskSchema } from '@/lib/api';
import { canActOnTask, canAssignTask, canCreateTask, taskVisibilityWhere } from '@/lib/auth';
import { beijingDateKey } from '@/lib/beijing-date';
import { formError, redirectWithParam, validationError } from '@/lib/http';
import { tenantDb } from '@/lib/tenant';

function wantsHtml(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  return contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
}

async function readPayload(request: NextRequest) {
  if (wantsHtml(request)) {
    const form = await request.formData();
    return {
      data: {
        title: String(form.get('title') || ''),
        note: String(form.get('note') || '') || null,
        priority: String(form.get('priority') || 'NORMAL'),
        date: String(form.get('date') || ''),
        assigneeId: String(form.get('assigneeId') || ''),
      },
      userId: String(form.get('creatorId') || form.get('userId') || ''),
      redirectTo: String(form.get('redirectTo') || '/'),
      isForm: true,
    };
  }
  return { data: await request.json(), userId: null, redirectTo: '', isForm: false };
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: '请先登录', code: 'auth.unauthorized' }, { status: 401 });
  if (!user.teamId) return NextResponse.json({ error: '超管请使用平台管理台', code: 'tenant.required' }, { status: 403 });
  const db = tenantDb(user.teamId);
  const date = request.nextUrl.searchParams.get('date') || beijingDateKey();
  const status = request.nextUrl.searchParams.get('status') || 'all';
  const priorityParam = request.nextUrl.searchParams.get('priority') || 'all';
  const priority = Object.values(Priority).includes(priorityParam as Priority) ? (priorityParam as Priority) : 'all';
  const assigneeId = request.nextUrl.searchParams.get('assigneeId') || 'all';
  const keyword = request.nextUrl.searchParams.get('keyword') || '';
  const overdue = request.nextUrl.searchParams.get('overdue') === '1';
  const todayKey = beijingDateKey();
  const where: Prisma.TaskWhereInput = {
    ...(overdue ? { date: { lt: todayKey }, completedAt: null } : { date }),
    deletedAt: null,
    ...(status === 'todo' ? { completedAt: null } : status === 'done' ? { completedAt: { not: null } } : {}),
    ...(priority !== 'all' ? { priority } : {}),
    ...(assigneeId !== 'all' ? { assigneeId } : {}),
    ...(keyword ? { OR: [{ title: { contains: keyword, mode: 'insensitive' as const } }, { note: { contains: keyword, mode: 'insensitive' as const } }] } : {}),
    ...taskVisibilityWhere(user),
  };
  const tasks = await db.task.findMany({
    where,
    include: { creator: true, assignee: true, completedBy: true },
    orderBy: [{ completedAt: 'asc' }, { createdAt: 'desc' }],
  });
  return NextResponse.json({
    currentUser: user,
    tasks: tasks.map((task) => ({
      ...task,
      createdAt: task.createdAt.toISOString(),
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      canComplete: canActOnTask(user, task, 'complete'),
      canDelete: canActOnTask(user, task, 'delete'),
      canEdit: canActOnTask(user, task, 'edit'),
    })),
  });
}

export async function POST(request: NextRequest) {
  const payload = await readPayload(request);
  const user = await getRequestUser(request);
  if (!user) {
    return formError({ isForm: payload.isForm, redirectTo: payload.redirectTo, errorCode: 'auth.unauthorized', jsonMessage: '请先登录', status: 401 });
  }
  if (!user.teamId) {
    return formError({ isForm: payload.isForm, redirectTo: payload.redirectTo, errorCode: 'tenant.required', jsonMessage: '超管请使用平台管理台', status: 403 });
  }
  const db = tenantDb(user.teamId);
  if (!canCreateTask(user)) {
    return formError({ isForm: payload.isForm, redirectTo: payload.redirectTo, errorCode: 'task.create.forbidden', jsonMessage: '没有权限创建事项', status: 403 });
  }
  const parsed = taskSchema.safeParse(payload.data);
  if (!parsed.success) return validationError(payload.isForm, payload.redirectTo, parsed.error);
  const data = parsed.data;
  if (!canAssignTask(user, data.assigneeId)) {
    return formError({ isForm: payload.isForm, redirectTo: payload.redirectTo, errorCode: 'task.assign.forbidden', jsonMessage: '没有权限指派给他人', status: 403 });
  }
  const assignee = await db.user.findFirst({ where: { id: data.assigneeId, active: true } });
  if (!assignee) {
    return formError({ isForm: payload.isForm, redirectTo: payload.redirectTo, errorCode: 'task.assignee.not_found', jsonMessage: '负责人不存在或不属于当前团队', status: 404 });
  }
  const task = await db.task.create({
    data: { teamId: user.teamId, title: data.title, note: data.note || null, priority: data.priority, date: data.date, creatorId: user.id, assigneeId: data.assigneeId, teamVisible: data.assigneeId !== user.id },
    include: { creator: true, assignee: true },
  });
  await db.auditLog.create({ data: { action: 'task.create', userId: user.id, taskId: task.id, detail: { title: task.title } } });
  if (payload.isForm) redirectWithParam(payload.redirectTo, 'ok', 'task.created');
  return NextResponse.json({
    task: {
      ...task,
      createdAt: task.createdAt.toISOString(),
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      canComplete: canActOnTask(user, task, 'complete'),
      canDelete: canActOnTask(user, task, 'delete'),
      canEdit: canActOnTask(user, task, 'edit'),
    },
  }, { status: 201 });
}
