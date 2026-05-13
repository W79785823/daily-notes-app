import { type Role } from '@/lib/permissions';

export const ROLE_LABELS: Record<Role, string> = {
  MEMBER: '成员',
  COLLABORATOR: '成员',
  ADMIN: '管理员',
};

export const QUICK_NOTES = ['客户跟进', '费用确认', '会议纪要', '明日计划'];

export const PRIORITY_OPTIONS = [
  { value: 'LOW', label: '低优先级', short: '低', hint: '不急，可排后', className: 'priorityLow' },
  { value: 'NORMAL', label: '普通', short: '普通', hint: '按计划推进', className: 'priorityNormal' },
  { value: 'HIGH', label: '重要', short: '重要', hint: '优先安排', className: 'priorityHigh' },
  { value: 'URGENT', label: '紧急', short: '紧急', hint: '马上处理', className: 'priorityUrgent' },
] as const;

export type PriorityValue = typeof PRIORITY_OPTIONS[number]['value'];

export function priorityMeta(value?: string | null) {
  return PRIORITY_OPTIONS.find((item) => item.value === value) || PRIORITY_OPTIONS[1];
}

export function taskPriorityMeta(priority: string) {
  return priorityMeta(priority as PriorityValue);
}

export function priorityRank(value?: string | null) {
  return { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 }[priorityMeta(value).value];
}

export function roleLabel(role?: string | null) {
  return ROLE_LABELS[(role || 'MEMBER') as Role] || '成员';
}

export function dateLabel(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'short' }).format(date);
}

export function relativeDay(value: string, todayKey: string) {
  const today = new Date(`${todayKey}T00:00:00`).getTime();
  const target = new Date(`${value}T00:00:00`).getTime();
  const diff = Math.round((target - today) / 86400000);
  if (diff === 0) return '今天';
  if (diff === 1) return '明天';
  if (diff === -1) return '昨天';
  if (diff > 1) return `${diff} 天后`;
  return `逾期 ${Math.abs(diff)} 天`;
}

export function addDays(value: string, offset: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
