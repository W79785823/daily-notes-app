'use client';

import { useState } from 'react';

export function AnnouncementDeleteButton({ id, title }: { id: string; title: string }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const remove = async () => {
    if (busy) return;
    if (!window.confirm(`确认删除公告「${title}」吗？删除后团队成员将不再看到这条公告。`)) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(`/api/announcements/${id}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || '删除公告失败');
      setMessage('公告已删除，正在刷新列表。');
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '删除公告失败，请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="announcementDangerZone">
      {message && <small>{message}</small>}
      <button type="button" className="textDangerButton" disabled={busy} onClick={remove}>{busy ? '删除中…' : '删除公告'}</button>
    </div>
  );
}
