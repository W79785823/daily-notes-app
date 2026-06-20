import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSuperAdmin } from '@/lib/super-admin';

export async function GET(request: NextRequest) {
  const admin = await getSuperAdmin(request);
  if (!admin) return NextResponse.json({ error: '没有平台管理权限', code: 'admin.forbidden' }, { status: 403 });

  const teams = await prisma.team.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      users: { select: { id: true, name: true, loginName: true, active: true } },
    },
  });
  return NextResponse.json({
    teams: teams.map((team) => {
      const owner = team.users.find((user) => user.id === team.ownerId) || null;
      return {
        id: team.id,
        name: team.name,
        ownerId: team.ownerId,
        owner,
        active: team.active,
        createdAt: team.createdAt,
        memberCount: team.users.length,
      };
    }),
  });
}
