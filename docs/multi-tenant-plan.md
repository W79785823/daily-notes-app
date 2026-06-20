# 多租户改造计划：daily-notes-app → 多团队网页 SaaS

> 交接说明：本文件是给实现者（Codex）的完整方案，**只做网页/PWA 版，不做小程序**。
> 范围是把现在的单租户内部工具改成多团队 SaaS：负责人自助注册建团队、邀请成员、各团队数据严格隔离，外加一个平台超级管理员。
> 下面的文件路径、行号、函数签名均基于当前 `main` 分支代码核对过，可直接据此动手。

---

## 1. 背景与目标

现在 `daily-notes-app` 是**单租户**：整套系统服务一个组织，`User.name`/`loginName` 全局唯一，所有查询直接打全表（无团队概念）。

目标改造为**多团队网页 SaaS**：
- 任意小团队负责人可**自助注册**，注册即建团队并成为该团队 owner。
- owner（或有 `user.manage` 权限者）可**邀请成员**加入本团队。
- **各团队数据严格隔离**，互不可见。
- 增加一个**平台超级管理员**：凌驾于所有团队之上，可停用/恢复团队、重置任意成员密码、查看团队列表。

## 2. 已锁定的决定

- **一个账号 = 一个团队**（v1 不做跨团队切换）。
- **用「用户名 + 密码」登录，不用邮箱**：`loginName` 保持**全局唯一**作为登录标识（现 schema 本就全局唯一，不用改）；只把显示名 `name` 改为**团队内唯一**。两个团队都想用 "zhang" 当登录名时，第二个需换一个（如 zhang3）——对小团队可接受。
- **平台超管不属于任何团队**（`teamId = null`、`isSuperAdmin = true`），是**唯一有意绕过租户隔离**的角色：其接口单独鉴权 + 全程写审计，不开放自助注册，部署时按环境变量 bootstrap。
- **隔离在数据层强制**：用 Prisma Client Extension 包一个「按当前团队预绑定」的 client，对租户表自动注入 `teamId`，杜绝某个接口忘加过滤导致跨团队漏数据。

## 3. 现状关键事实（已核对代码）

- 会话已同时支持 `Bearer` token 与 Cookie（[session.ts:64-71](src/lib/session.ts)）→ 网页/PWA 沿用 Cookie，不用改认证机制。
- 数据访问散落在各处**手写 `where`**：API 路由 + 两个服务端页面 [page.tsx:91-121](src/app/page.tsx)、[manage/page.tsx:52-56](src/app/manage/page.tsx)。共约 12 处直接用 `prisma.*`（`getRequestUser` 有 12 个调用点）。
- 登录按 `loginName` 全局查用户（[login/route.ts:15](src/app/api/auth/login/route.ts)）——本方案下基本不变。
- 现有「只允许一个 ADMIN」规则（[users/route.ts:7,48](src/app/api/users/route.ts)、[users/[id]/status/route.ts:58-60](src/app/api/users/[id]/status/route.ts)）→ 改为「每个团队一个 owner」。
- 权限模型集中在 [permissions.ts](src/lib/permissions.ts)，判定在 [auth.ts](src/lib/auth.ts)，**无需改权限点**，只需让数据范围带上 `teamId`。
- **迁移工作流是手写 SQL**（见 [docs/database-migrations.md](docs/database-migrations.md)）：在 `prisma/migrations/<时间戳>_<名字>/migration.sql` 写 SQL，用 `psql` 手动执行，再 `npx prisma generate`。**不要用 `prisma migrate dev` 自动生成**——本仓库没有完整 baseline 迁移。
- `getCurrentUser`（[api.ts:32-44](src/lib/api.ts)）里有 `prisma.user.upsert({ where: { name: '管理员' } })`，`name` 不再全局唯一后**此处会编译报错，必须改**（见阶段 4）。`seedIfEmpty`（[api.ts:46](src/lib/api.ts)）目前无人调用，但也要随之适配，保证可编译。

---

## 4. 实施方案（分阶段）

### 阶段 1 — Schema + 迁移（核心地基）

**文件**：`prisma/schema.prisma` + 新建 `prisma/migrations/<ts>_multi_tenant/migration.sql`

Schema 改动：
1. 新增 `Team`：
   ```prisma
   model Team {
     id        String   @id @default(cuid())
     name      String
     ownerId   String?               // 指向 owner 用户，注册事务内回填；保持普通字段避免与 User.team 形成第二条关系
     active    Boolean  @default(true) // false = 被超管停用/取消使用权
     createdAt DateTime @default(now())
     updatedAt DateTime @updatedAt
     users         User[]
     tasks         Task[]
     announcements Announcement[]
     auditLogs     AuditLog[]
     invites       Invite[]
   }
   ```
