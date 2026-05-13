import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { beijingDateKey } from '@/lib/beijing-date';
import { isSessionFreshForUser, verifySessionToken } from '@/lib/session';
import { canActOnTask, canCreateAnnouncement, canCreateTask, canDeleteAnnouncement, canManageUsers, taskVisibilityWhere } from '@/lib/auth';
import { TaskFocusPanel } from '@/components/task-focus-panel';
import { WorkCalendar } from '@/components/work-calendar';
import { TaskCreateForm } from '@/components/task-create-form';
import { AnnouncementList } from '@/components/announcement-list';
import { HomeHero } from '@/components/home-hero';
import { MobileBottomNav } from '@/components/manage-panels';
import { PwaInstallBanner } from '@/components/pwa-install-banner';
import { addDays, dateLabel, PRIORITY_OPTIONS, QUICK_NOTES, relativeDay, roleLabel, taskPriorityMeta, type PriorityValue } from '@/lib/home-ui';

export const dynamic = 'force-dynamic';

type Params = { date?: string; userId?: string; status?: string; assigneeId?: string; priority?: string; keyword?: string; error?: string; ok?: string; overdue?: string };

const ERROR_MESSAGES: Record<string, string> = {
  'task.create.forbidden': '没有权限创建事项。',
  'task.assign.forbidden': '没有权限指派给他人。',
  'task.update.forbidden': '没有权限编辑该事项。',
  'task.delete.forbidden': '没有权限删除事项。',
  'task.complete.forbidden': '没有权限完成该事项。',
  'task.not_found': '事项不存在或已被删除。',
  'user.manage.forbidden': '没有权限管理人员。',
  'user.not_found': '人员不存在。',
  'announcement.create.forbidden': '没有权限发布公告。',
  'announcement.delete.forbidden': '没有权限删除公告。',
  'announcement.not_found': '公告不存在或已被删除。',
  'validation.failed': '表单内容不完整或格式不正确，请检查后重试。',
  'server.error': '操作失败，请稍后重试。',
  'password.validation.failed': '请完整填写旧密码和新密码，新密码至少 6 位，确认密码要一致。',
  'password.current.failed': '旧密码不正确，请重新输入。',
  'password.same': '新密码不能和旧密码相同。',
  'password.reset.validation.failed': '重置密码失败：新密码至少 6 位，且两次输入需要一致。',
  'password.reset.self.forbidden': '不能在成员管理里重置自己的密码，请使用账号设置里的修改密码。',
};

const OK_MESSAGES: Record<string, string> = {
  'task.created': '事项已创建。',
  'task.updated': '事项已更新。',
  'task.deleted': '事项已删除。',
  'task.completed': '事项已完成。',
  'task.reopened': '事项已取消完成。',
  'user.created': '成员已新增。',
  'user.approved': '成员已通过审核。',
  'user.disabled': '成员已停用。',
  'user.update': '人员信息已更新。',
  'announcement.created': '公告已发布。',
  'announcement.deleted': '公告已删除。',
  'password.reset': '成员密码已重置，请把新密码单独告知对方。',
};

