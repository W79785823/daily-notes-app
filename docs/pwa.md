# PWA 安装与离线体验

已为 `https://m.xwr.me` 增加 PWA 安装引导、正式位图图标和更稳的离线缓存。

## 当前能力

- `manifest`：`public/site.webmanifest`
- 图标：`public/icon-192.png`、`public/icon-512.png`、`public/apple-touch-icon.png`
- service worker：`public/sw.js`
- 离线页：`/offline`
- 首页安装引导横幅：`PwaInstallBanner`

## 这次新增的四项

### 1. 正式位图图标

除了 `icon.svg`，还新增了 PNG 版图标：

- `icon-192.png`
- `icon-512.png`
- `apple-touch-icon.png`

这样对旧浏览器和 iPhone 更友好。

### 2. 已安装状态识别

如果浏览器已经以独立窗口/PWA 方式打开，安装横幅不会再打扰。

### 3. 更稳的离线缓存

- 导航请求：网络优先，失败后回退到缓存页面或 `/offline`
- 静态资源：缓存优先
- 缓存版本：`daily-notes-pwa-v3`

### 4. iPhone 添加桌面说明

横幅会在 iPhone/Safari 下显示更明确的“添加到主屏幕”引导。

## 手动验证

1. 用手机浏览器打开 `https://m.xwr.me`
2. 看是否出现安装引导
3. 安装到主屏幕
4. 断网后刷新，检查是否回退到离线页或缓存内容

## 后续还能再加强

- 让首页最近一次任务列表更细粒度缓存
- 增加“已安装”更明显的顶部状态
- 做更漂亮的正式图标套件
- 给 iPhone 加一张图文步骤卡