2. 新增 `Invite`：
   ```prisma
   model Invite {
     id          String    @id @default(cuid())
     teamId      String
     code        String    @unique
     role        Role      @default(MEMBER)
     permissions String[]  @default([])
     expiresAt   DateTime?
     maxUses     Int       @default(1)
     usedCount   Int       @default(0)
     createdById String
     createdAt   DateTime  @default(now())
     team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
     @@index([teamId])
   }
   ```
3. `User` 改造：加 `teamId String?`（可空，超管无团队）+ `team Team? @relation(...)`；加 `isSuperAdmin Boolean @default(false)`；**删除 `name @unique`**，改加 `@@unique([teamId, name])`；加 `@@index([teamId])`。`loginName String? @unique` **维持全局唯一不变**。
4. 租户表加 `teamId`：
   - `Task`：`teamId String` + `team Team @relation(...)` + `@@index([teamId])`
   - `Announcement`：同上
   - `AuditLog`：`teamId String?`（**可空**——超管平台操作可不挂团队或挂目标团队）+ `team Team? @relation(...)` + `@@index([teamId])`

> 注意 `@@unique([teamId, name])` 在 Postgres 里 NULL 视为彼此不冲突，所以多个超管（teamId=null）即使同名也不冲突，符合预期。

迁移 SQL（手写，遵循本仓库约定；放进一个 `BEGIN; ... COMMIT;` 事务，**FK 用 `DO $$ ... EXCEPTION WHEN duplicate_object THEN NULL; END $$` 包裹**以便可重跑）：
1. `CREATE TABLE "Team"`、`"Invite"`（含 `Invite_code_key` 唯一索引、`Invite_teamId_idx`）。
2. `ALTER TABLE "User" ADD COLUMN "teamId" TEXT`、`ADD COLUMN "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false`。
3. `ALTER TABLE "Task"/"Announcement"/"AuditLog" ADD COLUMN "teamId" TEXT`（先可空）。
4. **Backfill**（`DO` 块，仅当不存在任何 Team 时执行）：建一个「默认团队」；把所有 `isSuperAdmin=false` 且 `teamId IS NULL` 的 User、所有 Task/Announcement/AuditLog 的 `teamId` 指向它；把该团队最早的 ADMIN 设为 `Team.ownerId`。
5. `ALTER TABLE "Task"/"Announcement" ALTER COLUMN "teamId" SET NOT NULL`（`AuditLog.teamId` 保持可空，`User.teamId` 保持可空）。
6. `DROP INDEX IF EXISTS "User_name_key"`；`CREATE UNIQUE INDEX "User_teamId_name_key" ON "User"("teamId","name")`；`CREATE INDEX "User_teamId_idx"`。
7. 各租户表建 `*_teamId_idx` 索引。
8. 加外键：`User.teamId→Team(id)`（ON DELETE SET NULL）、`Task/Announcement.teamId→Team`（RESTRICT）、`AuditLog.teamId→Team`（SET NULL）、`Invite.teamId→Team`（CASCADE）。
9. 跑完 `npx prisma generate`，并在 [docs/database-migrations.md](docs/database-migrations.md) 追加这条变更说明。

**超管 bootstrap**：新增 `scripts/bootstrap-super-admin.js`（CommonJS，复用 [password.ts](src/lib/password.ts) 的 `scrypt:salt:hash` 格式自己内联实现），按环境变量 `SUPER_ADMIN_LOGIN` / `SUPER_ADMIN_PASSWORD` upsert 一个 `isSuperAdmin=true, teamId=null` 的账号；`package.json` 加 `"bootstrap:superadmin"` 脚本；`.env.example` 补充这两个变量说明。

### 阶段 2 — 租户隔离层

**新文件 `src/lib/tenant.ts`**：
```ts
import { prisma } from './db';

const TENANT_MODELS = new Set(['User', 'Task', 'Announcement', 'AuditLog', 'Invite']);
const WHERE_OPS = new Set(['findFirst','findFirstOrThrow','findMany','count','aggregate','groupBy','updateMany','deleteMany']);

export function tenantDb(teamId: string) {
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          if (TENANT_MODELS.has(model)) {
            const a = args as { where?: Record<string, unknown>; data?: unknown };
            if (WHERE_OPS.has(operation)) {
              a.where = { ...(a.where ?? {}), teamId };
            } else if (operation === 'create') {
              a.data = { ...(a.data as Record<string, unknown>), teamId };
            } else if (operation === 'createMany') {
              const d = a.data;
              a.data = Array.isArray(d)
                ? d.map((x) => ({ ...(x as Record<string, unknown>), teamId }))
                : { ...(d as Record<string, unknown>), teamId };
            }
            // findUnique/update/delete/upsert 按 id：Prisma 唯一 where 类型塞不进 teamId，
            // 不在此注入，改由调用方 assertSameTeam 兜底（见下）。
          }
          return query(args);
        },
      },
    },
  });
}

export function assertSameTeam(row: { teamId: string | null } | null | undefined, teamId: string) {
  return !!row && row.teamId === teamId;
}
```
**关键规则（实现者务必遵守）**：
- 租户表的**集合操作**（findMany/count/groupBy/create…）一律走 `tenantDb(user.teamId)`，自动带 `teamId`。
- 租户表的**按 id 操作**（findUnique→改/删）：先用 `tenantDb` 或裸 `prisma` 取出，立刻 `assertSameTeam(row, user.teamId)`，不通过当 404/403；通过后再按 id update/delete。
- **登录、邀请接受、超管**这三类**有意走裸 `prisma`**（跨团队/全局），其余任何访问租户表的地方都不许用裸 `prisma`。

