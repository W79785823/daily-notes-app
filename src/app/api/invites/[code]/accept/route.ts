import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { createSessionToken, sessionCookieOptions } from '@/lib/session';
import { requestOrigin, requestUrl } from '@/lib/request-url';

const acceptSchema = z.object({
  displayName: z.string().min(1, '姓名不能为空').max(50),
  loginName: z.string().min(2, '账号至少 2 个字符').max(40).regex(/^[a-zA-Z0-9._-]+$/, '账号只能使用字母、数字、点、横线和下划线'),
  password: z.string().min(6, '密码至少 6 位').max(80),
});

function wantsForm(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  return contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
}

async function loadValidInvite(code: string) {
  const invite = await prisma.invite.findUnique({ where: { code }, include: { team: true } });
  const now = new Date();
  if (!invite || !invite.team.active || invite.usedCount >= invite.maxUses || (invite.expiresAt && invite.expiresAt <= now)) return null;
  return invite;
}

export async function POST(request: NextRequest, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const isForm = wantsForm(request);
  const rawPayload = isForm ? Object.fromEntries(await request.formData()) : await request.json().catch(() => ({}));
  const parsed = acceptSchema.safeParse(rawPayload);
  const failPath = `/join/${encodeURIComponent(code)}`;
  if (!parsed.success) {
    if (isForm) return NextResponse.redirect(requestUrl(request, `${failPath}?error=validation.failed`), { status: 303 });
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '加入信息不完整', code: 'validation.failed' }, { status: 400 });
  }

  const invite = await loadValidInvite(code);
  if (!invite) {
    if (isForm) return NextResponse.redirect(requestUrl(request, `${failPath}?error=invite.invalid`), { status: 303 });
    return NextResponse.json({ error: '邀请链接无效或已过期', code: 'invite.invalid' }, { status: 404 });
  }

  const loginName = parsed.data.loginName.trim();
  const existing = await prisma.user.findUnique({ where: { loginName } });
  if (existing) {
    if (isForm) return NextResponse.redirect(requestUrl(request, `${failPath}?error=auth.login_taken`), { status: 303 });
    return NextResponse.json({ error: '账号已被使用，请换一个账号', code: 'auth.login_taken' }, { status: 409 });
  }

  try {
    const user = await prisma.$transaction(async (tx) => {
      const claimed = await tx.invite.updateMany({
        where: { id: invite.id, usedCount: { lt: invite.maxUses } },
        data: { usedCount: { increment: 1 } },
      });
      if (claimed.count !== 1) throw new Error('INVITE_ALREADY_USED');
      const user = await tx.user.create({
        data: {
          teamId: invite.teamId,
          name: parsed.data.displayName.trim(),
          loginName,
          passwordHash: hashPassword(parsed.data.password),
          role: invite.role,
          permissions: invite.permissions,
          active: true,
        },
      });
      await tx.auditLog.create({ data: { teamId: invite.teamId, action: 'invite.accept', userId: user.id, detail: { inviteId: invite.id } } });
      return user;
    });

    const token = createSessionToken(user.id, user.sessionVersion);
    if (isForm) {
      const response = NextResponse.redirect(new URL('/', requestOrigin(request)), { status: 303 });
      response.cookies.set('daily_notes_session', token, sessionCookieOptions());
      return response;
    }
    const response = NextResponse.json({ token, user }, { status: 201 });
    response.cookies.set('daily_notes_session', token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      if (isForm) return NextResponse.redirect(requestUrl(request, `${failPath}?error=user.duplicate.forbidden`), { status: 303 });
      return NextResponse.json({ error: '姓名或账号已被占用，请换一个再加入', code: 'user.duplicate.forbidden' }, { status: 409 });
    }
    if (isForm) return NextResponse.redirect(requestUrl(request, `${failPath}?error=server.error`), { status: 303 });
    return NextResponse.json({ error: '加入失败，请稍后重试', code: 'server.error' }, { status: 502 });
  }
}
