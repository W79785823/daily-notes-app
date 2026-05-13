'use client';

import { useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { beijingDateKey } from '@/lib/beijing-date';

type DayStat = { date: string; total: number; done: number };

type WorkCalendarProps = {
  initialDate: string;
  initialStats: DayStat[];
  initialMonthTotal: number;
  initialMonthCompletion: number;
  assigneeId: string;
  priority: string;
  keyword: string;
};

function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addMonths(value: string, offset: number) {
  const base = new Date(`${value.slice(0, 7)}-01T00:00:00`);
  base.setMonth(base.getMonth() + offset);
  return toDateKey(base);
}

function calendarDays(value: string) {
  const first = new Date(`${value.slice(0, 7)}-01T00:00:00`);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const todayKey = beijingDateKey();
  return Array.from({ length: 42 }, (_, index) => {
    const item = new Date(start);
    item.setDate(start.getDate() + index);
    const key = toDateKey(item);
    return {
      key,
      day: item.getDate(),
      inMonth: item.getMonth() === first.getMonth(),
      isToday: key === todayKey,
      isSelected: key === value,
    };
  });
}

function statMap(items: DayStat[]) {
  return new Map(items.map((item) => [item.date, { total: item.total, done: item.done }]));
}

export function WorkCalendar({ initialDate, initialStats, initialMonthTotal, initialMonthCompletion, assigneeId, priority, keyword }: WorkCalendarProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [monthDate, setMonthDate] = useState(initialDate);
  const [stats, setStats] = useState(initialStats);
  const [monthTotal, setMonthTotal] = useState(initialMonthTotal);
  const [monthCompletion, setMonthCompletion] = useState(initialMonthCompletion);
  const [loading, setLoading] = useState(false);
  const activeRequestRef = useRef(0);

  const statsByDay = useMemo(() => statMap(stats), [stats]);
  const days = useMemo(() => calendarDays(monthDate), [monthDate]);

  const loadMonth = async (nextDate: string) => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    setLoading(true);
    try {
      const params = new URLSearchParams({ month: nextDate.slice(0, 7), assigneeId, priority });
      if (keyword) params.set('keyword', keyword);
      const response = await fetch(`/api/calendar?${params.toString()}`, { headers: { Accept: 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || '日历刷新失败');
      if (activeRequestRef.current !== requestId) return;
      setStats(Array.isArray(payload.days) ? payload.days : []);
      setMonthTotal(Number(payload.monthTotal || 0));
      setMonthCompletion(Number(payload.monthCompletion || 0));
    } finally {
      if (activeRequestRef.current === requestId) setLoading(false);
    }
  };

  const changeMonth = (offset: number) => {
    const next = addMonths(monthDate, offset);
    setMonthDate(next);
    void loadMonth(next);
  };

  const selectDate = (date: string) => {
    setSelectedDate(date);
    if (date.slice(0, 7) !== monthDate.slice(0, 7)) {
      setMonthDate(date);
      void loadMonth(date);
    }
    const params = new URLSearchParams(window.location.search);
    params.set('date', date);
    params.set('status', 'all');
    params.delete('overdue');
    if (assigneeId !== 'all') params.set('assigneeId', assigneeId);
    else params.set('assigneeId', 'all');
    if (priority !== 'all') params.set('priority', priority);
    else params.set('priority', 'all');
    if (keyword) params.set('keyword', keyword);
    else params.delete('keyword');
    window.history.replaceState({}, '', `${window.location.pathname}?${params.toString()}`);
    window.dispatchEvent(new CustomEvent('daily-notes:select-date', { detail: { date } }));
  };

  return (
    <div id="work-calendar" className={cn('workspaceCard calendarCard', loading && 'calendarLoading')}>
      <div className="calendarHead">
        <div>
          <span className="sectionLabel">CALENDAR</span>
          <h2>工作日历</h2>
        </div>
        <div className="monthSwitch">
          <button type="button" aria-label="上个月" onClick={() => changeMonth(-1)}>‹</button>
          <b>{monthDate.slice(0, 7)}</b>
          <button type="button" aria-label="下个月" onClick={() => changeMonth(1)}>›</button>
        </div>
      </div>
      <div className="calendarSummary">
        <span><b>{monthTotal}</b> 本月事项</span>
        <span><b>{monthCompletion}%</b> 本月完成率</span>
      </div>
      <div className="weekHeader">{['日', '一', '二', '三', '四', '五', '六'].map((item) => <span key={item}>{item}</span>)}</div>
      <div className="calendarGrid">
        {days.map((item) => {
          const stat = statsByDay.get(item.key) || { total: 0, done: 0 };
          const ratio = stat.total ? Math.round((stat.done / stat.total) * 100) : 0;
          return (
            <button
              type="button"
              key={item.key}
              className={cn('dayCell', !item.inMonth && 'mutedDay', item.key === selectedDate && 'selectedDay', item.isToday && 'todayDay', stat.total > 0 && 'hasTasks')}
              onClick={() => selectDate(item.key)}
              title={`${item.key}：${stat.total} 个事项，完成率 ${ratio}%`}
            >
              <span>{item.day}</span>
              {stat.total > 0 && <em>{stat.total}</em>}
              {stat.total > 0 && <i style={{ width: `${Math.max(18, ratio)}%` }} />}
            </button>
          );
        })}
      </div>
      <div className="calendarLegend"><span><i />有事项</span><span><i />当前日期</span><span>点击日期只刷新事项</span></div>
    </div>
  );
}
