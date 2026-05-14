import { ALL_PERMISSIONS, type Permission, type Role } from '@/lib/permissions';
import { AddMemberForm, MemberEditForm, ResetPasswordForm } from '@/components/management-forms';

type ManageUser = {
  id: string;
  name: string;
  loginName?: string | null;
  role: Role;
  active: boolean;
  permissions: string[];
  createdAt?: Date;
};

type AuditLogItem = {
  id: string;
  action: string;
  createdAt: Date;
  user?: { name: string } | null;
  task?: { title: string } | null;
};

type TopAssignee = { user?: ManageUser; count: number } | undefined;

const ROLE_LABELS: Record<Role, string> = {
  MEMBER: '成员',
  ADMIN: '管理员',
};

const PERMISSION_LABELS: Record<Permission, string> = {
  'task.create': '创建事项',
  'task.assign': '指派他人',
  'task.view_all': '查看团队事项',
  'announcement.create': '发布公告',
  'user.manage': '管理人员',
  'permission.manage': '管理权限',
};

const ACTION_LABELS: Record<string, string> = {
  'task.create': '创建事项',
  'task.update': '更新事项',
  'task.delete': '删除事项',
  'task.complete': '完成事项',
  'task.reopen': '取消完成',
  'announcement.create': '发布公告',
  'announcement.delete': '删除公告',
  'user.create': '新增成员',
  'user.approve': '通过审核',
  'user.disable': '停用人员',
  'user.update': '更新人员',
  'user.approve_configured': '审核并配置成员',
  'password.reset': '重置密码',
};

function roleLabel(role?: string | null) {
  return ROLE_LABELS[(role || 'MEMBER') as Role] || '成员';
}

function permissionLabel(permission: Permission) {
  return PERMISSION_LABELS[permission] || permission;
}

function actionLabel(action: string) {
  return ACTION_LABELS[action] || '系统操作';
}

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

const permissionOptions = ALL_PERMISSIONS.map((p) => ({ value: p, label: permissionLabel(p) }));

export function ManageHero({ personal = false }: { personal?: boolean }) {
  return (
    <section className="manageHero workspaceCard">
      <div>
        <span className="sectionLabel">{personal ? 'ACCOUNT' : 'MANAGE'}</span>
        <h1>{personal ? '我的' : '管理中心'}</h1>
        <p>{personal ? '这里放账号设置和登录密码修改。日常事项仍在首页处理。' : '人员、权限、公告和审计日志集中在这里。手机端首页只保留高频事项操作。'}</p>
      </div>
      <a className="heroButton manageBackButton" href="/">返回今日事项</a>
    </section>
  );
}

export function TeamOverview({ users, activeUsers, pendingUsers, topAssignee }: { users: ManageUser[]; activeUsers: ManageUser[]; pendingUsers: ManageUser[]; topAssignee: TopAssignee }) {
  return (
    <div className="workspaceCard insightCard">
      <h2>团队概览</h2>
      <div className="insightList">
        <div><span>最忙负责人</span><b>{topAssignee?.user?.name || '暂无'}</b><em>{topAssignee?.count || 0} 个待办</em></div>
        <div><span>团队人数</span><b>{activeUsers.length}</b><em>启用账号</em></div>
        <div><span>待审核/停用</span><b>{pendingUsers.length}</b><em>可在下方启用</em></div>
        <div><span>管理员</span><b>{users.filter((u) => u.role === 'ADMIN').length}</b><em>拥有全部权限</em></div>
      </div>
    </div>
  );
}

export function PendingMembers({ users, canManagePermissions }: { users: ManageUser[]; canManagePermissions: boolean }) {
  if (users.length === 0) return null;
  return (
    <div className="workspaceCard approvalCard">
      <div className="sectionHead"><div><span className="sectionLabel">ACCESS</span><h2>待审核成员</h2></div><span>{users.length} 人</span></div>
      <div className="approvalList">
        {users.map((user) => (
          <MemberEditForm key={user.id} user={{ id: user.id, name: user.name, loginName: user.loginName, role: user.role, active: true, permissions: user.permissions }} permissions={permissionOptions} canManagePermissions={canManagePermissions} compactApprove />
        ))}
      </div>
    </div>
  );
}

