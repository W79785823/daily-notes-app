export type ReminderPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type ReminderTask = {
  id: string;
  title: string;
  date: string;
  priority: ReminderPriority | string;
  assigneeName: string;
  completedAt: string | null;
};

type BuildDailyReminderInput = {
  today: string;
  tasks: ReminderTask[];
  appUrl: string;
  maxItems?: number;
};

const PRIORITY_LABELS: Record<string, string> = {
  LOW: '低',
  NORMAL: '普通',
  HIGH: '高',
  URGENT: '紧急',
};

function isHighPriority(priority: string) {
  return priority === 'HIGH' || priority === 'URGENT';
}

function daysOverdue(taskDate: string, today: string) {
  const taskTime = new Date(`${taskDate}T00:00:00`).getTime();
  const todayTime = new Date(`${today}T00:00:00`).getTime();
  return Math.max(0, Math.round((todayTime - taskTime) / 86400000));
}

function taskSortKey(task: ReminderTask, today: string) {
  const priorityScore = task.priority === 'URGENT' ? 0 : task.priority === 'HIGH' ? 1 : task.priority === 'NORMAL' ? 2 : 3;
  const overdueScore = task.date < today ? 0 : 1;
  return `${overdueScore}-${priorityScore}-${task.date}-${task.title}`;
}

export function buildDailyReminder({ today, tasks, appUrl, maxItems = 8 }: BuildDailyReminderInput) {
  const openTasks = tasks.filter((task) => !task.completedAt);
  const todayTasks = openTasks.filter((task) => task.date === today);
  const overdueTasks = openTasks.filter((task) => task.date < today);
  const highPriorityTasks = openTasks.filter((task) => isHighPriority(String(task.priority)));
  const importantTasks = [...openTasks].sort((a, b) => taskSortKey(a, today).localeCompare(taskSortKey(b, today)));
  const shownTasks = importantTasks.slice(0, maxItems);
  const hiddenCount = Math.max(0, importantTasks.length - shownTasks.length);

  const lines = [
    '今日事项提醒',
    '',
    `日期：${today}`,
    `待办：${openTasks.length} 个`,
    `今日：${todayTasks.length} 个`,
    `逾期：${overdueTasks.length} 个`,
    `高优先级：${highPriorityTasks.length} 个`,
    '',
  ];

  if (openTasks.length === 0) {
    lines.push('今天暂无待办，可以轻松一点。');
  } else {
    lines.push('重点事项：');
    shownTasks.forEach((task, index) => {
      const overdue = task.date < today ? ` · 逾期 ${daysOverdue(task.date, today)} 天` : '';
      const priority = PRIORITY_LABELS[String(task.priority)] || String(task.priority || '普通');
      lines.push(`${index + 1}. ${task.title}｜${task.assigneeName}｜${priority}${overdue}`);
    });
    if (hiddenCount > 0) lines.push(`还有 ${hiddenCount} 个待办未展示，请打开系统查看。`);
  }

  lines.push('', `打开查看：${appUrl}`);
  return lines.join('\n');
}
