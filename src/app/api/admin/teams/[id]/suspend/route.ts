import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getSuperAdmin } from '@/lib/super-admin';
import { redirectWithParam } from '@/lib/http';

function wantsForm(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  return contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data');
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const admin = await getSuperAdmin(request);
  const isForm = wantsForm(request);
  if (!admin) {
    if (isForm) redirectWithParam('/admin', 'error', 'admin.forbidden');
    return NextResponse.json({ error: '没有平台管理权限', code: 'admin.forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  let team;
  try {
    team = await prisma.team.update({ where: { id }, data: { active: false } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      if (isForm) redirectWithParam('/admin', 'error', 'team.not_found');
      return NextResponse.json({ error: '团队不存在', code: 'team.not_found' }, { status: 404 });
    }
    throw error;
  }
  await prisma.auditLog.create({ data: { teamId: team.id, action: 'admin.team.suspend', userId: admin.id, detail: { teamId: team.id, teamName: team.name } } });
  if (isForm) redirectWithParam('/admin', 'ok', 'team.suspended');
  return NextResponse.json({ team });
}
