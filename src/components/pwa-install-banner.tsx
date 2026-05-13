'use client';

import { useEffect, useState } from 'react';

const DISMISS_KEY = 'daily-notes-install-banner-dismissed';

function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(ua) && /safari/.test(ua) && !/crios|fxios|edgios/.test(ua);
}

export function PwaInstallBanner() {
  const [available, setAvailable] = useState(false);
  const [visible, setVisible] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const dismissed = window.localStorage.getItem(DISMISS_KEY) === '1';
    const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (window.navigator as Navigator & { standalone?: boolean }).standalone;
    if (standalone) {
      setInstalled(true);
      return;
    }
    if (dismissed) return;

    setIos(isIosSafari());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setAvailable(true);
      setVisible(true);
    };

    const onAppInstalled = () => {
      setVisible(false);
      setAvailable(false);
      setPromptEvent(null);
      setInstalled(true);
      window.localStorage.setItem(DISMISS_KEY, '1');
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
    window.addEventListener('appinstalled', onAppInstalled);

    // iOS / Safari 没有 beforeinstallprompt 时，提供静态提示。
    if (!('beforeinstallprompt' in window)) {
      setVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt as EventListener);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  if (!visible || installed) return null;

  const install = async () => {
    if (!promptEvent) {
      window.localStorage.setItem(DISMISS_KEY, '1');
      setVisible(false);
      return;
    }
    promptEvent.prompt();
    await promptEvent.userChoice.catch(() => null);
    window.localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  const dismiss = () => {
    window.localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  return (
    <section className="pwaInstallBanner workspaceCard">
      <div>
        <span className="sectionLabel">PWA</span>
        <h2>{ios ? 'iPhone 可添加到主屏幕' : '添加到桌面，更像一个 App'}</h2>
        <p>
          {available
            ? '现在可以直接安装到手机桌面，像原生应用一样打开。'
            : ios
              ? '请点浏览器底部或顶部的分享按钮，再选择“添加到主屏幕”。'
              : '当前浏览器暂未提供一键安装按钮，你也可以从浏览器菜单里选择“添加到主屏幕”。'}
        </p>
      </div>
      <div className="pwaInstallActions">
        {available ? <button className="fullButton" onClick={install}>添加到桌面</button> : <a className="fullButton" href="/offline">查看离线页</a>}
        <button className="ghostButton" onClick={dismiss}>稍后</button>
      </div>
    </section>
  );
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void> | void;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};
