import type { CSSProperties } from 'react';
import { cn } from '@/lib/cn';
import { relativeDay } from '@/lib/home-ui';
import type { PanelTask, PriorityOption, TaskEditDraft, UserOption } from '@/components/task-panel-types';

type TaskItemCardProps = {
  task: PanelTask;
  index: number;
  view: 'all' | 'todo' | 'done' | 'overdue';
  todayKey: string;
  currentUserId: string;
  assignableUsers: UserOption[];
  priorityOptions: PriorityOption[];
  busy: boolean;
  editing: boolean;
  editDraft: TaskEditDraft;
  onEditDraftChange: (draft: TaskEditDraft) => void;
  onStartEdit: (task: PanelTask) => void;
  onCancelEdit: () => void;
  onSaveEdit: (task: PanelTask) => void;
  onComplete: (task: PanelTask) => void;
  onDelete: (taskId: string) => void;
};

export function TaskItemCard({
  task,
  index,
  view,
  todayKey,
  currentUserId,
  assignableUsers,
  priorityOptions,
  busy,
  editing,
  editDraft,
  onEditDraftChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onComplete,
  onDelete,
}: TaskItemCardProps) {
  const isOverdue = !task.completedAt && task.date < todayKey;

  return (
    <article className={cn('taskItem', task.completedAt && 'done', task.isMine && 'mine', busy && 'taskBusy', task.priorityClass)} style={{ '--delay': `${Math.min(index, 8) * 22}ms` } as CSSProperties}>
      <div className="taskAccent" />
      <div className="taskMain">
        <div className="taskTitleRow">
          <strong>{task.title}</strong>
          <div className="tagRow">
            <span className={cn('tag priorityTag', task.priorityClass)}>{task.priorityLabel}</span>
            {task.isMine && <span className="tag mineTag">我的</span>}
            {isOverdue && <span className="tag dangerTag">已逾期</span>}
            {task.completedAt && <span className="tag doneTag">已完成</span>}
          </div>
        </div>
        {editing ? (
          <div className="taskEditBox">
            <input value={editDraft.title} onChange={(event) => onEditDraftChange({ ...editDraft, title: event.target.value })} placeholder="事项标题" />
            <textarea value={editDraft.note} onChange={(event) => onEditDraftChange({ ...editDraft, note: event.target.value })} placeholder="备注" />
            <div className="taskEditGrid">
              <label>日期<input type="date" value={editDraft.date} onChange={(event) => onEditDraftChange({ ...editDraft, date: event.target.value })} /></label>
              <label>负责人<select value={editDraft.assigneeId || currentUserId} onChange={(event) => onEditDraftChange({ ...editDraft, assigneeId: event.target.value })}>{assignableUsers.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
              <label>优先级<select value={editDraft.priority} onChange={(event) => onEditDraftChange({ ...editDraft, priority: event.target.value })}>{priorityOptions.map((item) => <option key={item.value} value={item.value}>{item.hint ? `${item.label} · ${item.hint}` : item.label}</option>)}</select></label>
            </div>
          </div>
        ) : (
          <>
            <p>{task.note || '无备注'}</p>
            <div className="taskMeta">
              <span>{task.date}{view === 'overdue' ? ` · ${relativeDay(task.date, todayKey)}` : ''}</span>
              <span>负责人：{task.assigneeName}</span>
              <span>创建人：{task.creatorName}</span>
              <span>{task.createdAtLabel}</span>
            </div>
          </>
        )}
      </div>
      {(task.canComplete || task.canDelete || task.canEdit) && (
        <div className="taskActions modernActions">
          {task.canEdit && (
            editing ? (
              <>
                <button type="button" className="completeButton" disabled={busy} onClick={() => onSaveEdit(task)}>{busy ? '保存中' : '保存'}</button>
                <button type="button" className="ghostButton" disabled={busy} onClick={onCancelEdit}>取消</button>
              </>
            ) : (
              <button type="button" className="ghostButton" disabled={busy} onClick={() => onStartEdit(task)}>修改</button>
            )
          )}
          {task.canComplete && (
            <button type="button" disabled={busy} className={task.completedAt ? 'ghostButton' : 'completeButton'} onClick={() => onComplete(task)}>
              {busy ? '处理中' : task.completedAt ? '重开' : '完成'}
            </button>
          )}
          {task.canDelete && (
            <button type="button" className="deleteButton" disabled={busy} onClick={() => onDelete(task.id)}>{busy ? '删除中' : '删除'}</button>
          )}
        </div>
      )}
    </article>
  );
}
