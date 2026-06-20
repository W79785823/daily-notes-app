# 每日事项

面向内部团队和小团队使用的每日事项协作工具，当前维护 **Web / 移动 Web / PWA** 版本，已支持多团队 SaaS 模式。

> 说明：微信小程序方向已放弃，仓库不再保留小程序、微信云开发云函数、微信登录/API 复用约定等内容。

## 已实现

- 团队：自助注册建团队、邀请成员加入、团队数据隔离、平台超管
- 人员：姓名、角色、启用状态、单独权限数组
- 角色：成员、管理员（成员能力由管理员单独勾选权限控制）
- 权限点：`task.create`、`task.assign`、`task.view_all`、`task.edit_all`、`task.delete`、`task.complete_other`、`user.manage`、`permission.manage`
- 事项：标题、备注、日期、创建人、负责人、完成状态、软删除
- 认证：账号密码登录、Session Cookie、生产环境关闭开发身份头
- 页面：移动优先的今日事项、管理中心、账号设置、公告、工作日历、注册页、加入页、超管台
- 数据库：PostgreSQL + Prisma，多租户迁移脚本
- 部署：Docker Compose / systemd 生产部署脚本、迁移验证脚本、超管 bootstrap
- 提醒：`npm run reminder:daily` 可生成每日/逾期事项提醒文本，后续可接企业微信、Telegram 等通知通道
- PWA：支持安装到桌面、离线页、桌面应用模式提示和移动端体验优化，说明见 `docs/pwa.md`

## 本次更新（多团队版）

- 完成多团队 SaaS 改造：自助注册建团队、邀请码加入、团队数据隔离。
- 新增平台超管后台：停用 / 恢复团队、重置成员密码、查看团队列表。
- 补齐注册、加入、超管页面和对应 API，登录 / 管理页也同步更新了样式和文案。
- 数据库迁移、超管 bootstrap、验证脚本和生产部署流程都已补齐。

如果想看更细的改动记录，可以继续看：

- `docs/multi-tenant-plan.md`
- `docs/multi-tenant-fixes.md`
- `docs/multi-tenant-ux-review.md`

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

## 生产部署

项目支持两种常见部署方式：

- **Ubuntu 服务器直装**：适合你自己管理 Node.js、systemd、Nginx 的场景。
- **Docker / Docker Compose**：适合快速迁移，PostgreSQL 和 Web 服务由 Compose 统一管理。

### 升级现有生产库到多租户版

如果你已经有旧版生产库，先按这个顺序升级，再重启服务：

```bash
cd /data/daily-notes-app
git pull origin main
sudo systemctl start daily-notes-backup.service

# 直装示例
psql "$DATABASE_URL" -f prisma/migrations/20260618090000_multi_tenant/migration.sql

# Docker 示例（按实际容器名调整）
# docker exec -i daily-notes-app-postgres-1 psql -U daily_notes -d daily_notes \
#   < prisma/migrations/20260618090000_multi_tenant/migration.sql

npx prisma generate
SUPER_ADMIN_LOGIN=platform-admin SUPER_ADMIN_PASSWORD='强密码' npm run bootstrap:superadmin
npm run verify:multi-tenant-db
npm run deploy:prod
```

> `npm run deploy:prod` 会继续执行测试、构建、生产检查、重启服务和冒烟测试。迁移一定要先做完，再跑部署脚本。

### 部署前准备

无论使用哪种方式，都需要先准备：

- 一台 Ubuntu 服务器，建议 Ubuntu 22.04 或 24.04。
- 一个可访问 GitHub 私有仓库的账号或 Token。
- 一个域名，可选；如果不用域名，可先用 `http://服务器IP:3000` 测试。
- 一份生产环境变量文件 `.env`，不要把真实 `.env` 提交到 GitHub。

关键环境变量：

```bash
DATABASE_URL="postgresql://用户名:密码@数据库地址:5432/数据库名?schema=public"
SESSION_SECRET="至少32位以上的随机字符串"
AUTH_ALLOW_DEV_USER_HEADER="false"
```

生成随机 `SESSION_SECRET` 示例：

```bash
openssl rand -base64 48
```

> 生产环境必须保持 `AUTH_ALLOW_DEV_USER_HEADER="false"`，否则 API 可能接受调试身份头。

---

### 方式一：Ubuntu 服务器直装

适合已经有 PostgreSQL、Nginx、systemd 管理经验的服务器。

#### 1. 安装系统依赖

```bash
sudo apt update
sudo apt install -y git curl ca-certificates build-essential openssl
```

安装 Node.js 22 示例：

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

如果数据库也放在同一台服务器：

```bash
sudo apt install -y postgresql postgresql-contrib
```

#### 2. 拉取代码

```bash
sudo mkdir -p /data
sudo chown -R "$USER":"$USER" /data
cd /data
git clone https://github.com/W79785823/daily-notes-app.git
cd daily-notes-app
```

以后更新代码：

```bash
cd /data/daily-notes-app
git pull origin main
```

#### 3. 配置 `.env`

```bash
cp .env.example .env
nano .env
```

把里面的 `DATABASE_URL`、`SESSION_SECRET`、`AUTH_ALLOW_DEV_USER_HEADER` 改成生产值。

