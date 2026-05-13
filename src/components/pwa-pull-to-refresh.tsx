'use client';

import { useEffect, useRef, useState } from 'react';

export function PwaPullToRefresh() {
  const [hint, setHint] = useState('');
  const hintRef = useRef('');

  useEffect(() => {
    hintRef.current = hint;
  }, [hint]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    let startY = 0;
    let pulling = false;
    let triggered = false;
    let hideTimer: number | undefined;

    const showHint = (message: string, timeout = 900) => {
      window.clearTimeout(hideTimer);
      hintRef.current = message;
      setHint(message);
      hideTimer = window.setTimeout(() => {
        hintRef.current = '';
        setHint('');
      }, timeout);
    };

    const onTouchStart = (event: TouchEvent) => {
      if (window.scrollY > 0) return;
      startY = event.touches[0]?.clientY || 0;
      pulling = startY > 0;
      triggered = false;
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!pulling || triggered || window.scrollY > 0) return;
      const currentY = event.touches[0]?.clientY || 0;
      const delta = currentY - startY;
      if (delta > 44 && delta <= 90 && hintRef.current !== '继续下拉刷新') showHint('继续下拉刷新');
      if (delta > 90) {
        triggered = true;
        showHint('正在刷新…', 500);
        window.setTimeout(() => window.location.reload(), 120);
      }
    };

    const onTouchEnd = () => {
      pulling = false;
      triggered = false;
      if (hintRef.current === '继续下拉刷新') {
        hintRef.current = '';
        setHint('');
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      window.clearTimeout(hideTimer);
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
    };
  }, []);

  if (!hint) return null;
  return <div className="pwaPullHint" role="status" aria-live="polite">{hint}</div>;
}
