'use client';

import { useEffect, useState } from 'react';

type ToastState = {
  message: string;
  tone: 'info' | 'success' | 'warning';
};

const STANDALONE_HINT_KEY = 'daily-notes-standalone-hint-shown';

function isStandaloneMode() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

export function PwaStatusToaster() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let timer: number | undefined;
    const show = (next: ToastState, timeout = 2800) => {
      window.clearTimeout(timer);
      setToast(next);
      timer = window.setTimeout(() => setToast(null), timeout);
    };

    const onOffline = () => show({ message: '网络已断开，可继续查看已缓存页面', tone: 'warning' }, 3800);
    const onOnline = () => {
      show({ message: '网络已恢复，正在刷新页面', tone: 'success' }, 1000);
      window.setTimeout(() => window.location.reload(), 900);
    };
    const onInstalled = () => show({ message: '已添加到桌面，下次可从图标打开', tone: 'success' }, 3600);

    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    window.addEventListener('appinstalled', onInstalled);

    if (isStandaloneMode() && window.localStorage.getItem(STANDALONE_HINT_KEY) !== '1') {
      window.localStorage.setItem(STANDALONE_HINT_KEY, '1');
      window.setTimeout(() => show({ message: '已进入桌面应用模式，下拉可刷新当前页面', tone: 'info' }, 2600), 900);
    }

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!toast) return null;

  return (
    <div className={`pwaStatusToast ${toast.tone}`} role="status" aria-live="polite">
      {toast.message}
    </div>
  );
}
