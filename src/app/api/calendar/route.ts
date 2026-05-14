import { NextRequest, NextResponse } from 'next/server';
import { Priority, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getRequestUser } from '@/lib/api';
import { taskVisibilityWhere } from '@/lib/auth';
import { beijingMonthKey } from '@/lib/beijing-date';

export async function GET(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) return NextResponse.json({ error: '请先登录', code: 'auth.unauthorized' }, { status: 401 });

  const monthParam = request.nextUrl.searchParams.get('month') || beijingMonthKey();
  const month = /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : beijingMonthKey();
  const assigneeId = request.nextUrl.searchParams.get('assigneeId') || 'all';
  const priorityParam = request.nextUrl.searchParams.get('priority') || 'all';
  const priority = Object.values(Priority).includes(priorityParam as Priority) ? (priorityParam as Priority) : 'all';
  const keyword = (request.nextUrl.searchParams.get('keyword') || '').trim();

  const where: Prisma.TaskWhereInput = {
    date: { gte: `${month}-01`, lte: `${month}-31` },
    deletedAt: null,
    ...(assigneeId !== 'all' ? { assigneeId } : {}),
    ...(priority !== 'all' ? { priority } : {}),
    ...(keyword ? { OR: [{ title: { contains: keyword, mode: 'insensitive' as const } }, { note: { contains: keyword, mode: 'insensitive' as const } }] } : {}),
    ...taskVisibilityWhere(user),
  };

  const tasks = await prisma.task.findMany({
    where,
    select: { date: true, completedAt: true },
  });
  const stats = new Map<string, { date: string; total: number; done: number }>();
  tasks.forEach((task) => {
    const stat = stats.get(task.date) || { date: task.date, total: 0, done: 0 };
    stat.total += 1;
    if (task.completedAt) stat.done += 1;
    stats.set(task.date, stat);
  });
  const monthTotal = tasks.length;
  const monthDone = tasks.filter((task) => task.completedAt).length;
  return NextResponse.json({
    days: Array.from(stats.values()),
    monthTotal,
    monthCompletion: monthTotal ? Math.round((monthDone / monthTotal) * 100) : 0,
  });
}