#### 4. 安装依赖和生成 Prisma 客户端

```bash
npm ci
npm run db:generate
```

如果没有 `package-lock.json` 或依赖需要重新解析，可用：

```bash
npm install
```

#### 5. 初始化或迁移数据库

新数据库首次部署可以执行：

```bash
npx prisma db push
```

已有生产库或后续结构变更，优先按迁移文档执行：

```bash
docs/database-migrations.md
```

如果你是在升级已有生产库，先执行迁移 SQL，再 `npx prisma generate`、bootstrap 超管、跑验证脚本，不要直接依赖 `db push`。

#### 6. 构建和自检

```bash
npm test
npm run build
npm run check:prod
```

#### 7. 启动服务

临时测试：

```bash
npm run start
```

生产建议使用 systemd 管理，例如创建：

```bash
sudo nano /etc/systemd/system/daily-notes-app.service
```

示例内容：

```ini
[Unit]
Description=Daily Notes App
After=network.target

[Service]
Type=simple
WorkingDirectory=/data/daily-notes-app
EnvironmentFile=/data/daily-notes-app/.env
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

启用并启动：

```bash
sudo systemctl daemon-reload
sudo systemctl enable daily-notes-app
sudo systemctl start daily-notes-app
sudo systemctl status daily-notes-app --no-pager
```

查看日志：

```bash
journalctl -u daily-notes-app -f
```

#### 8. 配置 Nginx 反向代理，可选

如果要绑定域名，把 Nginx 反代到本地 `3000` 端口，并开启 HTTPS。

最小反代示例：

```nginx
server {
    listen 80;
    server_name 你的域名;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### 9. 后续更新

```bash
cd /data/daily-notes-app
git pull origin main
npm ci
npm run db:generate
npm test
npm run build
sudo systemctl restart daily-notes-app
```

当前服务器也可以使用封装脚本：

```bash
npm run deploy:prod
```

脚本会执行测试、构建、生产环境检查、重启服务和基础访问检查。正式使用前请确认脚本里的 `APP_DIR`、`SERVICE`、`BASE_URL` 是否符合当前服务器。

---

### 方式二：Docker / Docker Compose

适合新服务器快速部署，数据库和应用由 Compose 统一启动。

#### 1. 安装 Docker

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg git
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo docker version
sudo docker compose version
```

可选：允许当前用户直接运行 Docker：

```bash
sudo usermod -aG docker "$USER"
# 重新登录 SSH 后生效
```

#### 2. 拉取代码

```bash
sudo mkdir -p /data
sudo chown -R "$USER":"$USER" /data
cd /data
git clone https://github.com/W79785823/daily-notes-app.git
cd daily-notes-app
```

#### 3. 配置 `.env`

```bash
cp .env.example .env
nano .env
```

Docker Compose 内部数据库地址通常使用服务名 `postgres`，示例：

```bash
DATABASE_URL="postgresql://daily_notes:daily_notes_dev@postgres:5432/daily_notes?schema=public"
SESSION_SECRET="至少32位以上的随机字符串"
AUTH_ALLOW_DEV_USER_HEADER="false"
```

如果用于正式生产，请把 `docker-compose.yml` 里的数据库密码和 `.env` 里的 `DATABASE_URL` 密码一起改成强密码。

#### 4. 启动服务

开发/快速部署：

```bash
docker compose up -d
```

只启动数据库：

```bash
docker compose up -d postgres
```

查看状态：

```bash
docker compose ps
```

查看日志：

```bash
docker compose logs -f web
```

#### 5. 初始化数据库

如果使用当前 `docker-compose.yml`，`web` 服务启动时会执行 `npx prisma db push`。

如果你只启动了数据库，想在宿主机手动初始化：

```bash
npm install
npm run db:generate
npx prisma db push
```

如果这是旧库升级，请先执行 `prisma/migrations/20260618090000_multi_tenant/migration.sql`，再生成 Prisma 客户端并 bootstrap 超管，不要只靠 `db push`。

#### 6. 验证访问

默认端口：

```text
http://服务器IP:3000
```

本机检查：

```bash
curl -I http://127.0.0.1:3000
```

#### 7. 后续更新

```bash
cd /data/daily-notes-app
git pull origin main
docker compose down
docker compose up -d --build
```

如果只改了应用代码，也可以：

```bash
docker compose restart web
```

---

### 生产上线检查

上线或迁移到新服务器后，建议检查：

```bash
npm test
npm run build
npm run check:prod
npm run verify:multi-tenant-db
```

如果使用 Docker 且宿主机没有安装 Node.js，可进入容器或临时用 Node 镜像执行检查。

确认事项：

- `.env` 已配置生产数据库和强 `SESSION_SECRET`。
- `AUTH_ALLOW_DEV_USER_HEADER=false`。
- 多租户迁移已执行，`SUPER_ADMIN_LOGIN` / `SUPER_ADMIN_PASSWORD` 已 bootstrap。
- PostgreSQL 数据卷已持久化，不要把生产数据库放在临时容器文件系统里。
- 如果开放公网访问，建议使用 Nginx + HTTPS。
- 数据库变更和备份策略见 `docs/database-migrations.md`。

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
