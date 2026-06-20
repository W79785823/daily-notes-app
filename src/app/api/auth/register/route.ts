import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { createSessionToken, sessionCookieOptions } from '@/lib/session';
import { requestOrigin, requestUrl } from '@/lib/request-url';

const registerSchema = z.object({
  teamName: z.string().min(1, '团队名称不能为空').max(80),
  displayName: z.string().min(1, '姓名不能为空').max(50),
  loginName: z.string().min(2, '账号至少 2 个字符').max(40).regex(/^[a-zA-Z0-9._-]+$/, '账号只能使用字母、数字、点、横线和下划线'),
  password: z.string().min(6, '密码至少 6 位').max(80),
});

function wantsForm(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  return contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
}

export async function POST(request: NextRequest) {
  const isForm = wantsForm(request);
  const rawPayload = isForm ? Object.fromEntries(await request.formData()) : await request.json().catch(() => ({}));
  const parsed = registerSchema.safeParse(rawPayload);
  if (!parsed.success) {
    if (isForm) return NextResponse.redirect(requestUrl(request, '/register?error=validation.failed'), { status: 303 });
    return NextResponse.json({ error: parsed.error.issues[0]?.message || '注册信息不完整', code: 'validation.failed' }, { status: 400 });
  }

  const data = parsed.data;
  const loginName = data.loginName.trim();
  const existing = await prisma.user.findUnique({ where: { loginName } });
  if (existing) {
    if (isForm) return NextResponse.redirect(requestUrl(request, '/register?error=auth.login_taken'), { status: 303 });
    return NextResponse.json({ error: '账号已被使用，请换一个账号', code: 'auth.login_taken' }, { status: 409 });
  }

  try {
    const { owner } = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({ data: { name: data.teamName.trim() } });
      const owner = await tx.user.create({
        data: {
          teamId: team.id,
          name: data.displayName.trim(),
          loginName,
          passwordHash: hashPassword(data.password),
          role: 'ADMIN',
          permissions: [],
          active: true,
        },
      });
      await tx.team.update({ where: { id: team.id }, data: { ownerId: owner.id } });
      await tx.auditLog.create({ data: { teamId: team.id, action: 'team.register', userId: owner.id, detail: { teamId: team.id, teamName: team.name } } });
      return { team, owner };
    });

    const token = createSessionToken(owner.id, owner.sessionVersion);
    if (isForm) {
      const response = NextResponse.redirect(new URL('/', requestOrigin(request)), { status: 303 });
      response.cookies.set('daily_notes_session', token, sessionCookieOptions());
      return response;
    }
    const response = NextResponse.json({ token, user: owner }, { status: 201 });
    response.cookies.set('daily_notes_session', token, sessionCookieOptions());
    return response;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      if (isForm) return NextResponse.redirect(requestUrl(request, '/register?error=auth.login_taken'), { status: 303 });
      return NextResponse.json({ error: '账号已被使用，请换一个账号', code: 'auth.login_taken' }, { status: 409 });
    }
    if (isForm) return NextResponse.redirect(requestUrl(request, '/register?error=server.error'), { status: 303 });
    return NextResponse.json({ error: '注册失败，请稍后重试', code: 'server.error' }, { status: 502 });
  }
}
