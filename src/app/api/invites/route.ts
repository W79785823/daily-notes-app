import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getRequestUser } from '@/lib/api';
import { canManageUsers, sanitizeAssignablePermissions } from '@/lib/auth';
import { requestOrigin } from '@/lib/request-url';
import { tenantDb } from '@/lib/tenant';

const inviteSchema = z.object({
  role: z.enum(['MEMBER', 'ADMIN']).default('MEMBER'),
  permissions: z.array(z.string()).default([]),
  expiresAt: z.string().datetime().optional().nullable(),
  maxUses: z.number().int().min(1).max(100).default(1),
});

function defaultInviteExpiry() {
  return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
}

function inviteCode() {
  return randomBytes(18).toString('base64url');
}

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: '请先登录', code: 'auth.unauthorized' }, { status: 401 });
  if (!user.teamId || !canManageUsers(user)) return NextResponse.json({ error: '没有权限查看邀请', code: 'user.manage.forbidden' }, { status: 403 });

  const db = tenantDb(user.teamId);
  const invites = await db.invite.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json({
    invites: invites.map((invite) => ({
      ...invite,
      joinUrl: `${requestOrigin(request)}/join/${invite.code}`,
    })),
  });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: '请先登录', code: 'auth.unauthorized' }, { status: 401 });
  if (!user.teamId || !canManageUsers(user)) return NextResponse.json({ error: '没有权限创建邀请', code: 'user.manage.forbidden' }, { status: 403 });

  const rawPayload = await request.json().catch(() => ({}));
  const parsed = inviteSchema.safeParse(rawPayload);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || '邀请参数不正确', code: 'validation.failed' }, { status: 400 });

  const db = tenantDb(user.teamId);
  const invite = await db.invite.create({
    data: {
      teamId: user.teamId,
      code: inviteCode(),
      role: parsed.data.role === 'ADMIN' ? 'MEMBER' : parsed.data.role,
      permissions: sanitizeAssignablePermissions(user, parsed.data.permissions),
      expiresAt: parsed.data.expiresAt === null ? null : parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : defaultInviteExpiry(),
      maxUses: parsed.data.maxUses,
      createdById: user.id,
    },
  });

  return NextResponse.json({ invite, joinUrl: `${requestOrigin(request)}/join/${invite.code}` }, { status: 201 });
}
