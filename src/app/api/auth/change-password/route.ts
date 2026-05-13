import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getRequestUser, sessionCookieOptions } from '@/lib/session';
import { hashPassword, verifyPassword } from '@/lib/password';
import { requestUrl } from '@/lib/request-url';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
  confirmPassword: z.string().min(6),
  redirectTo: z.string().optional(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  path: ['confirmPassword'],
  message: 'password.mismatch',
});

function formRedirect(request: NextRequest, redirectTo: string | undefined, code: string, type: 'ok' | 'error' = 'error') {
  const target = redirectTo && redirectTo.startsWith('/') ? redirectTo : '/';
  const url = requestUrl(request, target);
  url.searchParams.set(type, code);
  return NextResponse.redirect(url, { status: 303 });
}

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  const rawPayload = Object.fromEntries(await request.formData());
  const payload = changePasswordSchema.safeParse(rawPayload);
  const redirectTo = typeof rawPayload.redirectTo === 'string' ? rawPayload.redirectTo : '/';

  if (!user) return NextResponse.redirect(requestUrl(request, '/login?error=auth.required'), { status: 303 });
  if (!payload.success) return formRedirect(request, redirectTo, 'password.validation.failed');
  if (!user.passwordHash || !verifyPassword(payload.data.currentPassword, user.passwordHash)) {
    return formRedirect(request, redirectTo, 'password.current.failed');
  }
  if (verifyPassword(payload.data.newPassword, user.passwordHash)) {
    return formRedirect(request, redirectTo, 'password.same');
  }

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(payload.data.newPassword), sessionVersion: { increment: 1 } } });

  const response = NextResponse.redirect(requestUrl(request, '/login?ok=password.changed'), { status: 303 });
  response.cookies.set('daily_notes_session', '', { ...sessionCookieOptions(), maxAge: 0 });
  return response;
}
