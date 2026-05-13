import { ServiceWorkerRegistrar } from '@/components/service-worker-registrar';
import { PwaPullToRefresh } from '@/components/pwa-pull-to-refresh';
import { PwaStatusToaster } from '@/components/pwa-status-toaster';
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '每日事项',
  description: '团队每日事项提醒和协作清单',
  manifest: '/site.webmanifest',
  icons: {
    icon: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    title: '每日事项',
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#244c3b',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <ServiceWorkerRegistrar />
        <PwaPullToRefresh />
        <PwaStatusToaster />
        {children}
      </body>
    </html>
  );
}
