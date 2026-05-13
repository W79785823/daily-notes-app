# 每日事项

面向内部团队使用的每日事项协作工具，当前只维护 **Web / 移动 Web / PWA** 版本。

> 说明：微信小程序方向已放弃，仓库不再保留小程序、微信云开发云函数、微信登录/API 复用约定等内容。

## 已实现

- 人员：姓名、角色、启用状态、单独权限数组
- 角色：成员、管理员（成员能力由管理员单独勾选权限控制）
- 权限点：`task.create`、`task.assign`、`task.view_all`、`task.edit_all`、`task.delete`、`task.complete_other`、`user.manage`、`permission.manage`
- 事项：标题、备注、日期、创建人、负责人、完成状态、软删除
- 认证：账号密码登录、Session Cookie、生产环境关闭开发身份头
- 页面：移动优先的今日事项、管理中心、账号设置、公告、工作日历
- 数据库：PostgreSQL + Prisma
- 部署：Docker Compose / systemd 生产部署脚本
- 提醒：`npm run reminder:daily` 可生成每日/逾期事项提醒文本，后续可接企业微信、Telegram 等通知通道
- PWA：支持安装到桌面、离线页、桌面应用模式提示和移动端体验优化，说明见 `docs/pwa.md`

## 本地运行

```bash
cp .env.example .env
npm install

# 启动 PostgreSQL
docker compose up -d postgres

npm run db:generate
npx prisma db push
npm run dev
```

打开：

```text
http://localhost:3000
```

也可以直接：

```bash
docker compose up
```

## 生产认证建议

开发环境可按需要临时开启：

```bash
AUTH_ALLOW_DEV_USER_HEADER="true"
```

生产环境必须关闭开发身份头，并设置高强度随机 Session 密钥：

```bash
AUTH_ALLOW_DEV_USER_HEADER="false"
SESSION_SECRET="换成足够长的随机字符串"
```

这样 JSON API 只接受正常登录后的会话，不再接受 `x-user-id` 或 URL 里的 `userId` 调试身份。

## 提醒生成器

```bash
npm run reminder:daily
```

详细说明见：`docs/reminders.md`。

## 测试与构建

```bash
npm test
npm run build
```

## 生产部署

项目支持两种常见部署方式：

- **Ubuntu 服务器直装**：适合你自己管理 Node.js、systemd、Nginx 的场景
- **Docker / Docker Compose**：适合快速迁移、环境一致性更强的场景

### 方式一：Ubuntu 服务器直装

#### 1. 安装运行环境

在 Ubuntu 上准备：

- Node.js 22+
- npm
- PostgreSQL 16+
- 可选：Nginx、systemd

#### 2. 拉取代码

```bash
cd /data
sudo git clone https://github.com/W79785823/daily-notes-app.git
cd daily-notes-app
```

如果已经有目录，就直接：

```bash
cd /data/daily-notes-app
sudo git pull
```

#### 3. 配置环境变量

复制示例配置并修改：

```bash
cp .env.example .env
```

至少要改好：

- `DATABASE_URL`
- `SESSION_SECRET`
- `AUTH_ALLOW_DEV_USER_HEADER=false`

#### 4. 安装依赖并生成 Prisma 客户端

```bash
npm install
npm run db:generate
```

#### 5. 准备数据库

如果是新库，先初始化表结构：

```bash
npx prisma db push
```

如果你后续使用迁移方式，建议按 `docs/database-migrations.md` 里的流程执行。

#### 6. 先做自检

```bash
npm test
npm run build
npm run check:prod
```

#### 7. 启动服务

开发态可直接：

```bash
npm run dev
```

生产环境建议使用 systemd 管理，启动脚本见：

```bash
npm run deploy:prod
```

这个脚本会执行：

- 测试
- 构建
- 生产环境检查
- 重启服务
- 健康检查

#### 8. 配置反向代理

如果你要挂域名，建议用 Nginx 反代到本地 `3000` 端口，并开启 HTTPS。

---

### 方式二：Docker / Docker Compose

#### 1. 安装 Docker

Ubuntu 上先安装：

- Docker Engine
- Docker Compose 插件

#### 2. 拉取代码

```bash
cd /data
sudo git clone https://github.com/W79785823/daily-notes-app.git
cd daily-notes-app
```

#### 3. 配置环境变量

同样先复制：

```bash
cp .env.example .env
```

然后把 `DATABASE_URL`、`SESSION_SECRET` 等改成正式值。

#### 4. 启动 PostgreSQL 和 Web

```bash
docker compose up -d
```

如果只想先启动数据库：

```bash
docker compose up -d postgres
```

#### 5. 初始化数据库

首次启动后执行：

```bash
npm install
npm run db:generate
npx prisma db push
```

#### 6. 验证

```bash
npm test
npm run build
```

#### 7. 访问

默认访问：

```text
http://服务器IP:3000
```

---

### 生产认证建议

开发环境可按需要临时开启：

```bash
AUTH_ALLOW_DEV_USER_HEADER="true"
```

生产环境必须关闭开发身份头，并设置高强度随机 Session 密钥：

```bash
AUTH_ALLOW_DEV_USER_HEADER="false"
SESSION_SECRET="换成足够长的随机字符串"
```

这样 JSON API 只接受正常登录后的会话，不再接受 `x-user-id` 或 URL 里的 `userId` 调试身份。

## 提醒生成器

```bash
npm run reminder:daily
```

详细说明见：`docs/reminders.md`。

## 测试与构建

```bash
npm test
npm run build
```

## 生产部署

当前服务器生产部署脚本：

```bash
npm run deploy:prod
```

部署前请确认生产环境变量、数据库连接和备份策略。数据库变更说明见：`docs/database-migrations.md`。
