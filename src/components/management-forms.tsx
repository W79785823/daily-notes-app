'use client';

import { FormEvent, useState } from 'react';

type PermissionOption = { value: string; label: string };
type UserRow = { id: string; name: string; role: string; active: boolean; permissions: string[] };

type AnnouncementFormProps = {
  className?: string;
};

function readJsonError(payload: any, fallback: string) {
  return String(payload?.error || payload?.message || fallback);
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
          role: String(formData.get('role') || 'MEMBER'),
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
      <select name="role" defaultValue="MEMBER">
        <option value="MEMBER">成员</option>
        <option value="ADMIN">管理员</option>
      </select>
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

  return (
    <form className={compactApprove ? 'approvalRow approvalForm' : 'memberEditForm'} onSubmit={submit}>
      {compactApprove && <span className="avatar alertAvatar">{user.name.slice(0, 1)}</span>}
      <div className={compactApprove ? 'approvalMain' : undefined}>
        {compactApprove && <><b>{user.name}</b><small>{user.name} · 审核通过前可修正姓名、身份和额外权限</small></>}
        <div className={compactApprove ? 'approvalFields' : undefined}>
          <input name="name" defaultValue={user.name} placeholder="姓名" required />
          <select name="role" defaultValue={user.role === 'ADMIN' ? 'ADMIN' : 'MEMBER'}>
            <option value="MEMBER">成员</option>
            <option value="ADMIN">管理员</option>
          </select>
        </div>
        {!compactApprove && <label className="inlineCheck"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />启用账号</label>}
        {compactApprove && <input type="hidden" name="active" value="true" />}
        {canManagePermissions && (
          <details className="approvalPermissionBox">
            <summary>{compactApprove ? '分配额外权限' : '额外权限'}</summary>
            <div className="checks modernChecks">{permissions.map((p) => <label key={p.value}><input type="checkbox" name="permissions" value={p.value} defaultChecked={user.permissions.includes(p.value)} />{p.label}</label>)}</div>
          </details>
        )}
        {message && <div className="inlineTaskNotice">{message}</div>}
        {error && <div className="inlineTaskNotice error">{error}</div>}
      </div>
      <button className={compactApprove ? 'approveButton' : 'fullButton'} disabled={busy}>{busy ? '保存中…' : compactApprove ? '审核通过' : '保存'}</button>
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
