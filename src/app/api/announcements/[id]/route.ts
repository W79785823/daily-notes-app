import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUser } from '@/lib/api';
import { canDeleteAnnouncement, type AuthUser } from '@/lib/auth';
import { formError, redirectWithParam } from '@/lib/http';

function isFormRequest(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  return contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
}

async function readBody(request: NextRequest) {
  if (isFormRequest(request)) {
    const form = await request.formData();
    return {
      isForm: true,
      method: String(form.get('_method') || 'DELETE').toUpperCase(),
      userId: String(form.get('userId') || ''),
      redirectTo: String(form.get('redirectTo') || '/'),
    };
  }
  return { isForm: false, method: 'DELETE', userId: null, redirectTo: '' };
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const body = await readBody(request);
  const user = await getRequestUser(request);
  if (!user) {
    return formError({ isForm: body.isForm, redirectTo: body.redirectTo, errorCode: 'auth.unauthorized', jsonMessage: '请先登录', status: 401 });
  }
  if (body.method !== 'DELETE') {
    return formError({ isForm: body.isForm, redirectTo: body.redirectTo, errorCode: 'validation.failed', jsonMessage: '不支持的公告操作', status: 400 });
  }
  return deleteAnnouncement(context, user, body.redirectTo, body.isForm);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: '请先登录', code: 'auth.unauthorized' }, { status: 401 });
  return deleteAnnouncement(context, user, '', false);
}

async function deleteAnnouncement(context: { params: Promise<{ id: string }> }, user: AuthUser, redirectTo: string, isForm: boolean) {
  const { id } = await context.params;
  const announcement = await prisma.announcement.findUnique({ where: { id } });
  if (!announcement || announcement.deletedAt) {
    return formError({ isForm, redirectTo, errorCode: 'announcement.not_found', jsonMessage: '公告不存在或已删除', status: 404 });
  }
  if (!canDeleteAnnouncement(user, announcement)) {
    return formError({ isForm, redirectTo, errorCode: 'announcement.delete.forbidden', jsonMessage: '没有权限删除公告', status: 403 });
  }
  await prisma.announcement.update({ where: { id }, data: { deletedAt: new Date() } });
  await prisma.auditLog.create({ data: { action: 'announcement.delete', userId: user.id, detail: { announcementId: id, title: announcement.title } } });
  if (isForm) redirectWithParam(redirectTo, 'ok', 'announcement.deleted');
  return NextResponse.json({ ok: true });
}
