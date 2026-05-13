import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { prisma } from './db';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  userId: string;
  exp: number;
  iat: number;
  version: number;
};

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString('base64url');
}

function sign(data: string, secret: string) {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

function sessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET_REQUIRED');
  }
  return secret;
}

export function allowDevUserHeader() {
  if (process.env.AUTH_ALLOW_DEV_USER_HEADER !== undefined) return process.env.AUTH_ALLOW_DEV_USER_HEADER === 'true';
  return process.env.NODE_ENV !== 'production';
}

export function createSessionToken(userId: string, sessionVersionOrNow = 0, now = Math.floor(Date.now() / 1000)) {
  const payload: SessionPayload = { userId, version: sessionVersionOrNow, iat: now, exp: now + SESSION_TTL_SECONDS };
  const encodedPayload = base64url(JSON.stringify(payload));
  return `${encodedPayload}.${sign(encodedPayload, sessionSecret())}`;
}

export function verifySessionToken(token: string | null | undefined, now = Math.floor(Date.now() / 1000)): SessionPayload | null {
  if (!token) return null;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return null;

  const expected = sign(encodedPayload, sessionSecret());
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== actualBuffer.length || !timingSafeEqual(expectedBuffer, actualBuffer)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.userId || !payload.exp || !payload.iat || typeof payload.version !== 'number' || payload.exp < now) return null;
    return payload;
  } catch {
    return null;
  }
}

export function isSessionFreshForUser(session: SessionPayload, currentSessionVersion: number) {
  return session.version === currentSessionVersion;
}

export function bearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization') || '';
  return authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : null;
}

export function sessionTokenFromRequest(request: NextRequest) {
  return bearerToken(request) || request.cookies.get('daily_notes_session')?.value || null;
}

export function userIdFromRequest(request: NextRequest) {
  const session = verifySessionToken(sessionTokenFromRequest(request));
  if (session?.userId) return session.userId;

  if (!allowDevUserHeader()) return null;
  return request.headers.get('x-user-id') || request.nextUrl.searchParams.get('userId') || null;
}

export function sessionFromRequest(request: NextRequest) {
  return verifySessionToken(sessionTokenFromRequest(request));
}

export async function getRequestUser(request: NextRequest) {
  const session = sessionFromRequest(request);
  if (session?.userId) {
    const user = await prisma.user.findUnique({ where: { id: session.userId } });
    if (user?.active && isSessionFreshForUser(session, user.sessionVersion)) return user;
    return null;
  }

  if (!allowDevUserHeader()) return null;
  const userId = request.headers.get('x-user-id') || request.nextUrl.searchParams.get('userId') || null;
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.active) return user;
  }
  return null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
