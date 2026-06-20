import type { NextRequest } from 'next/server';
import { getRequestUser } from './session';

export async function getSuperAdmin(request: NextRequest) {
  const user = await getRequestUser(request);
  return user?.isSuperAdmin ? user : null;
}
