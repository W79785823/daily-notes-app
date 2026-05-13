#!/usr/bin/env node
const { execSync } = require('node:child_process');

function loadProductionDatabaseUrl() {
  try {
    const env = execSync('systemctl show daily-notes-app.service -p Environment --value', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    const match = env.match(/DATABASE_URL=(?:"([^"]+)"|([^\s"]+))/);
    const value = (match?.[1] || match?.[2] || '').replace(/^"|"$/g, '');
    if (value) process.env.DATABASE_URL = value;
  } catch {}
}

function beijingDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value || '1970';
  const month = parts.find((part) => part.type === 'month')?.value || '01';
  const day = parts.find((part) => part.type === 'day')?.value || '01';
  return `${year}-${month}-${day}`;
}

loadProductionDatabaseUrl();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const appUrl = process.env.DAILY_NOTES_APP_URL || 'https://m.xwr.me';
const today = process.env.REMINDER_DATE || beijingDateKey();
const maxItems = Number(process.env.REMINDER_MAX_ITEMS || 8);

const PRIORITY_LABELS = { LOW: '低', NORMAL: '普通', HIGH: '高', URGENT: '紧急' };

function isHighPriority(priority) {
  return priority === 'HIGH' || priority === 'URGENT';
}

function daysOverdue(taskDate, todayKey) {
  const taskTime = new Date(`${taskDate}T00:00:00`).getTime();
  const todayTime = new Date(`${todayKey}T00:00:00`).getTime();
  return Math.max(0, Math.round((todayTime - taskTime) / 86400000));
}

function taskSortKey(task, todayKey) {
  const priorityScore = task.priority === 'URGENT' ? 0 : task.priority === 'HIGH' ? 1 : task.priority === 'NORMAL' ? 2 : 3;
  const overdueScore = task.date < todayKey ? 0 : 1;
  return `${overdueScore}-${priorityScore}-${task.date}-${task.title}`;
}

function buildDailyReminder({ today, tasks, appUrl, maxItems = 8 }) {
  const overdue = tasks.filter((task) => task.date < today && !task.completedAt);
  const todayTasks = tasks.filter((task) => task.date === today);
  const highPriority = tasks.filter((task) => !task.completedAt && isHighPriority(task.priority));
  const pending = tasks.filter((task) => !task.completedAt).sort((a, b) => taskSortKey(a, today).localeCompare(taskSortKey(b, today))).slice(0, maxItems);

  const lines = [];
  lines.push('今日事项提醒');
  lines.push('');
  lines.push(`日期：${today}`);
  lines.push(`待办：${pending.length} 个`);
  lines.push(`今日：${todayTasks.length} 个`);
  lines.push(`逾期：${overdue.length} 个`);
  lines.push(`高优先级：${highPriority.length} 个`);
  lines.push('');

  if (pending.length === 0) {
    lines.push('今天暂无待办，可以轻松一点。');
  } else {
    lines.push('重点事项：');
    for (const task of pending) {
      const overdueDays = daysOverdue(task.date, today);
      const tags = [];
      if (task.date < today) tags.push(`逾期 ${overdueDays} 天`);
      if (task.date === today) tags.push('今天');
      if (isHighPriority(task.priority)) tags.push(`优先级 ${PRIORITY_LABELS[task.priority]}`);
      const tagText = tags.length ? `（${tags.join(' · ')}）` : '';
      lines.push(`- ${task.title}${tagText}`);
      if (task.note) lines.push(`  备注：${task.note}`);
      lines.push(`  负责人：${task.assigneeName || '未分配'}`);
    }
  }

  lines.push('');
  lines.push(`打开查看：${appUrl}`);
  return lines.join('\n');
}

async function main() {
  const tasks = await prisma.task.findMany({
    where: { deletedAt: null },
    include: { assignee: true },
    orderBy: [{ date: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
  });
  const text = buildDailyReminder({
    today,
    tasks: tasks.map((task) => ({
      title: task.title,
      note: task.note,
      date: task.date,
      priority: task.priority,
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      assigneeName: task.assignee?.name || '未分配',
    })),
    appUrl,
    maxItems,
  });
  process.stdout.write(text + '\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect().catch(() => {});
});
