import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export type FormResultOptions = {
  isForm: boolean;
  redirectTo: string;
  errorCode: string;
  jsonMessage: string;
  status?: number;
};

function appendParam(url: string, key: string, value: string) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

export function redirectWithParam(redirectTo: string, key: 'ok' | 'error', value: string): never {
  redirect(appendParam(redirectTo || '/', key, value));
}

export function formError({ isForm, redirectTo, errorCode, jsonMessage, status = 400 }: FormResultOptions) {
  if (isForm) redirectWithParam(redirectTo, 'error', errorCode);
  return NextResponse.json({ error: jsonMessage, code: errorCode }, { status });
}

export function validationError(isForm: boolean, redirectTo: string, error: unknown) {
  const message = error instanceof ZodError ? error.issues[0]?.message || '表单内容不正确' : '表单内容不正确';
  return formError({ isForm, redirectTo, errorCode: 'validation.failed', jsonMessage: message, status: 400 });
}