export default async function Home({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const session = verifySessionToken((await cookies()).get('daily_notes_session')?.value);
  if (!session?.userId) redirect('/login?error=auth.required');
  const date = params.date || beijingDateKey();
  const status = params.status || 'all';
  const assigneeId = params.assigneeId || 'all';
  const priority = PRIORITY_OPTIONS.some((item) => item.value === params.priority) ? params.priority as PriorityValue : 'all';
  const keyword = (params.keyword || '').trim();
  const overdueMode = params.overdue === '1';
  const todayKey = beijingDateKey();
  const currentUser = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!currentUser || !currentUser.active || !isSessionFreshForUser(session, currentUser.sessionVersion)) redirect('/login?error=auth.required');
  const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  const activeUsers = users.filter((u) => u.active);
  const assignableUsers = canManageUsers(currentUser) ? activeUsers : activeUsers.filter((u) => u.id === currentUser.id);
  const currentUserCanManageUsers = canManageUsers(currentUser);
  const isPlainMember = !currentUserCanManageUsers && !canCreateAnnouncement(currentUser);

  const taskWhere: Record<string, unknown> = overdueMode
    ? { date: { lt: todayKey }, completedAt: null, deletedAt: null, ...taskVisibilityWhere(currentUser) }
    : { date, deletedAt: null, ...taskVisibilityWhere(currentUser) };
  if (!overdueMode) {
    if (status === 'todo') taskWhere.completedAt = null;
    if (status === 'done') taskWhere.completedAt = { not: null };
  }
  if (assigneeId !== 'all') taskWhere.assigneeId = assigneeId;
  if (priority !== 'all') taskWhere.priority = priority;
  if (keyword) {
    taskWhere.OR = [
      { title: { contains: keyword, mode: 'insensitive' } },
      { note: { contains: keyword, mode: 'insensitive' } },
    ];
  }

  const [tasks, allVisibleTasks, monthTasks, announcements] = await Promise.all([
    prisma.task.findMany({
      where: taskWhere,
      include: { creator: true, assignee: true, completedBy: true },
      orderBy: overdueMode ? [{ date: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }] : [{ completedAt: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.task.findMany({
      where: { date, deletedAt: null, ...taskVisibilityWhere(currentUser) },
      include: { assignee: true },
      orderBy: [{ completedAt: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.task.findMany({
      where: {
        date: { gte: `${date.slice(0, 7)}-01`, lte: `${date.slice(0, 7)}-31` },
        deletedAt: null,
        ...taskVisibilityWhere(currentUser),
      },
      select: { date: true, completedAt: true },
    }),
    prisma.announcement.findMany({
      where: { deletedAt: null },
      take: 4,
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      include: { author: true },
    }),
  ]);

  const total = allVisibleTasks.length;
  const done = allVisibleTasks.filter((t) => t.completedAt).length;
  const todo = total - done;
  const overdueCount = await prisma.task.count({ where: { date: { lt: todayKey }, completedAt: null, deletedAt: null, ...taskVisibilityWhere(currentUser) } });
  const completion = total ? Math.round((done / total) * 100) : 0;
  const mine = allVisibleTasks.filter((t) => t.assigneeId === currentUser?.id || t.creatorId === currentUser?.id).length;
  const dayStats = new Map<string, { total: number; done: number }>();
  monthTasks.forEach((task) => {
    const stat = dayStats.get(task.date) || { total: 0, done: 0 };
    stat.total += 1;
    if (task.completedAt) stat.done += 1;
    dayStats.set(task.date, stat);
  });
  const monthTotal = monthTasks.length;
  const monthDone = monthTasks.filter((task) => task.completedAt).length;
  const monthCompletion = monthTotal ? Math.round((monthDone / monthTotal) * 100) : 0;
  const calendarStats = Array.from(dayStats.entries()).map(([statDate, stat]) => ({ date: statDate, total: stat.total, done: stat.done }));
  const dateNavHref = (targetDate: string) => {
    const next = new URLSearchParams({ date: targetDate, status, assigneeId, priority });
    if (keyword) next.set('keyword', keyword);
    return `?${next.toString()}`;
  };
  const quickFilterHref = (nextStatus: 'all' | 'todo', nextAssigneeId: string) => {
    const next = new URLSearchParams({ date, status: nextStatus, assigneeId: nextAssigneeId, priority });
    if (keyword) next.set('keyword', keyword);
    return `?${next.toString()}`;
  };
  const quickFilterActive = assigneeId === currentUser.id ? 'mine' : status === 'todo' && assigneeId === 'all' ? 'todo' : 'all';
  const previousDate = addDays(date, -1);
  const nextDate = addDays(date, 1);

  const errorMessage = params.error ? ERROR_MESSAGES[params.error] || '操作失败，请重试。' : '';
  const okMessage = params.ok ? OK_MESSAGES[params.ok] || '操作成功。' : '';

  return (
    <main className="shell">
      <HomeHero
        currentUserName={currentUser.name}
        roleLabel={roleLabel(currentUser.role)}
        todayHref={`?date=${todayKey}&status=all&assigneeId=all`}
        settingsHref="/manage#account-settings"
        isPlainMember={isPlainMember}
        date={date}
        dateText={dateLabel(date)}
        relativeText={relativeDay(date, todayKey)}
        previousHref={dateNavHref(previousDate)}
        currentHref={dateNavHref(date)}
        nextHref={dateNavHref(nextDate)}
        todayLinkHref={date !== todayKey ? dateNavHref(todayKey) : undefined}
        quickFilterActive={quickFilterActive}
        allHref={quickFilterHref('all', 'all')}
        mineHref={quickFilterHref('all', currentUser.id)}
        todoHref={quickFilterHref('todo', 'all')}
        completion={completion}
        total={total}
        todo={todo}
        mine={mine}
      />

      <PwaInstallBanner />


      {canCreateTask(currentUser) && (
        <TaskCreateForm
          className="workspaceCard mobileQuickCreate priorityCard"
          title="快速记一条"
          badge="手机优先"
          date={date}
          currentUserId={currentUser.id}
          assignableUsers={assignableUsers.map((u) => ({ id: u.id, name: u.name }))}
          priorityOptions={PRIORITY_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
        />
      )}

      <section className="contentGrid">
        <div className="mainStack announcementTaskStack">
          <AnnouncementList announcements={announcements.map((item) => ({ ...item, canDelete: canDeleteAnnouncement(currentUser, item) }))} />

        <TaskFocusPanel
        initialStatus={overdueMode ? 'overdue' : (status as 'all' | 'todo' | 'done')}
        initialSearch={`?date=${date}&assigneeId=${assigneeId}&priority=${priority}&keyword=${encodeURIComponent(keyword)}${overdueMode ? '&overdue=1' : ''}`}
        todayKey={todayKey}
        currentUserName={currentUser.name}
        currentUserRoleLabel={roleLabel(currentUser.role)}
        currentUserId={currentUser.id}
        assignableUsers={assignableUsers.map((u) => ({ id: u.id, name: u.name }))}
        priorityOptions={PRIORITY_OPTIONS.map((item) => ({ value: item.value, label: item.label, hint: item.hint }))}
        tasks={tasks.map((task) => {
          const meta = taskPriorityMeta(task.priority);
          return {
          id: task.id,
          title: task.title,
          note: task.note || '',
          date: task.date,
          priority: task.priority,
          assigneeId: task.assigneeId,
          completedAt: task.completedAt ? task.completedAt.toISOString() : null,
          creatorName: task.creator.name,
          assigneeName: task.assignee.name,
          completedByName: task.completedBy?.name || null,
          createdAtLabel: new Date(task.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
          priorityLabel: meta.label,
          priorityClass: meta.className,
          isMine: task.assigneeId === currentUser.id,
          canComplete: canActOnTask(currentUser, task, 'complete'),
          canDelete: canActOnTask(currentUser, task, 'delete'),
          canEdit: canActOnTask(currentUser, task, 'edit'),
          };
        })}
        overdueTasks={tasks.filter((task) => !task.completedAt && task.date < todayKey).map((task) => {
          const meta = taskPriorityMeta(task.priority);
          return {
          id: task.id,
          title: task.title,
          note: task.note || '',
          date: task.date,
          priority: task.priority,
          assigneeId: task.assigneeId,
          completedAt: task.completedAt ? task.completedAt.toISOString() : null,
          creatorName: task.creator.name,
          assigneeName: task.assignee.name,
          completedByName: task.completedBy?.name || null,
          createdAtLabel: new Date(task.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
          priorityLabel: meta.label,
          priorityClass: meta.className,
          isMine: task.assigneeId === currentUser.id,
          canComplete: canActOnTask(currentUser, task, 'complete'),
          canDelete: canActOnTask(currentUser, task, 'delete'),
          canEdit: canActOnTask(currentUser, task, 'edit'),
          };
        })}
      />
        </div>

        <aside className="sideStack">
          {canCreateTask(currentUser) && (
            <TaskCreateForm
              className="workspaceCard createCard priorityCard"
              title="快速新增"
              badge="优先操作"
              date={date}
              currentUserId={currentUser.id}
              assignableUsers={assignableUsers.map((u) => ({ id: u.id, name: u.name }))}
              priorityOptions={PRIORITY_OPTIONS.map((item) => ({ value: item.value, label: item.label, hint: item.hint, short: item.short, className: item.className }))}
              showPriorityPalette
              quickNotes={QUICK_NOTES}
            />
          )}

          {!isPlainMember && (
            <WorkCalendar
              initialDate={date}
              initialStats={calendarStats}
              initialMonthTotal={monthTotal}
              initialMonthCompletion={monthCompletion}
              assigneeId={assigneeId}
              priority={priority}
              keyword={keyword}
            />
          )}

        </aside>
      </section>

      <MobileBottomNav active="home" />

      <footer className="pageFooter">
        <small>每日事项工作台 · 今日日期 {todayKey}</small>
      </footer>
    </main>
  );
}
