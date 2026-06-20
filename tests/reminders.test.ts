import { describe, expect, it } from 'vitest';
import { buildDailyReminder, buildTeamDailyReminders, type ReminderTask } from '../src/lib/reminders';

const task = (overrides: Partial<ReminderTask>): ReminderTask => ({
  id: 't1',
  title: '跟进订单进度',
  date: '2026-05-12',
  priority: 'NORMAL',
  assigneeName: '张三',
  completedAt: null,
  ...overrides,
});

describe('每日提醒内容生成', () => {
  it('没有事项时输出简洁提醒', () => {
    const text = buildDailyReminder({ today: '2026-05-12', tasks: [], appUrl: 'https://m.xwr.me' });

    expect(text).toContain('今日事项提醒');
    expect(text).toContain('今天暂无待办');
    expect(text).toContain('https://m.xwr.me');
  });

  it('汇总今日待办、逾期和高优先级事项', () => {
    const text = buildDailyReminder({
      today: '2026-05-12',
      appUrl: 'https://m.xwr.me',
      tasks: [
        task({ id: 'today-high', title: '确认出货', date: '2026-05-12', priority: 'HIGH', assigneeName: '李四' }),
        task({ id: 'overdue', title: '补齐资料', date: '2026-05-10', priority: 'URGENT', assigneeName: '王五' }),
        task({ id: 'done', title: '已完成事项', date: '2026-05-12', completedAt: '2026-05-12T01:00:00Z' }),
      ],
    });

    expect(text).toContain('待办：2 个');
    expect(text).toContain('逾期：1 个');
    expect(text).toContain('高优先级：2 个');
    expect(text).toContain('确认出货');
    expect(text).toContain('补齐资料');
    expect(text).not.toContain('已完成事项');
  });

  it('事项过多时只列出重点前几条', () => {
    const tasks = Array.from({ length: 8 }, (_, index) => task({ id: `t${index}`, title: `事项${index + 1}`, priority: index === 0 ? 'URGENT' : 'NORMAL' }));

    const text = buildDailyReminder({ today: '2026-05-12', tasks, appUrl: 'https://m.xwr.me', maxItems: 5 });

    expect(text).toContain('事项1');
    expect(text).toContain('事项5');
    expect(text).not.toContain('事项6');
    expect(text).toContain('还有 3 个待办未展示');
  });

  it('可以按团队分别生成提醒文本', () => {
    const text = buildTeamDailyReminders({
      today: '2026-05-12',
      appUrl: 'https://m.xwr.me',
      teams: [
        { id: 'team-a', name: '团队 A', tasks: [task({ title: 'A 事项' })] },
        { id: 'team-b', name: '团队 B', tasks: [task({ title: 'B 事项' })] },
      ],
    });

    expect(text).toContain('团队：团队 A');
    expect(text).toContain('A 事项');
    expect(text).toContain('团队：团队 B');
    expect(text).toContain('B 事项');
  });
});