**改 [src/lib/session.ts](src/lib/session.ts)**：`getRequestUser` 的 `findUnique` 改为 `include: { team: true }`；除现有 active/sessionVersion 校验外，新增：**若 `!user.isSuperAdmin && user.team && !user.team.active` → 返回 null**（团队被停用即全员视为未授权）。

### 阶段 3 — 注册 + 邀请流程（新）

- `src/app/api/auth/register/route.ts`：入参 `{ teamName, loginName, password, displayName }` → 校验 `loginName` 全局未占用（`prisma.user.findUnique({where:{loginName}})`）→ `prisma.$transaction`：建 `Team` → 建 owner `User(teamId, name=displayName, loginName, passwordHash, role:'ADMIN', active:true)` → 回填 `Team.ownerId` → 写审计 → 签发 session（`createSessionToken(owner.id, owner.sessionVersion)`）→ 设 Cookie（`sessionCookieOptions()`）。表单走 303 跳 `/`，JSON 返回 `{ token, user }`。
- `src/app/register/page.tsx`：注册表单（团队名 / 显示名 / 登录名 / 密码），POST 到上面接口；登录页加入口链接。
- `src/app/api/invites/route.ts`：
  - `POST`（鉴权：`canManageUsers`）：用 `crypto.randomBytes` 生成 `code`，`tenantDb(teamId).invite.create({ role, permissions: sanitizeAssignablePermissions(...), maxUses, expiresAt })`，返回邀请链接 `${origin}/join/${code}`。
  - `GET`：`tenantDb(teamId).invite.findMany(...)` 列出本团队邀请。
- `src/app/join/[code]/page.tsx`：服务端按 `code` 全局查 invite（裸 prisma）→ 校验存在/未过期/`usedCount<maxUses`/团队 active → 展示团队名 + 表单（登录名 / 密码 / 显示名）。
- `src/app/api/invites/[code]/accept/route.ts`：`POST`（表单+JSON）→ 再校验 invite 有效 + `loginName` 全局未占用 → 事务：在该 invite 的团队建 `User`（role/permissions 取自 invite）+ `invite.usedCount++`（满则失效）→ 签发 session → 跳 `/`。
- 改 [src/app/api/auth/login/route.ts](src/app/api/auth/login/route.ts)：登录查人逻辑不变；成功后**若该用户所属团队 `active=false` 且非超管 → 拒绝**（新错误码 `auth.team_suspended`）；**若 `isSuperAdmin` → 跳 `/admin`**（表单跳转默认目标改为 `user.isSuperAdmin ? '/admin' : '/'`）。

### 阶段 3b — 平台超管控制台（新）

- `src/lib/super-admin.ts`：`getSuperAdmin(request)`（基于 `getRequestUser` 再判 `isSuperAdmin`，否则 null）。超管所有操作**用裸 `prisma`**（跨团队）且每个都 `prisma.auditLog.create`（可挂目标团队 teamId）。
- API（每个都先 `getSuperAdmin`，否则 401/403）：
  - `GET /api/admin/teams`：列出所有团队（名称、owner、成员数、active、createdAt）。
  - `POST /api/admin/teams/[id]/suspend`、`POST /api/admin/teams/[id]/reactivate`：切 `Team.active`。
  - `POST /api/admin/users/[id]/reset-password`：重置任意团队任意成员密码（`hashPassword` + `sessionVersion: { increment: 1 }` 踢下线）。
- `src/app/admin/page.tsx`：超管控制台（沿用 [manage/page.tsx](src/app/manage/page.tsx) 的 cookie+session 校验模式），非 `isSuperAdmin` 一律 `redirect`/404；页面用普通 `form` POST 到上述接口即可，UI 可极简。

### 阶段 4 — 把现有读写全部切到租户 client

统一模式：取 `user`（含 `teamId`）→ 用 `tenantDb(user.teamId)` 替换裸 `prisma`；按 id 的改/删补 `assertSameTeam`。涉及文件：