export function MemberManagementPanel({ users, currentUserId, canManagePermissions }: { users: ManageUser[]; currentUserId: string; canManagePermissions: boolean }) {
  return (
    <section className="workspaceCard peopleCard" id="members">
      <div className="sectionHead"><div><span className="sectionLabel">MEMBERS</span><h2>人员与权限</h2></div><span>{users.length} 人</span></div>
      <div className="users modernUsers">
        {users.map((user) => {
          const isCurrentUser = user.id === currentUserId;
          const isProtectedAdmin = user.role === 'ADMIN';
          const protectedReason = isCurrentUser ? '当前登录账号受保护' : '唯一管理员账号受保护';
          const protectedCopy = isCurrentUser
            ? '不能在人员与权限里修改自己的角色、权限或启用状态，避免误把唯一管理员降级后失去管理入口。需要改密码请使用“我的账号”。'
            : '系统只保留一个管理员账号。管理员不参与普通成员权限调整，避免被误停用或降级。';
          return (
          <details key={user.id} className={cn('userEditCard modernUserRow memberCollapseCard', !user.active && 'pendingUserRow')}>
            <summary className="memberCollapseSummary">
              <span className="avatar">{user.name.slice(0, 1)}</span>
              <span className="memberSummaryText">
                <b>{user.name}{isCurrentUser ? '（当前账号）' : ''}</b>
                <small>{user.active ? '已启用' : '待审核'} · {roleLabel(user.role)} · {user.loginName ? `账号 ${user.loginName}` : '未设置登录账号'} · 额外权限 {user.permissions.length}</small>
              </span>
              <span className="manageHint">{isCurrentUser || isProtectedAdmin ? '受保护' : '展开管理'}</span>
            </summary>
            <div className="memberEditBody">
              {isCurrentUser || isProtectedAdmin ? (
                <div className="selfProtectedBox">
                  <b>{protectedReason}</b>
                  <p>{protectedCopy}</p>
                </div>
              ) : (
                <>
                  <MemberEditForm user={{ id: user.id, name: user.name, loginName: user.loginName, role: user.role, active: user.active, permissions: user.permissions }} permissions={permissionOptions} canManagePermissions={canManagePermissions} />
                  <details className="resetPasswordBox">
                    <summary>重置登录密码</summary>
                    <ResetPasswordForm user={{ id: user.id, name: user.name }} />
                  </details>
                </>
              )}
            </div>
          </details>
        );})}
      </div>
    </section>
  );
}

export function ManageSidePanel({ canManageUsers, canManagePermissions, auditLogs }: { canManageUsers: boolean; canManagePermissions: boolean; auditLogs: AuditLogItem[] }) {
  return (
    <aside className="sideStack">
      {canManageUsers && (
        <details className="workspaceCard addMemberCard collapsibleToolCard" open>
          <summary className="toolSummary"><span><b>新增成员</b><small>管理员操作</small></span><em>展开</em></summary>
          <div className="toolBody">
            <AddMemberForm canManagePermissions={canManagePermissions} permissions={permissionOptions} />
            <p className="formHint">新增后把网址、登录账号和初始密码发给成员。</p>
          </div>
        </details>
      )}

      <section className="workspaceCard timelineCard" id="audit">
        <div className="sectionHead"><div><span className="sectionLabel">AUDIT</span><h2>最近操作</h2></div><span>{auditLogs.length} 条</span></div>
        <div className="modernTimeline">
          {auditLogs.map((log) => (
            <article key={log.id}>
              <b>{actionLabel(log.action)}</b>
              <span>{log.user?.name || '系统'} · {new Date(log.createdAt).toLocaleString('zh-CN')}</span>
              {log.task && <small>{log.task.title}</small>}
            </article>
          ))}
          {auditLogs.length === 0 && <div className="announcementEmpty">暂无操作记录。</div>}
        </div>
      </section>
    </aside>
  );
}

export function MobileBottomNav({ active }: { active: 'home' | 'manage' }) {
  return (
    <nav className="mobileBottomNav compactMobileBottomNav" aria-label="移动端导航">
      <a className={active === 'home' ? 'active' : undefined} href="/">今日</a>
      <a className={active === 'manage' ? 'active' : undefined} href="/manage">管理</a>
    </nav>
  );
}
