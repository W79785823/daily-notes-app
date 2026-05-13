import type { CSSProperties } from 'react';
import { MobileAccountMenu } from '@/components/mobile-account-menu';

type HomeHeroProps = {
  currentUserName: string;
  roleLabel: string;
  todayHref: string;
  settingsHref: string;
  isPlainMember: boolean;
  canManageUsers: boolean;
  date: string;
  dateText: string;
  relativeText: string;
  previousHref: string;
  currentHref: string;
  nextHref: string;
  todayLinkHref?: string;
  quickFilterActive: 'all' | 'mine' | 'todo';
  allHref: string;
  mineHref: string;
  todoHref: string;
  completion: number;
  total: number;
  todo: number;
  mine: number;
};

export function HomeHero({
  currentUserName,
  roleLabel,
  todayHref,
  settingsHref,
  isPlainMember,
  canManageUsers,
  date,
  dateText,
  relativeText,
  previousHref,
  currentHref,
  nextHref,
  todayLinkHref,
  quickFilterActive,
  allHref,
  mineHref,
  todoHref,
  completion,
  total,
  todo,
  mine,
}: HomeHeroProps) {
  return (
    <section className="appHero">
      <MobileAccountMenu
        name={currentUserName || '我'}
        roleLabel={roleLabel}
        todayHref={todayHref}
        settingsHref={settingsHref}
      />
      <div className="heroCopy">
        <div className="kicker"><span>✦</span> 团队每日工作台</div>
        <h1 className="heroTitle" aria-label="把今天要做的事，清清楚楚排好。">
          <span className="titleLine titleLineTop"><span className="titleMark">把</span><span>今天</span><em>要做的事</em></span>
          <span className="titleLine titleLineBottom"><strong>清清楚楚</strong><span>排好</span><i>。</i></span>
        </h1>
        <p>{isPlainMember ? '这里会优先显示与你相关的今日事项。打开就看待办，完成后点一下就好。' : '每日事项、负责人、完成情况和团队公告统一放在这里。每天打开就知道今天谁负责什么、哪些事要一起推进。'}</p>
        <div className="heroActions heroAccountActions">
          <span className="heroIdentity"><small>当前账号</small><b>{currentUserName} · {roleLabel}</b></span>
          <a className="heroButton manageHeroLink" href={settingsHref}>{canManageUsers ? '管理中心' : '账号设置'}</a>
          <form action="/api/auth/logout" method="post"><button className="heroButton ghostHeroButton">退出登录</button></form>
        </div>
      </div>
      <div className="heroPanel glassPanel">
        <div className="panelTop">
          <span>{dateText}</span>
          <b>{relativeText}</b>
        </div>
        <nav className="mobileDateSwitcher" aria-label="切换事项日期">
          <a href={previousHref}>前一天</a>
          <a className="mobileDateCurrent" href={currentHref}>{date}</a>
          <a href={nextHref}>后一天</a>
          {todayLinkHref && <a className="mobileTodayLink" href={todayLinkHref}>回到今天</a>}
        </nav>
        <nav className="mobileQuickFilters" aria-label="快捷事项筛选">
          <a className={quickFilterActive === 'all' ? 'active' : undefined} href={allHref}>全部</a>
          <a className={quickFilterActive === 'mine' ? 'active' : undefined} href={mineHref}>我的</a>
          <a className={quickFilterActive === 'todo' ? 'active' : undefined} href={todoHref}>未完成</a>
        </nav>
        <div className="progressRing" style={{ '--progress': `${completion}%` } as CSSProperties}>
          <div><strong>{completion}%</strong><span>完成率</span></div>
        </div>
        <div className="miniMetrics">
          <span><b>{total}</b>全部</span>
          <span><b>{todo}</b>待办</span>
          <span><b>{mine}</b>与我相关</span>
        </div>
      </div>
    </section>
  );
}
