import { NextRequest, NextResponse } from 'next/server';
import { getRequestUser } from '@/lib/api';
import { canManageUsers } from '@/lib/auth';
import { tenantDb } from '@/lib/tenant';

export async function DELETE(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: '请先登录', code: 'auth.unauthorized' }, { status: 401 });
  if (!user.teamId || !canManageUsers(user)) return NextResponse.json({ error: '没有权限撤销邀请', code: 'user.manage.forbidden' }, { status: 403 });

  const { code } = await context.params;
  const db = tenantDb(user.teamId);
  const invite = await db.invite.findFirst({ where: { code } });
  if (!invite) return NextResponse.json({ error: '邀请不存在', code: 'invite.not_found' }, { status: 404 });

  await db.invite.updateMany({ where: { code }, data: { usedCount: invite.maxUses } });
  const revoked = await db.invite.findFirst({ where: { code } });
  await db.auditLog.create({ data: { action: 'invite.revoke', userId: user.id, detail: { inviteId: invite.id } } });
  return NextResponse.json({ invite: revoked });
}