| 文件 | 改法要点 |
|---|---|
| [api/tasks/route.ts](src/app/api/tasks/route.ts) | GET/POST 改 `tenantDb`；create 不必显式传 teamId（扩展自动注入）|
| [api/tasks/[id]/route.ts](src/app/api/tasks/[id]/route.ts) | findUnique 后 `assertSameTeam`，再 update/softDelete |
| [api/tasks/[id]/complete/route.ts](src/app/api/tasks/[id]/complete/route.ts) | 同上 |
| [api/announcements/route.ts](src/app/api/announcements/route.ts) | GET/POST 改 `tenantDb` |
| [api/announcements/[id]/route.ts](src/app/api/announcements/[id]/route.ts) | findUnique 后 `assertSameTeam` 再删 |
| [api/users/route.ts](src/app/api/users/route.ts) | GET `tenantDb().user.findMany`（自动按 teamId）；POST 建成员走 `tenantDb`；「单一 ADMIN」校验改为「本团队是否已有 owner」|
| [api/users/[id]/status/route.ts](src/app/api/users/[id]/status/route.ts) | target findUnique 后 `assertSameTeam`；admin 保护逻辑按团队 owner 语义调整 |
| [api/users/[id]/reset-password/route.ts](src/app/api/users/[id]/reset-password/route.ts) | 同上：target 必须同团队 |
| [api/calendar/route.ts](src/app/api/calendar/route.ts) | findMany 改 `tenantDb` |
| [app/page.tsx](src/app/page.tsx) | 校验 session 时 `include team` + 停用判断；`currentUser` 拿到后所有 `prisma.task/announcement` 改 `tenantDb(currentUser.teamId)`；超管访问 `/` 直接 `redirect('/admin')` |
| [app/manage/page.tsx](src/app/manage/page.tsx) | 同上：users/auditLog/task.groupBy 全切 `tenantDb` |
| [src/lib/api.ts](src/lib/api.ts) | **必改**：`getCurrentUser` 去掉 `upsert({where:{name}})`（改为仅按 id 查、查不到返回 null，[login/page.tsx:22](src/app/login/page.tsx) 已能处理 null）；`seedIfEmpty` 改为先建团队再建用户、带 teamId；`userSchema` 无需加 email |

`change-password`（[api/auth/change-password/route.ts](src/app/api/auth/change-password/route.ts)）操作的是登录者自己（`user.id`），天然同团队，可保持裸 `prisma`。

### 阶段 5 — 提醒脚本多团队化

[scripts/daily-reminder.js](scripts/daily-reminder.js)：现在一次性查全部 task。改为**按团队分组**：遍历 `active=true` 的 Team，每个团队各生成一段提醒文本（`buildDailyReminder` 逻辑复用，只是数据按 teamId 过滤、标题带团队名），为将来分团队推送到企业微信/Telegram 留接口。

---

## 5. 关键风险
- **跨团队漏数据是头号事故**。防线＝阶段 2 的 client extension（集合操作自动过滤）+ 按 id 操作的 `assertSameTeam`。Code review 时重点：阶段 4 之后，除登录/邀请接受/超管外，**不允许任何路径用裸 `prisma` 碰租户表**。
- **超管是唯一合法绕过隔离的入口**：`/api/admin/*` 每个都必须过 `getSuperAdmin` 且写审计。
- **迁移用手写 SQL**，先在测试库跑一遍，确认存量数据全部归入默认团队、NOT NULL 约束不报错，再按 [docs/database-migrations.md](docs/database-migrations.md) 的备份→执行流程上生产。

## 6. 验证
1. `npx prisma generate` 通过；本地 Postgres 上手动执行迁移 SQL，存量数据落入「默认团队」，老 ADMIN 成为其 owner。
2. `node scripts/bootstrap-super-admin.js`（带 env）能创建超管账号。
3. `npm test`：保留并更新 [tests/permissions.test.ts](tests/permissions.test.ts)、[tests/session.test.ts](tests/session.test.ts)；**新增隔离测试**——建两个团队各一条 task，断言 `tenantDb(teamA).task.findMany()` 查不到 teamB 的 task、`assertSameTeam` 对跨团队行返回 false。
4. `npm run build` 通过（重点确认 `getCurrentUser` 改动后无 `where:{name}` 类型错误）。
5. 手动端到端（`npm run dev`）：注册团队 A → 邀请并加入成员 → 建/完成事项；另注册团队 B → 确认 A、B 的列表/日历/公告/成员互不可见；用 A 的登录态直接请求 B 的 `task/[id]` 应 404/403。
6. **超管验证**：超管登录 → `/admin` 看到 A、B；停用 B → B 成员立即无法登录/访问；超管重置 B 某成员密码，该成员用新密码可登录。
7. 旧账号（默认团队）仍能用原用户名密码登录，且只看到默认团队数据。
