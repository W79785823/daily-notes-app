'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { TaskItemCard } from '@/components/task-item-card';
import type { PanelTask, PriorityOption, StatusView, TaskEditDraft, UserOption } from '@/components/task-panel-types';

const DEFAULT_PRIORITY_OPTIONS: PriorityOption[] = [
  { value: 'LOW', label: '低' },
  { value: 'NORMAL', label: '普通' },
  { value: 'HIGH', label: '高' },
  { value: 'URGENT', label: '紧急' },
];

type TaskFocusPanelProps = {
  initialStatus: StatusView;
  initialSearch: string;
  todayKey: string;
  currentUserName: string;
  currentUserRoleLabel: string;
  currentUserId: string;
  assignableUsers: UserOption[];
  priorityOptions?: PriorityOption[];
  tasks: PanelTask[];
  overdueTasks: PanelTask[];
};

function buildSearch(baseSearch: string, status: StatusView) {
  const params = new URLSearchParams(baseSearch.startsWith('?') ? baseSearch.slice(1) : baseSearch);
  params.set('status', status === 'overdue' ? 'todo' : status);
  if (status === 'overdue') params.set('overdue', '1');
  else params.delete('overdue');
  const query = params.toString();
  return query ? `?${query}` : '';
}

function notifyTaskChanged() {
  window.dispatchEvent(new CustomEvent('daily-notes:task-changed'));
}

function taskFromApi(task: Record<string, any>, fallback?: PanelTask, currentUserId?: string): PanelTask {
  return {
    id: String(task.id),
    title: String(task.title || fallback?.title || ''),
    note: String(task.note || ''),
    date: String(task.date || fallback?.date || ''),
    priority: String(task.priority || fallback?.priority || 'NORMAL'),
    assigneeId: String(task.assigneeId || fallback?.assigneeId || ''),
    completedAt: task.completedAt ? String(task.completedAt) : null,
    creatorName: task.creator?.name || fallback?.creatorName || '',
    assigneeName: task.assignee?.name || fallback?.assigneeName || '',
    completedByName: task.completedBy?.name || fallback?.completedByName || null,
    createdAtLabel: task.createdAt
      ? new Date(String(task.createdAt)).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      : fallback?.createdAtLabel || '',
    priorityLabel: ({ LOW: '低', NORMAL: '普通', HIGH: '高', URGENT: '紧急' } as Record<string, string>)[String(task.priority || fallback?.priority || 'NORMAL')] || fallback?.priorityLabel || '普通',
    priorityClass: ({ LOW: 'priorityLow', NORMAL: 'priorityNormal', HIGH: 'priorityHigh', URGENT: 'priorityUrgent' } as Record<string, string>)[String(task.priority || fallback?.priority || 'NORMAL')] || fallback?.priorityClass || 'priorityNormal',
    isMine: fallback?.isMine ?? (currentUserId ? task.assigneeId === currentUserId || task.creatorId === currentUserId : false),
    canComplete: fallback?.canComplete ?? true,
    canDelete: fallback?.canDelete ?? Boolean(task.canDelete),
    canEdit: fallback?.canEdit ?? Boolean(task.canEdit),
  };
}

