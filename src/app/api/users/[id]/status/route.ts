import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getRequestUser } from '@/lib/api';
import { canManagePermissions, canManageUsers, sanitizeAssignablePermissions } from '@/lib/auth';
import { formError, redirectWithParam } from '@/lib/http';

function isFormRequest(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  return contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
}

async function readPayload(request: NextRequest) {
  if (isFormRequest(request)) {
    const form = await request.formData();
    return {
      isForm: true,
      operatorId: String(form.get('operatorId') || ''),
      redirectTo: String(form.get('redirectTo') || '/'),
      data: {
        active: form.get('active') !== 'false',
        name: String(form.get('name') || '').trim(),
        role: String(form.get('role') || ''),
        permissions: form.getAll('permissions').map(String),
      },
    };
  }
  return { isForm: false, operatorId: null, redirectTo: '', data: await request.json() };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payload = await readPayload(request);
  const operator = await getRequestUser(request);
  if (!operator) {
    return formError({ isForm: payload.isForm, redirectTo: payload.redirectTo, errorCode: 'auth.unauthorized', jsonMessage: '请先登录', status: 401 });
  }
  if (!canManageUsers(operator)) {
    return formError({ isForm: payload.isForm, redirectTo: payload.redirectTo, errorCode: 'user.manage.forbidden', jsonMessage: '没有权限管理人员', status: 403 });
  }
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return formError({ isForm: payload.isForm, redirectTo: payload.redirectTo, errorCode: 'user.not_found', jsonMessage: '人员不存在', status: 404 });
  }
  const active = payload.data.active !== false;
  const updateData: { active: boolean; name?: string; role?: 'MEMBER' | 'COLLABORATOR' | 'ADMIN'; permissions?: string[] } = { active };
  const name = String(payload.data.name || '').trim();
  if (name) updateData.name = name;
  if (payload.data.role && payload.data.role !== target.role) {
    if (!canManagePermissions(operator)) {
      return formError({ isForm: payload.isForm, redirectTo: payload.redirectTo, errorCode: 'permission.manage.forbidden', jsonMessage: '没有权限修改角色', status: 403 });
    }
    if (['MEMBER', 'COLLABORATOR', 'ADMIN'].includes(payload.data.role)) updateData.role = payload.data.role as 'MEMBER' | 'COLLABORATOR' | 'ADMIN';
  }
  if (canManagePermissions(operator) && payload.data.permissions !== undefined) updateData.permissions = sanitizeAssignablePermissions(operator, payload.data.permissions);
  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
  });
  const action = active ? (target.active ? 'user.update' : 'user.approve') : 'user.disable';
  await prisma.auditLog.create({
    data: {
      action,
      userId: operator.id,
      detail: { targetUserId: updated.id, targetName: updated.name, role: updated.role, permissions: updated.permissions },
    },
  });
  if (payload.isForm) redirectWithParam(payload.redirectTo, 'ok', active ? (target.active ? 'user.update' : 'user.approved') : 'user.disabled');
  return NextResponse.json({ user: updated });
}
