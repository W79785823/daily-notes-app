import { NextRequest, NextResponse } from 'next/server';
import { requestUrl } from '@/lib/request-url';

export async function POST(request: NextRequest) {
  const response = NextResponse.redirect(requestUrl(request, '/login'), { status: 303 });
  response.cookies.set('daily_notes_session', '', { path: '/', maxAge: 0 });
  return response;
}
