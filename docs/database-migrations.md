# 数据库变更规范

本项目生产数据库通过 PostgreSQL 容器运行，生产连接由 `daily-notes-app.service` 的 `DATABASE_URL` 管理。

## 原则

- 不直接在生产环境执行裸 `npx prisma db push`，避免读取错误 `.env` 连到旧库或测试库。
- 所有结构变更需要写入 `prisma/migrations/<timestamp>_<name>/migration.sql`。
- 上线前先备份，再执行 SQL，再 `npx prisma generate`、测试、构建、发布。

## 当前已执行变更

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
