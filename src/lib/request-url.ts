import { NextRequest } from 'next/server';

export function requestOrigin(request: NextRequest) {
  const proto = request.headers.get('x-forwarded-proto') || request.nextUrl.protocol.replace(':', '') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  if (host && !host.startsWith('0.0.0.0') && !host.startsWith('127.0.0.1') && !host.startsWith('localhost')) {
    return `${proto}://${host}`;
  }
  return request.nextUrl.origin.replace('http://0.0.0.0:3000', 'http://127.0.0.1:3000');
}

export function requestUrl(request: NextRequest, path: string) {
  return new URL(path, requestOrigin(request));
}
