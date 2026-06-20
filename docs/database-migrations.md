# 数据库变更规范

本项目生产数据库通过 PostgreSQL 容器或直装 PostgreSQL 运行，生产连接由 `daily-notes-app.service` 的 `DATABASE_URL` 管理。

## 原则

- 不直接在生产环境执行裸 `npx prisma db push`，避免读取错误 `.env` 连到旧库或测试库。
- 所有结构变更需要写入 `prisma/migrations/<timestamp>_<name>/migration.sql`。
- 上线前先备份，再执行 SQL，再 `npx prisma generate`、超管 bootstrap、测试、构建、发布。

## 当前已执行变更

### 20260618090000_multi_tenant

目的：增加多团队 SaaS 地基，包括 `Team`、`Invite`、租户 `teamId`、平台超管标记，并把存量数据回填到「默认团队」。

执行后需要运行：

```bash
npx prisma generate
SUPER_ADMIN_LOGIN=你的超管账号 SUPER_ADMIN_PASSWORD=强密码 npm run bootstrap:superadmin
npm run verify:multi-tenant-db
```

建议用一次性环境变量执行 `npm run bootstrap:superadmin`，不要把真实超管密码写入 .env 或提交到仓库。

上线前建议先在本地跑 `npm run verify:multi-tenant-db`。该命令会启动临时 PostgreSQL，模拟旧版单租户表结构和存量数据，执行本迁移，并验证注册、邀请、团队隔离、超管停用/恢复入口、超管重置密码和多团队提醒脚本。

注意：`User.teamId` 外键为 `ON DELETE SET NULL`，团队删除会让成员脱离团队。v1 平台超管只支持停用/恢复团队，不提供删除团队入口。

### 生产升级顺序

如果你是在旧库上升级，推荐按下面顺序做：

1. 备份生产库和应用目录。
2. `git pull origin main`
3. 执行 `prisma/migrations/20260618090000_multi_tenant/migration.sql`
4. `npx prisma generate`
5. `SUPER_ADMIN_LOGIN=... SUPER_ADMIN_PASSWORD=... npm run bootstrap:superadmin`
6. `npm run verify:multi-tenant-db`
7. `npm test`
8. `npm run build`
9. `npm run deploy:prod`

### 直装执行示例

```bash
cd /data/daily-notes-app
sudo systemctl start daily-notes-backup.service
psql "$DATABASE_URL" -f prisma/migrations/20260618090000_multi_tenant/migration.sql
npx prisma generate
SUPER_ADMIN_LOGIN=platform-admin SUPER_ADMIN_PASSWORD='强密码' npm run bootstrap:superadmin
npm run verify:multi-tenant-db
```

### Docker 执行示例

```bash
cd /data/daily-notes-app
docker exec -i daily-notes-app-postgres-1 psql -U daily_notes -d daily_notes \
  < prisma/migrations/20260618090000_multi_tenant/migration.sql
npx prisma generate
SUPER_ADMIN_LOGIN=platform-admin SUPER_ADMIN_PASSWORD='强密码' npm run bootstrap:superadmin
npm run verify:multi-tenant-db
```

### 20260512132000_add_user_session_version

目的：用户修改密码或管理员重置密码后，让该用户旧登录态全部失效。

SQL：

```sql
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 0;
```

生产库已执行，并已验证：

- 旧 cookie 在密码变更后访问 `/api/tasks` 返回 `401`
- 新密码重新登录正常

## 推荐生产执行方式

```bash
cd /data/daily-notes-app
sudo systemctl start daily-notes-backup.service
cat prisma/migrations/20260512132000_add_user_session_version/migration.sql | \
  docker exec -i daily-notes-app-postgres-1 psql -U daily_notes -d daily_notes
npx prisma generate
npm test
npm run build
npm run deploy:prod
```

如果是多租户升级，把上面的 `migration.sql` 执行和 `bootstrap:superadmin` 插入到 `npx prisma generate` 之前。
