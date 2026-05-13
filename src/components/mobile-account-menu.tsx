'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  name: string;
  roleLabel: string;
  todayHref: string;
  settingsHref: string;
};

export function MobileAccountMenu({ name, roleLabel, todayHref, settingsHref }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className="mobileAccountMenu">
      <button
        type="button"
        className="mobileAccountButton"
        aria-label="当前账号菜单"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {name?.slice(0, 1) || '我'}
      </button>
      {open && (
        <div className="accountChipMenu">
          <div className="accountMenuHeader">
            <b>{name}</b>
            <small>{roleLabel}</small>
          </div>
          <a href={todayHref} onClick={() => setOpen(false)}>回到今天</a>
          <a href={settingsHref} onClick={() => setOpen(false)}>账号设置</a>
          <form action="/api/auth/logout" method="post" onSubmit={() => setOpen(false)}>
            <button type="submit">退出登录</button>
          </form>
        </div>
      )}
    </div>
  );
}