export function TaskFocusPanel({
  initialStatus,
  initialSearch,
  todayKey,
  currentUserName,
  currentUserRoleLabel,
  currentUserId,
  assignableUsers,
  priorityOptions = DEFAULT_PRIORITY_OPTIONS,
  tasks,
  overdueTasks,
}: TaskFocusPanelProps) {
  const [view, setView] = useState<StatusView>(initialStatus);
  const [search, setSearch] = useState(initialSearch);
  const [transitionClass, setTransitionClass] = useState('');
  const [switching, setSwitching] = useState(false);
  const [localTasks, setLocalTasks] = useState(tasks);
  const [localOverdueTasks, setLocalOverdueTasks] = useState(overdueTasks);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [inlineMessage, setInlineMessage] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TaskEditDraft>({ title: '', note: '', date: '', priority: 'NORMAL', assigneeId: '' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const activeRequestRef = useRef(0);

  useEffect(() => {
    setLocalTasks(tasks);
    setLocalOverdueTasks(overdueTasks);
    setView(initialStatus);
    setSearch(initialSearch);
    setInlineMessage('');
  }, [tasks, overdueTasks, initialStatus, initialSearch]);

  const currentTotal = localTasks.length;
  const currentDone = localTasks.filter((task) => task.completedAt).length;
  const currentTodo = currentTotal - currentDone;
  const overdueCount = localOverdueTasks.length;
  const mineCount = localTasks.filter((task) => task.isMine).length;

  const displayedTasks = useMemo(() => {
    if (view === 'overdue') return localOverdueTasks;
    if (view === 'todo') return localTasks.filter((task) => !task.completedAt);
    if (view === 'done') return localTasks.filter((task) => !!task.completedAt);
    return localTasks;
  }, [view, localTasks, localOverdueTasks]);

  const activeCount = displayedTasks.length;
  const currentLabel = view === 'all' ? '全部事项' : view === 'todo' ? '待完成' : view === 'done' ? '已完成' : '逾期待办';

  const viewCounts = {
    all: currentTotal,
    todo: currentTodo,
    done: currentDone,
    overdue: overdueCount,
  };
  const highPriorityTasks = localTasks
    .filter((task) => !task.completedAt && ['URGENT', 'HIGH'].includes(task.priority))
    .slice(0, 2);
  const focusTitle = overdueCount > 0 ? '先处理逾期待办' : currentTodo > 0 ? '今天还有事项待完成' : '今天已经清爽了';
  const focusCopy = overdueCount > 0
    ? `${overdueCount} 条逾期待办需要尽快处理，今天还有 ${currentTodo} 条未完成。`
    : currentTodo > 0
      ? `今天还有 ${currentTodo} 条待完成，优先看高优先级和与我相关的事项。`
      : currentTotal > 0
        ? '当前日期事项都完成了，可以切换日期或继续新增安排。'
        : '当前日期还没有事项，可以先发布一条工作安排。';

  const refreshTasks = async (nextSearch: string, nextView: StatusView) => {
    const params = new URLSearchParams(nextSearch.startsWith('?') ? nextSearch.slice(1) : nextSearch);
    const requestDate = params.get('date');
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/tasks${nextSearch}`, { headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || '事项刷新失败');
      if (activeRequestRef.current !== requestId) return;
      const nextTasks = Array.isArray(payload.tasks) ? payload.tasks.map((task: Record<string, any>) => taskFromApi(task, undefined, currentUserId)) : [];
      if (nextView === 'overdue') {
        setLocalOverdueTasks(nextTasks);
      } else {
        setLocalTasks(nextTasks);
        if (requestDate) {
          window.dispatchEvent(new CustomEvent('daily-notes:date-loaded', { detail: { date: requestDate, total: nextTasks.length } }));
        }
      }
    } catch (error) {
      setInlineMessage(error instanceof Error ? error.message : '事项刷新失败，请稍后重试。');
    } finally {
      if (activeRequestRef.current === requestId) setIsRefreshing(false);
    }
  };

  useEffect(() => {
    const handleTaskCreated = (event: Event) => {
      const task = (event as CustomEvent<{ task?: Record<string, any> }>).detail?.task;
      if (!task?.id) return;
      const created = taskFromApi(task, undefined, currentUserId);
      setInlineMessage('事项已创建，当前位置已保留。');
      setLocalTasks((items) => {
        if (items.some((item) => item.id === created.id)) return items;
        return [created, ...items];
      });
      if (!created.completedAt && created.date < todayKey) {
        setLocalOverdueTasks((items) => items.some((item) => item.id === created.id) ? items : [created, ...items]);
      }
    };
    window.addEventListener('daily-notes:task-created', handleTaskCreated);
    return () => window.removeEventListener('daily-notes:task-created', handleTaskCreated);
  }, [currentUserId, todayKey]);

  useEffect(() => {
    const handleDateSelect = (event: Event) => {
      const selectedDate = (event as CustomEvent<{ date?: string }>).detail?.date;
      if (!selectedDate) return;
      const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
      params.set('date', selectedDate);
      params.set('status', 'all');
      params.delete('overdue');
      const nextSearch = `?${params.toString()}`;
      setView('all');
      setSearch(nextSearch);
      setInlineMessage('');
      void refreshTasks(nextSearch, 'all');
    };
    window.addEventListener('daily-notes:select-date', handleDateSelect);
    return () => window.removeEventListener('daily-notes:select-date', handleDateSelect);
  }, [search]);

  const switchView = async (next: StatusView) => {
    if (next === view || switching) return;
    setSwitching(true);
    setInlineMessage('');
    const order: StatusView[] = ['all', 'todo', 'done', 'overdue'];
    const direction = order.indexOf(next) >= order.indexOf(view) ? 'left' : 'right';
    const leavingClass = direction === 'right' ? 'cardLeavingRight' : 'cardLeavingLeft';
    const enteringClass = direction === 'right' ? 'cardReturnRight' : 'cardReturnLeft';
    setTransitionClass(leavingClass);
    window.setTimeout(() => {
      setView(next);
      const nextSearch = buildSearch(search, next);
      setSearch(nextSearch);
      window.history.replaceState({}, '', `${window.location.pathname}${nextSearch}`);
      void refreshTasks(nextSearch, next);
      setTransitionClass(enteringClass);
      window.setTimeout(() => {
        setTransitionClass('');
        setSwitching(false);
      }, 220);
    }, 90);
  };

  const startEdit = (task: PanelTask) => {
    setEditingTaskId(task.id);
    setEditDraft({ title: task.title, note: task.note, date: task.date, priority: task.priority, assigneeId: task.assigneeId || currentUserId });
    setInlineMessage('');
  };

  const saveEdit = async (task: PanelTask) => {
    if (busyTaskId) return;
    const title = editDraft.title.trim();
    if (!title) {
      setInlineMessage('事项标题不能为空。');
      return;
    }
    setBusyTaskId(task.id);
    setInlineMessage('');
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ title, note: editDraft.note, date: editDraft.date, priority: editDraft.priority, assigneeId: editDraft.assigneeId || currentUserId }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || '保存失败');
      const updated = taskFromApi(payload.task || {}, { ...task, title, note: editDraft.note, date: editDraft.date, priority: editDraft.priority, assigneeId: editDraft.assigneeId || currentUserId }, currentUserId);
      setLocalTasks((items) => items.map((item) => (item.id === task.id ? updated : item)));
      setLocalOverdueTasks((items) => items.map((item) => (item.id === task.id ? updated : item)));
      notifyTaskChanged();
      setEditingTaskId(null);
      setInlineMessage('事项已更新，当前位置已保留。');
    } catch (error) {
      setInlineMessage(error instanceof Error ? error.message : '保存失败，请稍后重试。');
    } finally {
      setBusyTaskId(null);
    }
  };

  const completeTask = async (task: PanelTask) => {
    if (busyTaskId) return;
    const nextCompleted = !task.completedAt;
    const ok = window.confirm(nextCompleted ? `确定完成事项「${task.title}」吗？` : `确定取消完成事项「${task.title}」吗？`);
    if (!ok) return;
    setBusyTaskId(task.id);
    setInlineMessage('');
    try {
      const response = await fetch(`/api/tasks/${task.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ completed: nextCompleted }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || '操作失败');
      const updated = taskFromApi(payload.task || {}, task);
      setLocalTasks((items) => items.map((item) => (item.id === task.id ? updated : item)));
      setLocalOverdueTasks((items) => {
        if (nextCompleted) return items.filter((item) => item.id !== task.id);
        return items.map((item) => (item.id === task.id ? updated : item));
      });
      notifyTaskChanged();
    } catch (error) {
      setInlineMessage(error instanceof Error ? error.message : '操作失败，请稍后重试。');
    } finally {
      setBusyTaskId(null);
    }
  };

  const deleteTask = async (taskId: string) => {
    if (busyTaskId) return;
    const ok = window.confirm('确定删除这条事项吗？');
    if (!ok) return;
    setBusyTaskId(taskId);
    setInlineMessage('');
    try {
      const response = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE', headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || '删除失败');
      setLocalTasks((items) => items.filter((item) => item.id !== taskId));
      setLocalOverdueTasks((items) => items.filter((item) => item.id !== taskId));
      notifyTaskChanged();
      setInlineMessage('事项已删除，当前位置已保留。');
    } catch (error) {
      setInlineMessage(error instanceof Error ? error.message : '删除失败，请稍后重试。');
    } finally {
      setBusyTaskId(null);
    }
  };

  return (
    <>
      <section className={cn('statsGrid', 'taskPanelStats')}>
        <div className="statCard primaryStat">
          <span>{currentLabel}</span>
          <strong>{activeCount}</strong>
          <em>{view === 'overdue' ? '前几天还没完成' : '当前视图内的事项'}</em>
        </div>
        <div className="statCard"><span>逾期待办</span><strong>{overdueCount}</strong><em>跨日期未完成事项</em></div>
        <div className="statCard"><span>与我相关</span><strong>{mineCount}</strong><em>{currentUserName} · {currentUserRoleLabel}</em></div>
        <div className="statCard"><span>当前日期</span><strong>{currentTotal}</strong><em>{todayKey}</em></div>
      </section>

      <section className="todayFocusCard" aria-label="今日聚焦">
        <div className="todayFocusMain">
          <span className="sectionLabel">FOCUS</span>
          <h2>{focusTitle}</h2>
          <p>{focusCopy}</p>
          {highPriorityTasks.length > 0 && (
            <div className="focusPriorityList" aria-label="优先处理事项">
              <b>优先处理</b>
              {highPriorityTasks.map((task) => <span key={task.id}>{task.title}</span>)}
            </div>
          )}
        </div>
        <div className="focusActions">
          {overdueCount > 0 && <button type="button" onClick={() => void switchView('overdue')}>处理逾期</button>}
          {currentTodo > 0 && <button type="button" onClick={() => void switchView('todo')}>看待完成</button>}
          <button type="button" className="ghostFocusButton" onClick={() => void switchView('all')}>全部事项</button>
        </div>
      </section>

      <section className="controlDock compactControlDock taskPanelDock">
        <div className="statusTabs" aria-label="事项状态筛选">
          <button type="button" disabled={switching} className={cn('tab', view === 'all' && 'active')} onClick={() => void switchView('all')}>全部 <b>{viewCounts.all}</b></button>
          <button type="button" disabled={switching} className={cn('tab', view === 'todo' && 'active')} onClick={() => void switchView('todo')}>待完成 <b>{viewCounts.todo}</b></button>
          <button type="button" disabled={switching} className={cn('tab', view === 'done' && 'active')} onClick={() => void switchView('done')}>已完成 <b>{viewCounts.done}</b></button>
          <button type="button" disabled={switching} className={cn('tab overdueTab', view === 'overdue' && 'active')} onClick={() => void switchView('overdue')}>逾期待办 <b>{viewCounts.overdue}</b></button>
        </div>
      </section>

      <div id="task-list" className={cn('workspaceCard taskBoard', transitionClass, isRefreshing && 'taskBoardRefreshing')}>
        <div className="sectionHead modernHead">
          <div><span className="sectionLabel">TODAY</span><h2>{view === 'overdue' ? '逾期待办' : '事项列表'}</h2></div>
          <span>{isRefreshing ? '正在更新…' : view === 'overdue' ? `前几天未完成 · ${displayedTasks.length} 条` : `当前视图 · ${displayedTasks.length} 条`}</span>
        </div>
        {inlineMessage && <div className={cn('inlineTaskNotice', inlineMessage.includes('失败') || inlineMessage.includes('没有权限') ? 'error' : '')}>{inlineMessage}</div>}
        <div className="taskList modernList">
          {displayedTasks.length === 0 && (
            <div className="emptyState">
              <strong>{view === 'overdue' ? '没有逾期事项' : '当前没有符合条件的事项'}</strong>
              <span>{view === 'overdue' ? '很好，之前的事项已经清完了。' : '可以切换别的状态看看，或者换个日期。'}</span>
            </div>
          )}
          {displayedTasks.map((task, index) => (
            <TaskItemCard
              key={task.id}
              task={task}
              index={index}
              view={view}
              todayKey={todayKey}
              currentUserId={currentUserId}
              assignableUsers={assignableUsers}
              priorityOptions={priorityOptions}
              busy={busyTaskId === task.id}
              editing={editingTaskId === task.id}
              editDraft={editDraft}
              onEditDraftChange={setEditDraft}
              onStartEdit={startEdit}
              onCancelEdit={() => setEditingTaskId(null)}
              onSaveEdit={(item) => void saveEdit(item)}
              onComplete={(item) => void completeTask(item)}
              onDelete={(taskId) => void deleteTask(taskId)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
