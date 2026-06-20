'use client';

import { FormEvent, useEffect, useState } from 'react';

type PermissionOption = { value: string; label: string };
type PermissionGroup = { title: string; hint: string; values: string[] };
type UserRow = { id: string; name: string; loginName?: string | null; role: string; active: boolean; permissions: string[] };
type InviteRow = { id: string; code: string; joinUrl: string; expiresAt?: string | null; maxUses: number; usedCount: number; createdAt?: string };

const permissionGroups: PermissionGroup[] = [
  { title: '事项权限', hint: '控制事项创建、团队事项查看和指派；自己负责的事项默认可完成，自己创建的事项默认可编辑、可删除', values: ['task.create', 'task.assign', 'task.view_all'] },
  { title: '人员权限', hint: '控制成员新增、停用和权限配置', values: ['user.manage', 'permission.manage'] },
  { title: '公告权限', hint: '用于发布团队公告和置顶提醒', values: ['announcement.create'] },
];

function groupedPermissions(permissions: PermissionOption[]) {
  const byValue = new Map(permissions.map((permission) => [permission.value, permission]));
  const grouped = permissionGroups
    .map((group) => ({ ...group, permissions: group.values.map((value) => byValue.get(value)).filter(Boolean) as PermissionOption[] }))
    .filter((group) => group.permissions.length > 0);
  const groupedValues = new Set(permissionGroups.flatMap((group) => group.values));
  const other = permissions.filter((permission) => !groupedValues.has(permission.value));
  return other.length > 0 ? [...grouped, { title: '其他权限', hint: '系统预留的额外能力', values: other.map((p) => p.value), permissions: other }] : grouped;
}

type AnnouncementFormProps = {
  className?: string;
};

function readJsonError(payload: any, fallback: string) {
  return String(payload?.error || payload?.message || fallback);
}

function inviteExpiresAt(value: FormDataEntryValue | null) {
  const option = String(value || '7d');
  if (option === 'never') return null;
  const days = option === '1d' ? 1 : option === '30d' ? 30 : 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function inviteStillUsable(invite: InviteRow) {
  const notUsedUp = invite.usedCount < invite.maxUses;
  const notExpired = !invite.expiresAt || new Date(invite.expiresAt).getTime() > Date.now();
  return notUsedUp && notExpired;
}

function expiryText(invite: InviteRow) {
  if (!invite.expiresAt) return '永久有效';
  return `有效至 ${new Date(invite.expiresAt).toLocaleDateString('zh-CN')}`;
}

export function AnnouncementPublishForm({ className = 'announcementForm toolBody' }: AnnouncementFormProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          title: String(formData.get('title') || ''),
          content: String(formData.get('content') || ''),
          pinned: formData.get('pinned') === 'on',
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readJsonError(payload, '发布失败'));
      form.reset();
      setMessage('公告已发布，页面位置已保留。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '发布失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className={className} onSubmit={submit}>
      <input name="title" placeholder="公告标题" required />
      <textarea name="content" placeholder="公告内容" required />
      <label className="inlineCheck"><input type="checkbox" name="pinned" />置顶公告</label>
      {message && <div className="inlineTaskNotice">{message}</div>}
      {error && <div className="inlineTaskNotice error">{error}</div>}
      <button className="fullButton noticeButton" disabled={busy}>{busy ? '发布中…' : '发布公告'}</button>
    </form>
  );
}

type AddMemberFormProps = {
  canManagePermissions: boolean;
  permissions: PermissionOption[];
};

