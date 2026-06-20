import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createSessionToken, sessionCookieOptions } from '@/lib/session';
import { verifyPassword } from '@/lib/password';
import { requestOrigin, requestUrl } from '@/lib/request-url';

const loginSchema = z.object({
  loginName: z.string().min(1),
  password: z.string().min(1),
  redirectTo: z.string().optional(),
});

async function findLoginUser(payload: z.infer<typeof loginSchema>) {
  const user = await prisma.user.findUnique({ where: { loginName: payload.loginName.trim() }, include: { team: true } });
  if (!user || !verifyPassword(payload.password, user.passwordHash)) return null;
  return prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() }, include: { team: true } });
}

function wantsForm(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  return contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
}

function getLoginIdentifier(payload: z.infer<typeof loginSchema>) {
  return payload.loginName.trim();
}

async function loginAttemptGuard(identifier: string) {
  const now = new Date();
  const record = await prisma.loginAttempt.findUnique({ where: { identifier } });
  if (record?.lockedUntil && record.lockedUntil > now) {
    const seconds = Math.ceil((record.lockedUntil.getTime() - now.getTime()) / 1000);
    return { blocked: true, seconds };
  }
  return { blocked: false, record };
}

async function markLoginFailure(identifier: string) {
  const now = new Date();
  const existing = await prisma.loginAttempt.findUnique({ where: { identifier } });
  const failedCount = (existing?.failedCount || 0) + 1;
  const lockedUntil = failedCount >= 5 ? new Date(now.getTime() + 15 * 60 * 1000) : existing?.lockedUntil || null;
  await prisma.loginAttempt.upsert({
    where: { identifier },
    create: { identifier, failedCount, lockedUntil, lastAttemptAt: now },
    update: { failedCount, lockedUntil, lastAttemptAt: now },
  });
  return { failedCount, lockedUntil };
}

async function clearLoginFailures(identifier: string) {
  await prisma.loginAttempt.upsert({
    where: { identifier },
    create: { identifier, failedCount: 0, lockedUntil: null, lastAttemptAt: new Date() },
    update: { failedCount: 0, lockedUntil: null, lastAttemptAt: new Date() },
  });
}

export async function POST(request: NextRequest) {
  const isForm = wantsForm(request);
  const rawPayload = isForm ? Object.fromEntries(await request.formData()) : await request.json().catch(() => ({}));
  const payload = loginSchema.safeParse(rawPayload);
  if (!payload.success) {
    if (isForm) return NextResponse.redirect(requestUrl(request, '/login?error=validation.failed'), { status: 303 });
    return NextResponse.json({ error: '登录参数不正确', code: 'validation.failed' }, { status: 400 });
  }

  try {
    const identifier = getLoginIdentifier(payload.data);
    const guard = await loginAttemptGuard(identifier);
    if (guard.blocked) {
      const lockMessage = `登录失败次数过多，请 ${Math.ceil((guard.seconds || 900) / 60)} 分钟后再试。`;
      if (isForm) return NextResponse.redirect(requestUrl(request, '/login?error=auth.locked'), { status: 303 });
      return NextResponse.json({ error: lockMessage, code: 'auth.locked' }, { status: 429 });
    }

    const user = await findLoginUser(payload.data);
    if (!user || !user.active) {
      const failure = await markLoginFailure(identifier);
      if (isForm) {
        const code = failure.lockedUntil ? 'auth.locked' : 'auth.failed';
        return NextResponse.redirect(requestUrl(request, `/login?error=${code}`), { status: 303 });
      }
      return NextResponse.json({ error: '账号或密码不正确，或账号已停用', code: failure.lockedUntil ? 'auth.locked' : 'auth.failed' }, { status: failure.lockedUntil ? 429 : 401 });
    }
    if (!user.isSuperAdmin && user.team && !user.team.active) {
      await markLoginFailure(identifier);
      if (isForm) return NextResponse.redirect(requestUrl(request, '/login?error=auth.team_suspended'), { status: 303 });
      return NextResponse.json({ error: '团队已停用，请联系平台管理员', code: 'auth.team_suspended' }, { status: 403 });
    }

    await clearLoginFailures(identifier);
    const token = createSessionToken(user.id, user.sessionVersion);
    if (isForm) {
      const defaultRedirect = user.isSuperAdmin ? '/admin' : '/';
      const requestedRedirect = payload.data.redirectTo && payload.data.redirectTo.startsWith('/') ? payload.data.redirectTo : '';
      const redirectTo = user.isSuperAdmin && (!requestedRedirect || requestedRedirect === '/') ? defaultRedirect : requestedRedirect || defaultRedirect;
      const response = NextResponse.redirect(new URL(redirectTo, requestOrigin(request)), { status: 303 });
      response.cookies.set('daily_notes_session', token, sessionCookieOptions());
      return response;
    }
    const response = NextResponse.json({ token, user });
    response.cookies.set('daily_notes_session', token, sessionCookieOptions());
    return response;
  } catch {
    if (isForm) return NextResponse.redirect(requestUrl(request, '/login?error=server.error'), { status: 303 });
    return NextResponse.json({ error: '登录失败', code: 'auth.failed' }, { status: 502 });
  }
}
