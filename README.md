# 每日事项小便签 MVP

公司内部使用的每日事项提醒/协作小便签初版。

## 已实现

- 人员：姓名、角色、启用状态、单独权限数组
- 角色：成员、管理员（成员能力由管理员单独勾选权限控制）
- 权限点：`task.create`、`task.assign`、`task.view_all`、`task.edit_all`、`task.delete`、`task.complete_other`、`user.manage`、`permission.manage`
- 事项：标题、备注、日期、创建人、负责人、完成状态、软删除
- API：任务列表/创建/编辑/删除/完成，用户列表/创建，初始化示例数据
- 认证：开发态兼容 `x-user-id`，同时提供 Bearer session token 和微信 `openid` 绑定骨架，方便后续接微信小程序
- 页面：每日事项看板、用户切换、人员权限概览
- 数据库：PostgreSQL + Prisma
- 容器：Docker Compose，后续可接 Caddy 域名
- 提醒：`npm run reminder:daily` 可生成每日/逾期事项提醒文本，后续可接微信服务号、企业微信或 Telegram
- PWA：`docs/pwa.md` 说明安装到桌面、位图图标和离线体验
## 本地运行

```bash
cp .env.example .env
npm install
# 启动 PostgreSQL

docker compose up -d postgres
npx prisma generate
npx prisma db push
npm run dev
```

打开 `http://localhost:3000`。

也可以直接：

```bash
docker compose up
```

## API 约定（方便后续微信小程序复用）

认证优先使用 Bearer token：

1. 开发/内测登录：`POST /api/auth/login`，JSON: `{ "userId": "..." }` 或 `{ "name": "管理员" }`
2. 微信登录：配置 `WECHAT_APP_ID` / `WECHAT_APP_SECRET` 后，`POST /api/auth/login`，JSON: `{ "code": "wx.login 返回的 code" }`
3. 首次绑定可由管理员调用 `PATCH /api/users/:id/wechat`，或在可信内测场景临时用 `{ "code": "...", "userId": "..." }` 绑定
4. 响应会返回 `{ "token": "...", "user": {...} }`
5. 后续请求带请求头：`Authorization: Bearer <token>`

当前 Web MVP 仍保留 `x-user-id` 和 `?userId=` 作为开发兼容。上线前把 `AUTH_ALLOW_DEV_USER_HEADER=false`，即可关闭开发兼容，只保留 Bearer token。未登录的 JSON API 会返回 `401 auth.unauthorized`，不会自动兜底成管理员。

- `POST /api/auth/login` JSON: `{ "userId": "..." }`、`{ "name": "管理员" }` 或 `{ "code": "wx-login-code" }`
- `PATCH /api/users/:id/wechat` JSON: `{ "wechatOpenId": "...", "wechatUnionId": "..." }`
- `DELETE /api/users/:id/wechat`
- `GET /api/tasks?date=YYYY-MM-DD`
- `POST /api/tasks` JSON: `{ "title": "...", "note": "...", "date": "2026-05-11", "assigneeId": "..." }`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `POST /api/tasks/:id/complete` JSON: `{ "completed": true }` 或 `{ "completed": false }`
- `GET /api/users`
- `POST /api/users`
- `POST /api/seed`

## 生产认证建议

开发环境 `.env` 可保留：

```bash
AUTH_ALLOW_DEV_USER_HEADER="true"
```

生产环境建议改为：

```bash
AUTH_ALLOW_DEV_USER_HEADER="false"
SESSION_SECRET="换成足够长的随机字符串"
```

这样 JSON API 只接受 `Authorization: Bearer <token>`，不会接受 `x-user-id` 或 URL 里的 `userId`。

## 提醒生成器

```bash
npm run reminder:daily
```

详细说明见：`docs/reminders.md`。

## 测试

```bash
npm test
npm run build
```
