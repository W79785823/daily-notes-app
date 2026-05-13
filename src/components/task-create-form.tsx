'use client';

import { FormEvent, useEffect, useState } from 'react';

type UserOption = { id: string; name: string };
type PriorityOption = { value: string; label: string; hint?: string; short?: string; className?: string };

type TaskCreateFormProps = {
  className?: string;
  title?: string;
  badge?: string;
  date: string;
  currentUserId: string;
  assignableUsers: UserOption[];
  priorityOptions: PriorityOption[];
  showPriorityPalette?: boolean;
  quickNotes?: string[];
};

export function TaskCreateForm({
  className = 'workspaceCard createCard priorityCard',
  title = '快速新增',
  badge = '优先操作',
  date,
  currentUserId,
  assignableUsers,
  priorityOptions,
  showPriorityPalette = false,
  quickNotes = [],
}: TaskCreateFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isDesktop, setIsDesktop] = useState(false);
  const [selectedDate, setSelectedDate] = useState(date);

  useEffect(() => {
    setSelectedDate(date);
  }, [date]);

  useEffect(() => {
    const handleDateSelect = (event: Event) => {
      const nextDate = (event as CustomEvent<{ date?: string }>).detail?.date;
      if (nextDate) setSelectedDate(nextDate);
    };
    window.addEventListener('daily-notes:select-date', handleDateSelect);
    return () => window.removeEventListener('daily-notes:select-date', handleDateSelect);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 681px)');
    const sync = () => setIsDesktop(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSubmitting(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: JSON.stringify({
          title: String(formData.get('title') || ''),
          note: String(formData.get('note') || ''),
          priority: String(formData.get('priority') || 'NORMAL'),
          date: String(formData.get('date') || selectedDate),
          assigneeId: String(formData.get('assigneeId') || currentUserId),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || '创建失败，请稍后重试。');
      form.reset();
      const dateInput = form.elements.namedItem('date') as HTMLInputElement | null;
      const assignee = form.elements.namedItem('assigneeId') as HTMLSelectElement | null;
      const priority = form.elements.namedItem('priority') as HTMLSelectElement | null;
      if (dateInput) dateInput.value = selectedDate;
      if (assignee) assignee.value = currentUserId;
      if (priority) priority.value = 'NORMAL';
      setMessage('事项已创建，当前位置已保留。');
      window.dispatchEvent(new CustomEvent('daily-notes:task-created', { detail: { task: payload.task } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请稍后重试。');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <details className={`${className} mobileCreateDetails`} open={isDesktop}>
      <summary className="mobileCreateSummary">
        <span><b>{title}</b><small>点开后填写事项</small></span>
        <em>{badge}</em>
      </summary>
      <div className="mobileCreateBody">
        <div className="sectionHead desktopCreateHead"><h2>{title}</h2><span>{badge}</span></div>
        <form className="stack modernForm" onSubmit={submit}>
          <input name="title" placeholder="事项标题" required />
          <textarea name="note" placeholder="备注" />
          <div className="twoCols">
            <label>日期<input name="date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} required /></label>
            <label>负责人<select name="assigneeId" defaultValue={currentUserId}>{assignableUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
          </div>
          <label>优先级<select name="priority" defaultValue="NORMAL">{priorityOptions.map((item) => <option key={item.value} value={item.value}>{item.hint ? `${item.label} · ${item.hint}` : item.label}</option>)}</select></label>
          {showPriorityPalette && (
            <div className="priorityPalette" aria-label="优先级颜色说明">
              {priorityOptions.map((item) => <span key={item.value} className={item.className}>{item.short || item.label}</span>)}
            </div>
          )}
          {message && <div className="inlineTaskNotice">{message}</div>}
          {error && <div className="inlineTaskNotice error">{error}</div>}
          <button className="fullButton" disabled={submitting}>{submitting ? '创建中…' : '创建事项'}</button>
        </form>
        {quickNotes.length > 0 && <div className="quickNotes">{quickNotes.map((item) => <span key={item}>{item}</span>)}</div>}
      </div>
    </details>
  );
}