export function AddMemberForm({ canManagePermissions, permissions }: AddMemberFormProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          name: String(formData.get('name') || ''),
          loginName: String(formData.get('loginName') || ''),
          password: String(formData.get('password') || ''),
          role: 'MEMBER',
          permissions: formData.getAll('permissions').map(String),
          active: true,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readJsonError(payload, '新增失败'));
      form.reset();
      setMessage(`已新增成员：${payload?.user?.name || '成员'}。刷新后会出现在人员列表。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '新增失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="addMemberForm" onSubmit={submit}>
      <input name="name" placeholder="成员姓名" required />
      <input name="loginName" placeholder="登录账号" required />
      <input name="password" type="text" placeholder="初始密码" required />
      <input type="hidden" name="role" value="MEMBER" />
      <div className="roleExplainCard addMemberRoleNote">
        <span>普通成员</span>
        <small>每个团队只保留当前负责人为管理员，新成员默认都是普通成员，可按需勾选额外协作权限。</small>
      </div>
      {canManagePermissions && (
        <details className="approvalPermissionBox addMemberPermissionBox">
          <summary>额外权限</summary>
          <div className="checks modernChecks">{permissions.map((p) => <label key={p.value}><input type="checkbox" name="permissions" value={p.value} />{p.label}</label>)}</div>
        </details>
      )}
      {message && <div className="inlineTaskNotice">{message}</div>}
      {error && <div className="inlineTaskNotice error">{error}</div>}
      <button className="fullButton" disabled={busy}>{busy ? '新增中…' : '新增成员'}</button>
    </form>
  );
}

export function InviteMemberForm({ canManagePermissions, permissions }: AddMemberFormProps) {
  const [busy, setBusy] = useState(false);
  const [joinUrl, setJoinUrl] = useState('');
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [copied, setCopied] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/invites', { headers: { Accept: 'application/json' } })
      .then((response) => response.json().then((payload) => ({ response, payload })).catch(() => ({ response, payload: {} })))
      .then(({ response, payload }) => {
        if (!active) return;
        if (!response.ok) throw new Error(readJsonError(payload, '邀请列表加载失败'));
        setInvites(Array.isArray(payload.invites) ? payload.invites : []);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : '邀请列表加载失败');
      });
    return () => {
      active = false;
    };
  }, []);

  const copyInvite = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(id);
      window.setTimeout(() => setCopied((current) => current === id ? '' : current), 1800);
    } catch {
      setError('复制失败，请手动选中链接复制。');
    }
  };

  const revokeInvite = async (invite: InviteRow) => {
    if (!window.confirm('确定撤销这条邀请链接吗？撤销后对方将无法继续使用该链接加入。')) return;
    const response = await fetch(`/api/invites/${invite.code}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(readJsonError(payload, '撤销邀请失败'));
      return;
    }
    setInvites((items) => items.map((item) => item.id === invite.id ? { ...item, usedCount: item.maxUses } : item));
    setCopied('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setBusy(true);
    setJoinUrl('');
    setError('');
    try {
      const response = await fetch('/api/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          role: 'MEMBER',
          maxUses: Number(formData.get('maxUses') || 1),
          expiresAt: inviteExpiresAt(formData.get('expiresIn')),
          permissions: formData.getAll('permissions').map(String),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readJsonError(payload, '邀请创建失败'));
      setJoinUrl(String(payload.joinUrl || ''));
      if (payload.invite) setInvites((items) => [{ ...payload.invite, joinUrl: payload.joinUrl }, ...items]);
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : '邀请创建失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="inviteMemberForm" onSubmit={submit}>
      <label>可用次数<input name="maxUses" type="number" min={1} max={100} defaultValue={1} /></label>
      <label>有效期<select name="expiresIn" defaultValue="7d"><option value="1d">1 天</option><option value="7d">7 天</option><option value="30d">30 天</option><option value="never">永久</option></select></label>
      {canManagePermissions && (
        <details className="approvalPermissionBox addMemberPermissionBox">
          <summary>邀请成员默认权限</summary>
          <div className="checks modernChecks">{permissions.map((p) => <label key={p.value}><input type="checkbox" name="permissions" value={p.value} />{p.label}</label>)}</div>
        </details>
      )}
      {joinUrl && (
        <div className="inviteResultBox">
          <b>邀请链接</b>
          <div className="copyRow">
            <input readOnly value={joinUrl} onFocus={(event) => event.currentTarget.select()} />
            <button type="button" className="copyInviteButton" onClick={() => copyInvite(joinUrl, 'latest')}>{copied === 'latest' ? '已复制' : '复制'}</button>
          </div>
        </div>
      )}
      <div className="activeInviteList">
        <div className="activeInviteHead"><b>有效邀请</b><small>{invites.filter(inviteStillUsable).length} 条可用</small></div>
        {invites.filter(inviteStillUsable).map((invite) => (
          <article key={invite.id} className="activeInviteItem">
            <div>
              <b>{invite.usedCount} / {invite.maxUses} 已用</b>
              <small>{expiryText(invite)}</small>
              <code>{invite.joinUrl}</code>
            </div>
            <div className="inviteActions">
              <button type="button" className="copyInviteButton" onClick={() => copyInvite(invite.joinUrl, invite.id)}>{copied === invite.id ? '已复制' : '复制'}</button>
              <button type="button" className="revokeInviteButton" onClick={() => revokeInvite(invite)}>撤销</button>
            </div>
          </article>
        ))}
        {invites.filter(inviteStillUsable).length === 0 && <p className="formHint">暂无有效邀请。生成链接后会显示在这里，方便复制和撤销。</p>}
      </div>
      {error && <div className="inlineTaskNotice error">{error}</div>}
      <button className="fullButton" disabled={busy}>{busy ? '生成中…' : '生成邀请链接'}</button>
    </form>
  );
}

