import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestUser } from '@/lib/api';
import { canCreateAnnouncement } from '@/lib/auth';
import { formError, redirectWithParam, validationError } from '@/lib/http';
import { tenantDb } from '@/lib/tenant';

const announcementSchema = z.object({
  title: z.string().min(1, '标题不能为空').max(60),
  content: z.string().min(1, '内容不能为空').max(500),
  pinned: z.boolean().default(false),
});

function isFormRequest(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  return contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
}

async function readPayload(request: NextRequest) {
  if (isFormRequest(request)) {
    const form = await request.formData();
    return {
      isForm: true,
      userId: String(form.get('userId') || ''),
      redirectTo: String(form.get('redirectTo') || '/'),
      data: {
        title: String(form.get('title') || ''),
        content: String(form.get('content') || ''),
        pinned: form.get('pinned') === 'on' || form.get('pinned') === 'true',
      },
    };
  }
  return { isForm: false, userId: null, redirectTo: '', data: await request.json() };
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: '请先登录', code: 'auth.unauthorized' }, { status: 401 });
  if (!user.teamId) return NextResponse.json({ error: '超管请使用平台管理台', code: 'tenant.required' }, { status: 403 });
  const db = tenantDb(user.teamId);
  const announcements = await db.announcement.findMany({
    where: { deletedAt: null },
    take: 10,
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    include: { author: true },
  });
  return NextResponse.json({ announcements });
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
  if (!canCreateAnnouncement(user)) {
    return formError({ isForm: payload.isForm, redirectTo: payload.redirectTo, errorCode: 'announcement.create.forbidden', jsonMessage: '没有权限发布公告', status: 403 });
  }
  const parsed = announcementSchema.safeParse(payload.data);
  if (!parsed.success) return validationError(payload.isForm, payload.redirectTo, parsed.error);
  const announcement = await db.announcement.create({
    data: { teamId: user.teamId, ...parsed.data, authorId: user.id },
    include: { author: true },
  });
  await db.auditLog.create({ data: { action: 'announcement.create', userId: user.id, detail: { announcementId: announcement.id, title: announcement.title } } });
  if (payload.isForm) redirectWithParam(payload.redirectTo, 'ok', 'announcement.created');
  return NextResponse.json({ announcement }, { status: 201 });
}
