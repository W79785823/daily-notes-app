import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { isSessionFreshForUser, verifySessionToken } from '@/lib/session';
import { AdminTeamActionForm } from '@/components/admin-team-action-form';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES: Record<string, string> = {
  'admin.forbidden': '没有平台管理权限。',
  'user.not_found': '用户不存在。',
  'team.not_found': '团队不存在。',
  'validation.failed': '表单内容不完整或格式不正确。',
};

const OK_MESSAGES: Record<string, string> = {
  'team.suspended': '团队已停用。',
  'team.reactivated': '团队已恢复。',
  'password.reset': '成员密码已重置。',
};

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const params = await searchParams;
  const session = verifySessionToken((await cookies()).get('daily_notes_session')?.value);
  if (!session?.userId) redirect('/login?error=auth.required&redirectTo=/admin');
  const currentUser = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!currentUser?.active || !currentUser.isSuperAdmin || !isSessionFreshForUser(session, currentUser.sessionVersion)) redirect('/login?error=auth.required&redirectTo=/admin');

  const teams = await prisma.team.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      users: { orderBy: { createdAt: 'asc' } },
    },
  });
  const errorMessage = params.error ? ERROR_MESSAGES[params.error] || '操作失败，请重试。' : '';
  const okMessage = params.ok ? OK_MESSAGES[params.ok] || '操作成功。' : '';

  return (
    <main className="shell manageShell">
      <section className="manageHero workspaceCard">
        <div>
          <span className="sectionLabel">平台管理</span>
          <h1>平台管理</h1>
          <p>查看团队、停用或恢复使用权，并为成员重置登录密码。</p>
        </div>
        <a className="heroButton manageBackButton" href="/">返回今日事项</a>
      </section>
      {errorMessage && <div className="notice error floatingNotice">{errorMessage}</div>}
      {okMessage && <div className="notice success floatingNotice">{okMessage}</div>}
      <section className="mainStack">
        {teams.map((team) => (
          <article key={team.id} className="workspaceCard peopleCard">
            <div className="sectionHead">
              <div><span className="sectionLabel">{team.active ? '使用中' : '已停用'}</span><h2>{team.name}</h2><small>负责人：{team.users.find((user) => user.id === team.ownerId)?.name || '未设置'}</small></div>
              <span>{team.users.length} 人</span>
            </div>
            <AdminTeamActionForm teamId={team.id} teamName={team.name} active={team.active} />
            <div className="users modernUsers">
              {team.users.map((user) => (
                <details key={user.id} className="userEditCard modernUserRow memberCollapseCard">
                  <summary className="memberCollapseSummary">
                    <span className="avatar">{user.name.slice(0, 1)}</span>
                    <span className="memberSummaryText"><b>{user.name}</b><small>{user.loginName || '未设置账号'} · {user.active ? '已启用' : '已停用'}</small></span>
                    <span className="manageHint">重置密码</span>
                  </summary>
                  <form className="resetPasswordForm" action={`/api/admin/users/${user.id}/reset-password`} method="post">
                    <label>新密码<input name="newPassword" type="password" minLength={6} required /></label>
                    <label>确认新密码<input name="confirmPassword" type="password" minLength={6} required /></label>
                    <button className="smallWarningButton">重置密码</button>
                  </form>
                </details>
              ))}
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