type MemberEditFormProps = {
  user: UserRow;
  permissions: PermissionOption[];
  canManagePermissions: boolean;
  compactApprove?: boolean;
};

export function MemberEditForm({ user, permissions, canManagePermissions, compactApprove = false }: MemberEditFormProps) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [active, setActive] = useState(user.active);
  const roleText = user.role === 'ADMIN' ? '管理员' : '成员';
  const roleHint = user.role === 'ADMIN' ? '团队负责人默认拥有全部管理能力。' : '成员默认只处理自己的事项，可按需追加额外权限。';
  const statusText = active ? '已启用' : '已停用';
  const permissionCount = user.permissions.length;
  const grouped = groupedPermissions(permissions);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (user.active && !active && !window.confirm(`确定停用 ${user.name} 吗？停用后该成员将不能继续登录操作。`)) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(`/api/users/${user.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          active,
          name: String(formData.get('name') || ''),
          loginName: String(formData.get('loginName') || '').trim(),
          role: String(formData.get('role') || user.role),
          permissions: formData.getAll('permissions').map(String),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readJsonError(payload, '保存失败'));
      setMessage(active && !user.active ? '审核已通过，位置已保留。' : '成员信息已保存，位置已保留。');
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  if (compactApprove) {
    return (
      <form className="approvalRow approvalForm" onSubmit={submit}>
        <span className="avatar alertAvatar">{user.name.slice(0, 1)}</span>
        <div className="approvalMain">
          <b>{user.name}</b><small>{user.loginName ? `账号 ${user.loginName} · 审核通过前可修正信息并配置额外权限` : '未设置登录账号 · 审核通过前可补充账号并配置额外权限'}</small>
          <div className="approvalFields singleApprovalField">
            <input name="name" defaultValue={user.name} placeholder="姓名" required />
            <input name="loginName" defaultValue={user.loginName || ''} placeholder="登录账号" />
            <input type="hidden" name="role" value="MEMBER" />
          </div>
          <input type="hidden" name="active" value="true" />
          {canManagePermissions && (
            <details className="approvalPermissionBox">
              <summary>分配额外权限</summary>
              <div className="checks modernChecks">{permissions.map((p) => <label key={p.value}><input type="checkbox" name="permissions" value={p.value} defaultChecked={user.permissions.includes(p.value)} />{p.label}</label>)}</div>
            </details>
          )}
          {message && <div className="inlineTaskNotice">{message}</div>}
          {error && <div className="inlineTaskNotice error">{error}</div>}
        </div>
        <button className="approveButton" disabled={busy}>{busy ? '保存中…' : '审核通过'}</button>
      </form>
    );
  }

  return (
    <form className="memberEditForm polishedMemberEditForm" onSubmit={submit}>
      <div className="memberEditOverview">
        <span className="memberEditAvatar">{user.name.slice(0, 1)}</span>
        <div>
          <b>{user.name}</b>
          <small>{statusText} · {roleText} · {user.loginName ? `账号 ${user.loginName}` : '未设置登录账号'} · 额外权限 {permissionCount}</small>
        </div>
      </div>

      <section className="memberEditSection">
        <div className="memberEditSectionHead">
          <span>基础信息</span>
          <small>姓名、身份和账号状态</small>
        </div>
        <div className="memberEditGrid">
          <label>姓名<input name="name" defaultValue={user.name} placeholder="姓名" required /></label>
          <label>登录账号<input name="loginName" defaultValue={user.loginName || ''} placeholder="例如 zhangsan" pattern="[a-zA-Z0-9._-]{2,40}" title="账号只能使用 2-40 位字母、数字、点、横线和下划线" /></label>
          <label>身份<div className="readonlyRolePill">普通成员</div><input type="hidden" name="role" value="MEMBER" /></label>
        </div>
        <div className="roleExplainCard">
          <span>{roleText}</span>
          <small>{roleHint}</small>
        </div>
        <label className="memberStatusSwitch"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /><span><b>启用账号</b><small>{active ? '该成员可以登录和操作事项' : '停用后该成员不能继续登录'}</small></span></label>
      </section>

      {canManagePermissions && (
        <section className="memberEditSection memberPermissionSection">
          <div className="memberEditSectionHead">
            <span>额外权限</span>
            <small>仅给需要协作管理的成员开启</small>
          </div>
          <div className="checks modernChecks groupedPermissionList">
            {grouped.map((group) => (
              <fieldset key={group.title} className="permissionGroupCard">
                <legend><span>{group.title}</span><small>{group.hint}</small></legend>
                <div className="memberPermissionGrid">{group.permissions.map((p) => <label key={p.value}><input type="checkbox" name="permissions" value={p.value} defaultChecked={user.permissions.includes(p.value)} />{p.label}</label>)}</div>
              </fieldset>
            ))}
          </div>
        </section>
      )}

      {(message || error) && <div className={error ? 'inlineTaskNotice error' : 'inlineTaskNotice'}>{error || message}</div>}
      <div className="memberEditFooter">
        <span>{active ? '保存后立即生效。' : '将停用此账号，请谨慎确认。'}</span>
        <button className="fullButton memberSaveButton" disabled={busy}>{busy ? '保存中…' : '保存成员设置'}</button>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ user }: { user: { id: string; name: string } }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    if (!window.confirm(`确定重置 ${user.name} 的登录密码吗？对方其他设备会被强制重新登录。`)) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(`/api/users/${user.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          newPassword: String(formData.get('newPassword') || ''),
          confirmPassword: String(formData.get('confirmPassword') || ''),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(readJsonError(payload, '重置失败'));
      form.reset();
      setMessage(`${user.name} 的密码已重置，页面位置已保留。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重置失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="resetPasswordForm" onSubmit={submit}>
      <label>新密码<input name="newPassword" type="password" minLength={6} required /></label>
      <label>确认新密码<input name="confirmPassword" type="password" minLength={6} required /></label>
      {message && <div className="inlineTaskNotice">{message}</div>}
      {error && <div className="inlineTaskNotice error">{error}</div>}
      <button className="smallWarningButton" disabled={busy}>{busy ? '重置中…' : '重置密码'}</button>
    </form>
  );
}
