import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { isSessionFreshForUser, verifySessionToken } from '@/lib/session';
import { canCreateAnnouncement, canManagePermissions, canManageUsers } from '@/lib/auth';
import { ManageHero, ManageSidePanel, MemberManagementPanel, MobileBottomNav, PendingMembers, TeamOverview } from '@/components/manage-panels';
import { AnnouncementPublishForm } from '@/components/management-forms';

export const dynamic = 'force-dynamic';

type Params = { error?: string; ok?: string };

const ERROR_MESSAGES: Record<string, string> = {
  'user.manage.forbidden': '没有权限管理人员。',
  'user.not_found': '人员不存在。',
  'user.self_update.forbidden': '不能在人员与权限里修改自己的角色、权限或启用状态，请至少保留一个管理员账号。',
  'user.admin_protected.forbidden': '唯一管理员账号受保护，不能在人员与权限里修改。',
  'user.admin_singleton.forbidden': '系统只保留一个管理员，其他账号请使用普通成员身份。',
  'permission.manage.forbidden': '没有权限修改角色。',
  'announcement.create.forbidden': '没有权限发布公告。',
  'announcement.delete.forbidden': '没有权限删除公告。',
  'announcement.not_found': '公告不存在或已被删除。',
  'validation.failed': '表单内容不完整或格式不正确，请检查后重试。',
  'password.reset.validation.failed': '重置密码失败：新密码至少 6 位，且两次输入需要一致。',
  'password.reset.self.forbidden': '不能在成员管理里重置自己的密码，请使用账号设置里的修改密码。',
  'server.error': '操作失败，请稍后重试。',
};

const OK_MESSAGES: Record<string, string> = {
  'user.created': '成员已新增。',
  'user.approved': '成员已通过审核。',
  'user.disabled': '成员已停用。',
  'user.update': '人员信息已更新。',
  'announcement.created': '公告已发布。',
  'announcement.deleted': '公告已删除。',
  'password.reset': '成员密码已重置，请把新密码单独告知对方。',
  'password.changed': '密码已修改，请重新登录。',
};

export default async function ManagePage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const session = verifySessionToken((await cookies()).get('daily_notes_session')?.value);
  if (!session?.userId) redirect('/login?error=auth.required&redirectTo=/manage');

  const currentUser = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!currentUser || !currentUser.active || !isSessionFreshForUser(session, currentUser.sessionVersion)) redirect('/login?error=auth.required&redirectTo=/manage');

  const currentUserCanManageUsers = canManageUsers(currentUser);
  const currentUserCanManagePermissions = canManagePermissions(currentUser);
  const currentUserCanCreateAnnouncement = canCreateAnnouncement(currentUser);

  const [users, auditLogs, activeTaskCounts] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.auditLog.findMany({ take: 16, orderBy: { createdAt: 'desc' }, include: { user: true, task: true } }),
    prisma.task.groupBy({ by: ['assigneeId'], where: { completedAt: null, deletedAt: null }, _count: { _all: true } }),
  ]);

  const activeUsers = users.filter((u) => u.active);
  const pendingUsers = users.filter((u) => !u.active);
  const topAssignee = activeTaskCounts
    .map((item) => ({ user: users.find((u) => u.id === item.assigneeId), count: item._count._all }))
    .filter((item) => item.user)
    .sort((a, b) => b.count - a.count)[0];
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] || '操作失败，请重试。' : '';
  const okMessage = params.ok ? OK_MESSAGES[params.ok] || '操作成功。' : '';

  return (
    <main className="shell manageShell">
      <ManageHero personal={!currentUserCanManageUsers && !currentUserCanCreateAnnouncement} />
      {errorMessage && <div className="notice error floatingNotice">{errorMessage}</div>}
      {okMessage && <div className="notice success floatingNotice">{okMessage}</div>}

      <section className="manageGrid">
        <div className="mainStack">
          {currentUserCanCreateAnnouncement && (
            <details id="notices" className="workspaceCard announcementCard publishNoticeCard managePublishCard collapsibleToolCard" open>
              <summary className="toolSummary"><span><b>发布公告</b><small>通知团队</small></span><em>展开</em></summary>
              <AnnouncementPublishForm />
            </details>
          )}
          <details id="account-settings" className="workspaceCard manageAccountCard collapsibleToolCard" open>
            <summary className="toolSummary"><span><b>我的账号</b><small>修改自己的登录密码</small></span><em>展开</em></summary>
            <div className="toolBody">
              <form className="passwordForm" action="/api/auth/change-password" method="post">
                <label>旧密码<input name="currentPassword" type="password" autoComplete="current-password" required /></label>
                <label>新密码<input name="newPassword" type="password" autoComplete="new-password" minLength={6} required /></label>
                <label>确认新密码<input name="confirmPassword" type="password" autoComplete="new-password" minLength={6} required /></label>
                <input type="hidden" name="redirectTo" value="/manage" />
                <button className="fullButton">修改密码</button>
              </form>
              <p className="formHint">当前登录：{currentUser.name}。修改成功后会退出登录，请用新密码重新进入。</p>
            </div>
          </details>
          {currentUserCanManageUsers && <TeamOverview users={users} activeUsers={activeUsers} pendingUsers={pendingUsers} topAssignee={topAssignee} />}
          {currentUserCanManageUsers && <PendingMembers users={pendingUsers} canManagePermissions={currentUserCanManagePermissions} />}
          {currentUserCanManageUsers && <MemberManagementPanel users={users} currentUserId={currentUser.id} canManagePermissions={currentUserCanManagePermissions} />}
        </div>

        {(currentUserCanManageUsers || currentUserCanCreateAnnouncement) && (
          <ManageSidePanel canManageUsers={currentUserCanManageUsers} canManagePermissions={currentUserCanManagePermissions} auditLogs={auditLogs} />
        )}
      </section>

      <MobileBottomNav active="manage" />
    </main>
  );
}
