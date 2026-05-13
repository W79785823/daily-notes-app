export type StatusView = 'all' | 'todo' | 'done' | 'overdue';

export type PanelTask = {
  id: string;
  title: string;
  note: string;
  date: string;
  priority: string;
  assigneeId: string;
  completedAt: string | null;
  creatorName: string;
  assigneeName: string;
  completedByName: string | null;
  createdAtLabel: string;
  priorityLabel: string;
  priorityClass: string;
  isMine: boolean;
  canComplete: boolean;
  canDelete: boolean;
  canEdit: boolean;
};

export type UserOption = { id: string; name: string };
export type PriorityOption = { value: string; label: string; hint?: string };

export type TaskEditDraft = {
  title: string;
  note: string;
  date: string;
  priority: string;
  assigneeId: string;
};
